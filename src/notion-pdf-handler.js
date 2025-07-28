const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const config = require('../config/config');
const { logger } = require('./utils');

class NotionPDFHandler {
  constructor() {
    this.apiKey = config.notion.apiKey;
    this.databaseId = config.notion.pdfDatabaseId;
    this.baseURL = 'https://api.notion.com/v1';
  }

  // Create headers for Notion API requests
  getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    };
  }

  // Create a new page in the PDF Notion database
  async createPage(documentData, customName = null) {
    try {
      const displayName = customName || documentData.fileName;
      logger.info(`Creating PDF Notion page for: ${displayName}`);

      const pageData = await this.buildPageData(documentData, customName);
      
      const response = await axios({
        method: 'POST',
        url: `${this.baseURL}/pages`,
        headers: this.getHeaders(),
        data: pageData
      });

      logger.info(`Successfully created PDF Notion page: ${response.data.id}`);
      return response.data;

    } catch (error) {
      logger.error(`Failed to create PDF Notion page for ${documentData.fileName}:`, error.response?.data || error.message);
      throw error;
    }
  }

  // Build the page data structure for PDF Notion database
  async buildPageData(documentData, customName = null) {
    const { fileName, generatedTitle, summary, keyPoints, actionItems, topics, sentiment, metadata, shareableUrl, uploadedFile } = documentData;
    const displayName = customName || generatedTitle || fileName.replace(/\.[^/.]+$/, '');

    const properties = {
      // Name property (matches your PDF database) - using link tags relation
      'Name': await this.buildLinkTagsRelation(generatedTitle || displayName),
      // Main Entry property (matches your PDF database)
      'Main Entry': {
        rich_text: [
          {
            type: 'text',
            text: {
              content: summary || 'No summary available'
            }
          }
        ]
      }
    };

    // Add URL property with Dropbox shareable link
    if (shareableUrl) {
      properties['URL'] = await this.buildUrlProperty(shareableUrl);
    }

    // Add Files property with uploaded file if available
    if (uploadedFile) {
      properties['Files'] = await this.buildFilesProperty(uploadedFile);
    }

    // Add Status property
    properties['Status'] = await this.buildStatusProperty('📥');

    // Note: Link Tags property temporarily disabled for testing
    // properties['Link Tags'] = await this.buildFileTypeLinkTagsRelation(metadata?.fileType);

    return {
      parent: {
        database_id: this.databaseId
      },
      properties: properties,
      children: this.buildContentBlocks(documentData, customName)
    };
  }

  // Build URL property based on field type
  async buildUrlProperty(shareableUrl) {
    try {
      const schema = await this.getDatabaseSchema();
      const urlProperty = schema.URL;
      
      if (!urlProperty) {
        logger.warn('No URL property found in PDF database schema, defaulting to rich_text');
        return {
          rich_text: [
            {
              type: 'text',
              text: {
                content: shareableUrl
              }
            }
          ]
        };
      }

      if (urlProperty.type === 'url') {
        return { url: shareableUrl };
      } else {
        return {
          rich_text: [
            {
              type: 'text',
              text: {
                content: shareableUrl
              }
            }
          ]
        };
      }
    } catch (error) {
      logger.warn(`Error building URL property, defaulting to rich_text:`, error.message);
      return {
        rich_text: [
          {
            type: 'text',
            text: {
              content: shareableUrl
            }
          }
        ]
      };
    }
  }

  // Build Files property for uploaded file
  async buildFilesProperty(uploadedFile) {
    try {
      const schema = await this.getDatabaseSchema();
      const filesProperty = schema.Files;
      
      if (!filesProperty) {
        logger.warn('No Files property found in PDF database schema');
        return null;
      }

      if (filesProperty.type === 'files') {
        return {
          files: [
            {
              type: 'file',
              file: {
                url: uploadedFile.url || uploadedFile.file?.url,
                expiry_time: uploadedFile.expiry_time || uploadedFile.file?.expiry_time
              },
              name: uploadedFile.name || uploadedFile.file?.name
            }
          ]
        };
      } else {
        logger.warn(`Files property type is ${filesProperty.type}, expected 'files'`);
        return null;
      }
    } catch (error) {
      logger.error('Error building Files property:', error.message);
      return null;
    }
  }

  // Build Status property based on field type
  async buildStatusProperty(statusValue) {
    try {
      const schema = await this.getDatabaseSchema();
      const statusProperty = schema.Status;
      
      if (!statusProperty) {
        logger.warn('No Status property found in PDF database schema, defaulting to rich_text');
        return {
          rich_text: [
            {
              type: 'text',
              text: {
                content: statusValue
              }
            }
          ]
        };
      }

      if (statusProperty.type === 'status') {
        // For status fields, we need to provide a valid status name
        // If statusValue is empty, use a default
        const statusName = statusValue || '📥';
        logger.info(`Using status name: ${statusName} for Status property`);
        logger.debug(`Available status options:`, statusProperty.status?.options || 'No options found');
        return { status: { name: statusName } };
      } else if (statusProperty.type === 'select') {
        // For select fields, we need to provide a valid select option
        const selectName = statusValue || '📥';
        logger.info(`Using select name: ${selectName} for Status property`);
        logger.debug(`Available select options:`, statusProperty.select?.options || 'No options found');
        return { select: { name: selectName } };
      } else {
        return {
          rich_text: [
            {
              type: 'text',
              text: {
                content: statusValue || '📥'
              }
            }
          ]
        };
      }
    } catch (error) {
      logger.warn(`Error building Status property, defaulting to rich_text:`, error.message);
      return {
        rich_text: [
          {
            type: 'text',
            text: {
              content: statusValue
            }
          }
        ]
      };
    }
  }

  // Build document type relation based on file type
  async buildFileTypeLinkTagsRelation(fileType) {
    try {
      // Determine if it's a document or picture based on file type
      const isImage = ['image'].includes(fileType);
      const relationValue = isImage ? 'Pictures' : 'Imported doc';
      
      // Get the relation property schema to understand the available options
      const schema = await this.getDatabaseSchema();
      const relationProperty = schema['Link Tags'];
      
      if (!relationProperty || relationProperty.type !== 'relation') {
        logger.warn('No Link Tags relation property found in PDF database schema, defaulting to select');
        // Fallback to select if relation doesn't exist
        return {
          select: {
            name: relationValue
          }
        };
      }

      // For relation fields, we need to provide the relation database ID and page ID
      // Since we can't easily get the page IDs for "Imported doc" and "Pictures",
      // we'll use a select field as fallback or you can configure the relation IDs
      
      // You can configure these IDs in your environment variables
      const relationIds = {
        'Imported doc': process.env.NOTION_IMPORTED_DOC_RELATION_ID,
        'Pictures': process.env.NOTION_PICTURES_RELATION_ID
      };

      if (relationIds[relationValue]) {
        return {
          relation: [
            {
              id: relationIds[relationValue]
            }
          ]
        };
      } else {
        // Fallback to select if relation IDs are not configured
        logger.warn(`Relation ID not configured for ${relationValue}, using select fallback`);
        return {
          select: {
            name: relationValue
          }
        };
      }
    } catch (error) {
      logger.warn(`Error building Document Type relation, defaulting to select:`, error.message);
      // Fallback to select format
      const isImage = ['image'].includes(fileType);
      const relationValue = isImage ? 'Pictures' : 'Imported doc';
      
      return {
        select: {
          name: relationValue
        }
      };
    }
  }

  // Build link tags relation for the Name property
  async buildLinkTagsRelation(title) {
    try {
      const schema = await this.getDatabaseSchema();
      const nameProperty = schema['Name'];
      
      if (!nameProperty) {
        logger.warn('No Name property found in PDF database schema, defaulting to title');
        return {
          title: [
            {
              type: 'text',
              text: {
                content: title
              }
            }
          ]
        };
      }

      if (nameProperty.type === 'relation') {
        // For relation fields, we need to provide relation database ID and page ID
        // You can configure these IDs in your environment variables
        const relationId = process.env.NOTION_LINK_TAGS_RELATION_ID;
        
        if (relationId) {
          return {
            relation: [
              {
                id: relationId
              }
            ]
          };
        } else {
          logger.warn('Link tags relation ID not configured, using title fallback');
          return {
            title: [
              {
                type: 'text',
                text: {
                  content: title
                }
              }
            ]
          };
        }
      } else {
        // Fallback to title if the property is not a relation
        return {
          title: [
            {
              type: 'text',
              text: {
                content: title
              }
            }
          ]
        };
      }
    } catch (error) {
      logger.warn(`Error building link tags relation, defaulting to title:`, error.message);
      return {
        title: [
          {
            type: 'text',
            text: {
              content: title
            }
          }
        ]
      };
    }
  }

  // Build formatted content blocks for the PDF page
  buildContentBlocks(documentData, customName = null) {
    const { fileName, summary, keyPoints, actionItems, topics, sentiment, metadata, originalText, uploadedFile } = documentData;
    const displayName = customName || fileName.replace(/\.[^/.]+$/, '');
    const blocks = [];

    // Add file block if file was uploaded to Notion
    if (uploadedFile) {
      blocks.push({
        object: 'block',
        type: 'file',
        file: {
          type: 'file',
          file: {
            url: uploadedFile.url || uploadedFile.file?.url,
            expiry_time: uploadedFile.expiry_time || uploadedFile.file?.expiry_time
          },
          caption: [
            {
              type: 'text',
              text: {
                content: `Original file: ${fileName}`
              }
            }
          ]
        }
      });
    }

    // Summary section with full text as toggle
    if (summary) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Summary' } }]
        }
      });
      
      const summaryBlocks = this.createChunkedTextBlocks(summary);
      blocks.push(...summaryBlocks);

      // Add full extracted text as toggle under summary
      if (originalText) {
        blocks.push({
          object: 'block',
          type: 'toggle',
          toggle: {
            rich_text: [{ type: 'text', text: { content: '📄 Full Extracted Text' } }],
            children: this.createChunkedTextBlocks(originalText)
          }
        });
      }
    }

    // Key Points section
    if (keyPoints && keyPoints.length > 0) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Key Points' } }]
        }
      });
      
      keyPoints.forEach(point => {
        blocks.push({
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ type: 'text', text: { content: point } }]
          }
        });
      });
    }

    // Action Items section
    if (actionItems && actionItems.length > 0) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Action Items' } }]
        }
      });
      
      actionItems.forEach(item => {
        blocks.push({
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ type: 'text', text: { content: item } }]
          }
        });
      });
    }

    // Topics section
    if (topics && topics.length > 0) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Topics' } }]
        }
      });
      
      const topicsText = topics.join(', ');
      const topicsBlocks = this.createChunkedTextBlocks(topicsText);
      blocks.push(...topicsBlocks);
    }

    // Metadata section
    blocks.push(
      {
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Document Metadata' } }]
        }
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            { type: 'text', text: { content: `📁 File: ${displayName}` } },
            { type: 'text', text: { content: '\n' } },
            { type: 'text', text: { content: `📄 Type: ${metadata?.fileType || 'Unknown'}` } },
            { type: 'text', text: { content: '\n' } },
            { type: 'text', text: { content: `📏 Size: ${this.formatFileSize(metadata?.fileSize || 0)}` } },
            { type: 'text', text: { content: '\n' } },
            { type: 'text', text: { content: `📝 Characters: ${metadata?.textLength || 0}` } },
            { type: 'text', text: { content: '\n' } },
            { type: 'text', text: { content: `😊 Sentiment: ${this.normalizeSentiment(sentiment)}` } },
            { type: 'text', text: { content: '\n' } },
            { type: 'text', text: { content: `📅 Processed: ${new Date(metadata?.processedAt || Date.now()).toLocaleString()}` } }
          ]
        }
      }
    );

    // Add page count for PDFs
    if (metadata?.pageCount) {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            { type: 'text', text: { content: `📄 Pages: ${metadata.pageCount}` } }
          ]
        }
      });
    }

    // Add confidence for OCR results
    if (metadata?.confidence) {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            { type: 'text', text: { content: `🎯 OCR Confidence: ${metadata.confidence}%` } }
          ]
        }
      });
    }

    return blocks;
  }

  // Create chunked text blocks to stay under Notion's 2000 character limit
  createChunkedTextBlocks(text, maxLength = 1900) {
    const blocks = [];
    
    if (!text || text.length === 0) {
      return blocks;
    }

    if (text.length <= maxLength) {
      return [{
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: text } }]
        }
      }];
    }

    let currentPosition = 0;
    while (currentPosition < text.length) {
      let chunkEnd = currentPosition + maxLength;
      
      if (chunkEnd < text.length) {
        const lastSpaceInChunk = text.lastIndexOf(' ', chunkEnd);
        const lastPeriodInChunk = text.lastIndexOf('.', chunkEnd);
        const lastNewlineInChunk = text.lastIndexOf('\n', chunkEnd);
        
        const boundaries = [lastSpaceInChunk, lastPeriodInChunk, lastNewlineInChunk]
          .filter(pos => pos > currentPosition + maxLength * 0.7);
        
        if (boundaries.length > 0) {
          chunkEnd = Math.max(...boundaries) + 1;
        }
      }

      const chunk = text.substring(currentPosition, Math.min(chunkEnd, text.length));
      
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: chunk.trim() } }]
        }
      });

      currentPosition = chunkEnd;
    }

    return blocks;
  }

  // Format file size for display
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Normalize sentiment values for Notion select field
  normalizeSentiment(sentiment) {
    const normalized = sentiment?.toLowerCase() || 'neutral';
    
    const sentimentMap = {
      'positive': 'Positive',
      'negative': 'Negative',
      'neutral': 'Neutral',
      'mixed': 'Mixed'
    };

    return sentimentMap[normalized] || 'Neutral';
  }

  // Upload file to Notion using the proper Files and Media API
  async uploadFileToNotion(filePath, fileName) {
    try {
      if (!config.documents.uploadToNotion) {
        logger.info('File upload to Notion is disabled');
        return null;
      }

      if (!fs.existsSync(filePath)) {
        logger.error(`File not found: ${filePath}`);
        return null;
      }

      logger.info(`Uploading file to Notion: ${fileName}`);

      // Step 1: Create a file upload request to get upload URL
      const fileStats = fs.statSync(filePath);
      const createUploadResponse = await axios({
        method: 'POST',
        url: `${this.baseURL}/files`,
        headers: this.getHeaders(),
        data: {
          name: fileName,
          file_size: fileStats.size
        }
      });

      const { upload_url, file } = createUploadResponse.data;
      logger.info(`Created file upload with ID: ${file.id}, size: ${fileStats.size} bytes`);

      // Step 2: Upload the actual file data using multipart/form-data
      const formData = new FormData();
      formData.append('file', fs.createReadStream(filePath), fileName);

      await axios({
        method: 'POST',
        url: upload_url,
        data: formData,
        headers: {
          ...formData.getHeaders()
        }
      });

      logger.info(`Successfully uploaded file to Notion: ${file.id}`);
      return file;
    } catch (error) {
      logger.error(`Failed to upload file to Notion:`, error.response?.data || error.message);
      return null;
    }
  }

  // Get database schema to understand available properties
  async getDatabaseSchema() {
    try {
      const response = await axios({
        method: 'GET',
        url: `${this.baseURL}/databases/${this.databaseId}`,
        headers: this.getHeaders()
      });

      // Log the schema for debugging
      logger.info('PDF Database Schema:', Object.keys(response.data.properties));
      logger.debug('PDF Database Schema Details:', JSON.stringify(response.data.properties, null, 2));

      return response.data.properties;
    } catch (error) {
      logger.error('Failed to get PDF database schema:', error.response?.data || error.message);
      throw error;
    }
  }

  // Search for existing pages by Dropbox URL
  async searchByDropboxUrl(shareableUrl) {
    try {
      if (!shareableUrl) {
        logger.warn('No shareable URL provided for PDF search');
        return [];
      }

      logger.info(`Searching for existing PDF page with Dropbox URL: ${shareableUrl}`);
      
      const response = await axios({
        method: 'POST',
        url: `${this.baseURL}/databases/${this.databaseId}/query`,
        headers: this.getHeaders(),
        data: {
          filter: {
            property: 'URL',
            rich_text: {
              contains: shareableUrl
            }
          }
        }
      });

      const exactMatches = response.data.results.filter(page => {
        const urlProperty = page.properties.URL;
        if (urlProperty && urlProperty.rich_text && urlProperty.rich_text.length > 0) {
          const urlText = urlProperty.rich_text[0].text.content;
          return urlText === shareableUrl;
        }
        return false;
      });

      logger.info(`Found ${response.data.results.length} PDF pages containing URL, ${exactMatches.length} exact matches`);
      return exactMatches;
    } catch (error) {
      logger.error(`Failed to search for PDF URL ${shareableUrl}:`, error.response?.data || error.message);
      return [];
    }
  }

  // Check if file has already been processed using Dropbox URL
  async isFileAlreadyProcessedByUrl(shareableUrl) {
    try {
      if (!shareableUrl) {
        logger.warn('No shareable URL provided for PDF, falling back to filename check');
        return false;
      }

      const existingPages = await this.searchByDropboxUrl(shareableUrl);
      const isProcessed = existingPages.length > 0;
      
      if (isProcessed) {
        logger.info(`PDF with URL ${shareableUrl} already exists in Notion database`);
      }
      
      return isProcessed;
    } catch (error) {
      logger.error(`Error checking if PDF with URL ${shareableUrl} is processed:`, error.message);
      return false;
    }
  }

  // Create or update PDF page
  async createOrUpdatePage(documentData, customName = null, forceUpdate = false) {
    try {
      let existingPages = [];
      
      if (documentData.shareableUrl) {
        existingPages = await this.searchByDropboxUrl(documentData.shareableUrl);
        logger.info(`URL-based search found ${existingPages.length} existing PDF pages`);
      }
      
      if (existingPages.length > 0 && forceUpdate) {
        logger.info(`Force updating existing PDF page for: ${documentData.fileName}`);
        return await this.updatePage(existingPages[0].id, documentData, customName);
      } else if (existingPages.length > 0) {
        logger.info(`PDF page already exists for: ${documentData.fileName}, skipping creation`);
        return existingPages[0];
      } else {
        logger.info(`Creating new PDF page for: ${documentData.fileName}`);
        return await this.createPage(documentData, customName);
      }

    } catch (error) {
      logger.error(`Failed to create or update PDF page for ${documentData.fileName}:`, error.message);
      throw error;
    }
  }

  // Update existing PDF page
  async updatePage(pageId, documentData, customName = null) {
    try {
      logger.info(`Updating PDF Notion page: ${pageId}`);

      const pageData = await this.buildPageData(documentData, customName);
      
      const response = await axios({
        method: 'PATCH',
        url: `${this.baseURL}/pages/${pageId}`,
        headers: this.getHeaders(),
        data: {
          properties: pageData.properties
        }
      });

      await this.updatePageContent(pageId, pageData.children);

      logger.info(`Successfully updated PDF Notion page: ${pageId}`);
      return response.data;

    } catch (error) {
      logger.error(`Failed to update PDF Notion page ${pageId}:`, error.response?.data || error.message);
      throw error;
    }
  }

  // Update page content blocks
  async updatePageContent(pageId, blocks) {
    try {
      await this.deletePageBlocks(pageId);
      
      for (const block of blocks) {
        await axios({
          method: 'PATCH',
          url: `${this.baseURL}/blocks/${pageId}/children`,
          headers: this.getHeaders(),
          data: {
            children: [block]
          }
        });
      }
    } catch (error) {
      logger.error(`Failed to update PDF page content for ${pageId}:`, error.message);
      throw error;
    }
  }

  // Delete all blocks in a page
  async deletePageBlocks(pageId) {
    try {
      const response = await axios({
        method: 'GET',
        url: `${this.baseURL}/blocks/${pageId}/children`,
        headers: this.getHeaders()
      });

      for (const block of response.data.results) {
        await axios({
          method: 'DELETE',
          url: `${this.baseURL}/blocks/${block.id}`,
          headers: this.getHeaders()
        });
      }
    } catch (error) {
      logger.error(`Failed to delete PDF blocks for page ${pageId}:`, error.message);
      throw error;
    }
  }

  // Test database connection
  async testConnection() {
    try {
      await this.getDatabaseSchema();
      logger.info('PDF Notion connection test successful');
      return true;
    } catch (error) {
      logger.error('PDF Notion connection test failed:', error.message);
      return false;
    }
  }
}

module.exports = NotionPDFHandler; 