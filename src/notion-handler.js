const axios = require('axios');
const config = require('../config/config');
const { logger } = require('./utils');

class NotionHandler {
  constructor() {
    this.apiKey = config.notion.apiKey;
    this.databaseId = config.notion.databaseId;
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

  // Create a new page in the Notion database
  async createPage(audioData, customName = null) {
    try {
      const displayName = customName || audioData.fileName;
      logger.info(`Creating Notion page for: ${displayName}`);

      const pageData = await this.buildPageData(audioData, customName);
      
      const response = await axios({
        method: 'POST',
        url: `${this.baseURL}/pages`,
        headers: this.getHeaders(),
        data: pageData
      });

      logger.info(`Successfully created Notion page: ${response.data.id}`);
      return response.data;

    } catch (error) {
      logger.error(`Failed to create Notion page for ${audioData.fileName}:`, error.response?.data || error.message);
      throw error;
    }
  }

  // Build the page data structure for Notion
  async buildPageData(audioData, customName = null) {
    const { fileName, summary, keyPoints, actionItems, topics, sentiment, metadata, shareableUrl } = audioData;
    const displayName = customName || fileName.replace(/\.[^/.]+$/, ''); // Remove file extension

    const properties = {
      // Name property (matches your database)
      'Name': {
        title: [
          {
            type: 'text',
            text: {
              content: displayName
            }
          }
        ]
      },
      'Manual Name Input': {
        title: [
          {
            type: 'text',
            text: {
              content: displayName
            }
          }
        ]
      },
      // Main Entry property (matches your database)
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

    // Add URL property with Dropbox shareable link (auto-detect field type)
    if (shareableUrl) {
      properties['URL'] = await this.buildUrlProperty(shareableUrl);
    }

    // Add Audio Log property to mark as processed
    properties['Audio Log?'] = {
      checkbox: true
    };

    return {
      parent: {
        database_id: this.databaseId
      },
      properties: properties,
      // Add all content as formatted blocks
      children: this.buildContentBlocks(audioData, customName)
    };
  }

  // Build URL property based on field type
  async buildUrlProperty(shareableUrl) {
    try {
      // Get database schema to determine URL field type
      const schema = await this.getDatabaseSchema();
      const urlProperty = schema.URL;
      
      if (!urlProperty) {
        logger.warn('No URL property found in database schema, defaulting to rich_text');
        // Default to rich_text format
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
        // Default to rich_text for any other type
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
      // Fallback to rich_text format
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

  // Build formatted content blocks for the page
  buildContentBlocks(audioData, customName = null) {
    const { fileName, summary, keyPoints, actionItems, topics, sentiment, metadata, originalText } = audioData;
    const displayName = customName || fileName.replace(/\.[^/.]+$/, ''); // Remove file extension
    const blocks = [];

    // Summary section
    if (summary) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Summary' } }]
        }
      });
      
      // Add chunked summary blocks to stay under 2000 character limit
      const summaryBlocks = this.createChunkedTextBlocks(summary);
      blocks.push(...summaryBlocks);
    }

    // Key Points section
    if (keyPoints && keyPoints.length > 0) {
      blocks.push(
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: 'Key Points' } }]
          }
        }
      );
      
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
      blocks.push(
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: 'Action Items' } }]
          }
        }
      );
      
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
      
      // Add chunked topics blocks to stay under 2000 character limit
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
          rich_text: [{ type: 'text', text: { content: 'Metadata' } }]
        }
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            { type: 'text', text: { content: `📁 File: ${displayName}` } },
            { type: 'text', text: { content: '\n' } },
            { type: 'text', text: { content: `⏱️ Duration: ${this.formatDuration(metadata?.duration || 0)}` } },
            { type: 'text', text: { content: '\n' } },
            { type: 'text', text: { content: `📝 Words: ${metadata?.wordCount || 0}` } },
            { type: 'text', text: { content: '\n' } },
            { type: 'text', text: { content: `🌍 Language: ${metadata?.language || 'Unknown'}` } },
            { type: 'text', text: { content: '\n' } },
            { type: 'text', text: { content: `😊 Sentiment: ${this.normalizeSentiment(sentiment)}` } },
            { type: 'text', text: { content: '\n' } },
            { type: 'text', text: { content: `📅 Processed: ${new Date(metadata?.processedAt || Date.now()).toLocaleString()}` } }
          ]
        }
      }
    );

    // Full Transcript section
    if (originalText) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Full Transcript' } }]
        }
      });
      
      // Add chunked transcript blocks to stay under 2000 character limit
      const transcriptBlocks = this.createChunkedTextBlocks(originalText);
      blocks.push(...transcriptBlocks);
    }

    return blocks;
  }

  // Create chunked text blocks to stay under Notion's 2000 character limit
  createChunkedTextBlocks(text, maxLength = 1900) {
    const blocks = [];
    
    if (!text || text.length === 0) {
      return blocks;
    }

    // If text is short enough, return single block
    if (text.length <= maxLength) {
      return [{
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: text } }]
        }
      }];
    }

    // Split text into chunks
    let currentPosition = 0;
    while (currentPosition < text.length) {
      let chunkEnd = currentPosition + maxLength;
      
      // If not at the end, try to break at a word boundary
      if (chunkEnd < text.length) {
        const lastSpaceInChunk = text.lastIndexOf(' ', chunkEnd);
        const lastPeriodInChunk = text.lastIndexOf('.', chunkEnd);
        const lastNewlineInChunk = text.lastIndexOf('\n', chunkEnd);
        
        // Use the latest boundary that's reasonable
        const boundaries = [lastSpaceInChunk, lastPeriodInChunk, lastNewlineInChunk]
          .filter(pos => pos > currentPosition + maxLength * 0.7); // Don't break too early
        
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

  // Format duration for display
  formatDuration(seconds) {
    if (!seconds || seconds === 0) return 'Unknown';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  }

  // Normalize sentiment values for Notion select field
  normalizeSentiment(sentiment) {
    const normalized = sentiment?.toLowerCase() || 'neutral';
    
    // Map common sentiment variations to standard values
    const sentimentMap = {
      'positive': 'Positive',
      'negative': 'Negative',
      'neutral': 'Neutral',
      'mixed': 'Mixed'
    };

    return sentimentMap[normalized] || 'Neutral';
  }

  // Get database schema to understand available properties
  async getDatabaseSchema() {
    try {
      const response = await axios({
        method: 'GET',
        url: `${this.baseURL}/databases/${this.databaseId}`,
        headers: this.getHeaders()
      });

      return response.data.properties;
    } catch (error) {
      logger.error('Failed to get database schema:', error.response?.data || error.message);
      throw error;
    }
  }

  // Search for existing pages by Dropbox URL
  async searchByDropboxUrl(shareableUrl) {
    try {
      if (!shareableUrl) {
        logger.warn('No shareable URL provided for search');
        return [];
      }

      logger.info(`Searching for existing page with Dropbox URL: ${shareableUrl}`);
      
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

      // Filter results to find exact matches since 'contains' might return partial matches
      const exactMatches = response.data.results.filter(page => {
        const urlProperty = page.properties.URL;
        if (urlProperty && urlProperty.rich_text && urlProperty.rich_text.length > 0) {
          const urlText = urlProperty.rich_text[0].text.content;
          return urlText === shareableUrl;
        }
        return false;
      });

      logger.info(`Found ${response.data.results.length} pages containing URL, ${exactMatches.length} exact matches`);
      return exactMatches;
    } catch (error) {
      logger.error(`Failed to search for URL ${shareableUrl}:`, error.response?.data || error.message);
      return []; // Return empty array on error to allow processing
    }
  }

  // Auto-detect URL field type and search appropriately
  async searchByDropboxUrlAuto(shareableUrl) {
    try {
      if (!shareableUrl) {
        logger.warn('No shareable URL provided for auto search');
        return [];
      }

      // Get database schema to determine URL field type
      const schema = await this.getDatabaseSchema();
      const urlProperty = schema.URL;
      
      if (!urlProperty) {
        logger.warn('No URL property found in database schema');
        return [];
      }

      logger.info(`URL field type detected: ${urlProperty.type}`);
      
      const response = await axios({
        method: 'POST',
        url: `${this.baseURL}/databases/${this.databaseId}/query`,
        headers: this.getHeaders(),
        data: {
          filter: {
            property: 'URL',
            [urlProperty.type]: urlProperty.type === 'url' 
              ? { equals: shareableUrl }
              : { contains: shareableUrl }
          }
        }
      });

      let results = response.data.results;
      
      // If using rich_text, filter for exact matches
      if (urlProperty.type === 'rich_text') {
        results = results.filter(page => {
          const urlProp = page.properties.URL;
          if (urlProp && urlProp.rich_text && urlProp.rich_text.length > 0) {
            const urlText = urlProp.rich_text[0].text.content;
            return urlText === shareableUrl;
          }
          return false;
        });
      }

      logger.info(`Auto-search found ${results.length} exact matches for URL`);
      return results;
    } catch (error) {
      logger.error(`Auto URL search failed, falling back to standard search:`, error.message);
      // Fallback to the standard rich text search
      return await this.searchByDropboxUrl(shareableUrl);
    }
  }

  // Check if file has already been processed using Dropbox URL
  async isFileAlreadyProcessedByUrl(shareableUrl) {
    try {
      if (!shareableUrl) {
        logger.warn('No shareable URL provided, falling back to filename check');
        return false;
      }

      // Use auto-detection for more robust searching
      const existingPages = await this.searchByDropboxUrlAuto(shareableUrl);
      const isProcessed = existingPages.length > 0;
      
      if (isProcessed) {
        logger.info(`File with URL ${shareableUrl} already exists in Notion database`);
      }
      
      return isProcessed;
    } catch (error) {
      logger.error(`Error checking if file with URL ${shareableUrl} is processed:`, error.message);
      return false; // On error, assume not processed to allow retry
    }
  }

  // Search for existing pages by file name
  async searchByFileName(fileName) {
    try {
      // First, get the database schema to find the correct title property
      const schema = await this.getDatabaseSchema();
      const titleProperty = this.findTitleProperty(schema);
      
      if (!titleProperty) {
        logger.warn('No title property found in database, skipping search');
        return [];
      }

      // Search by the filename without extension
      const searchName = fileName.replace(/\.[^/.]+$/, '');
      
      const response = await axios({
        method: 'POST',
        url: `${this.baseURL}/databases/${this.databaseId}/query`,
        headers: this.getHeaders(),
        data: {
          filter: {
            property: titleProperty.name,
            [titleProperty.type]: {
              equals: searchName
            }
          }
        }
      });

      logger.info(`Found ${response.data.results.length} existing pages for "${searchName}"`);
      return response.data.results;
    } catch (error) {
      logger.error(`Failed to search for file ${fileName}:`, error.response?.data || error.message);
      return []; // Return empty array on error to allow processing
    }
  }

  // Check if file has already been processed (exists in Notion) - keeps for backward compatibility
  async isFileAlreadyProcessed(fileName) {
    try {
      const existingPages = await this.searchByFileName(fileName);
      const isProcessed = existingPages.length > 0;
      
      if (isProcessed) {
        logger.info(`File ${fileName} already exists in Notion database`);
      }
      
      return isProcessed;
    } catch (error) {
      logger.error(`Error checking if file ${fileName} is processed:`, error.message);
      return false; // On error, assume not processed to allow retry
    }
  }

  // Find the title property in the database schema
  findTitleProperty(schema) {
    // Look for common title property names
    const titleNames = ['Name', 'Title', 'Page', 'File Name', 'Recording Name'];
    
    for (const [propertyName, property] of Object.entries(schema)) {
      if (titleNames.includes(propertyName) || propertyName.toLowerCase().includes('title')) {
        return { name: propertyName, type: property.type };
      }
    }
    
    // If no title property found, return the first property (usually required)
    const firstProperty = Object.entries(schema)[0];
    if (firstProperty) {
      return { name: firstProperty[0], type: firstProperty[1].type };
    }
    
    return null;
  }

  // Update existing page
  async updatePage(pageId, audioData, customName = null) {
    try {
      logger.info(`Updating Notion page: ${pageId}`);

      const pageData = await this.buildPageData(audioData, customName);
      
      // Update page properties
      const response = await axios({
        method: 'PATCH',
        url: `${this.baseURL}/pages/${pageId}`,
        headers: this.getHeaders(),
        data: {
          properties: pageData.properties
        }
      });

      // Clear existing blocks and add new content
      await this.updatePageContent(pageId, pageData.children);

      logger.info(`Successfully updated Notion page: ${pageId}`);
      return response.data;

    } catch (error) {
      logger.error(`Failed to update Notion page ${pageId}:`, error.response?.data || error.message);
      throw error;
    }
  }

  // Update page content blocks
  async updatePageContent(pageId, blocks) {
    try {
      // First, delete all existing blocks
      await this.deletePageBlocks(pageId);
      
      // Then add new blocks
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
      logger.error(`Failed to update page content for ${pageId}:`, error.message);
      throw error;
    }
  }

  // Delete all blocks in a page
  async deletePageBlocks(pageId) {
    try {
      // Get all blocks in the page
      const response = await axios({
        method: 'GET',
        url: `${this.baseURL}/blocks/${pageId}/children`,
        headers: this.getHeaders()
      });

      // Delete each block
      for (const block of response.data.results) {
        await axios({
          method: 'DELETE',
          url: `${this.baseURL}/blocks/${block.id}`,
          headers: this.getHeaders()
        });
      }
    } catch (error) {
      logger.error(`Failed to delete blocks for page ${pageId}:`, error.message);
      throw error;
    }
  }

  // Create or update page (handles both cases) - now with URL-based tracking
  async createOrUpdatePage(audioData, customName = null, forceUpdate = false) {
    try {
      let existingPages = [];
      
      // Primary check: search by Dropbox URL if available
      if (audioData.shareableUrl) {
        existingPages = await this.searchByDropboxUrlAuto(audioData.shareableUrl);
        logger.info(`URL-based search found ${existingPages.length} existing pages`);
      }
      
      // Fallback: search by filename if no URL or no results from URL search
      if (existingPages.length === 0) {
        logger.info('Falling back to filename-based search');
        existingPages = await this.searchByFileName(audioData.fileName);
        logger.info(`Filename-based search found ${existingPages.length} existing pages`);
      }
      
      if (existingPages.length > 0 && forceUpdate) {
        logger.info(`Force updating existing page for: ${audioData.fileName}`);
        return await this.updatePage(existingPages[0].id, audioData, customName);
      } else if (existingPages.length > 0) {
        logger.info(`Page already exists for: ${audioData.fileName}, skipping creation`);
        return existingPages[0]; // Return existing page
      } else {
        logger.info(`Creating new page for: ${audioData.fileName}`);
        return await this.createPage(audioData, customName);
      }

    } catch (error) {
      logger.error(`Failed to create or update page for ${audioData.fileName}:`, error.message);
      throw error;
    }
  }

  // Test database connection
  async testConnection() {
    try {
      await this.getDatabaseSchema();
      logger.info('Notion connection test successful');
      return true;
    } catch (error) {
      logger.error('Notion connection test failed:', error.message);
      return false;
    }
  }
}

module.exports = NotionHandler; 