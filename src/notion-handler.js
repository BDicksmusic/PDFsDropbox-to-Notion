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
  async createPage(audioData) {
    try {
      logger.info(`Creating Notion page for: ${audioData.fileName}`);

      const pageData = this.buildPageData(audioData);
      
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
  buildPageData(audioData) {
    const { fileName, summary, keyPoints, actionItems, topics, sentiment, metadata } = audioData;

    return {
      parent: {
        database_id: this.databaseId
      },
      properties: {
        // Name property (matches your database)
        'Name': {
          title: [
            {
              type: 'text',
              text: {
                content: fileName.replace(/\.[^/.]+$/, '') // Remove file extension
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
      },

      // Add all content as formatted blocks
      children: this.buildContentBlocks(audioData)
    };
  }

  // Build formatted content blocks for the page
  buildContentBlocks(audioData) {
    const { fileName, summary, keyPoints, actionItems, topics, sentiment, metadata, originalText } = audioData;
    const blocks = [];

    // Summary section
    if (summary) {
      blocks.push(
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: 'Summary' } }]
          }
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: summary } }]
          }
        }
      );
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
      blocks.push(
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: 'Topics' } }]
          }
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: topics.join(', ') } }]
          }
        }
      );
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
            { type: 'text', text: { content: `📁 File: ${fileName}` } },
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
      blocks.push(
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: 'Full Transcript' } }]
          }
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: originalText } }]
          }
        }
      );
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

      const response = await axios({
        method: 'POST',
        url: `${this.baseURL}/databases/${this.databaseId}/query`,
        headers: this.getHeaders(),
        data: {
          filter: {
            property: titleProperty.name,
            [titleProperty.type]: {
              equals: fileName.replace(/\.[^/.]+$/, '') // Remove file extension to match title
            }
          }
        }
      });

      return response.data.results;
    } catch (error) {
      logger.error(`Failed to search for file ${fileName}:`, error.response?.data || error.message);
      throw error;
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
  async updatePage(pageId, audioData) {
    try {
      logger.info(`Updating Notion page: ${pageId}`);

      const pageData = this.buildPageData(audioData);
      
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

  // Create or update page (handles both cases)
  async createOrUpdatePage(audioData) {
    try {
      // Check if page already exists
      const existingPages = await this.searchByFileName(audioData.fileName);
      
      if (existingPages.length > 0) {
        logger.info(`Updating existing page for: ${audioData.fileName}`);
        return await this.updatePage(existingPages[0].id, audioData);
      } else {
        logger.info(`Creating new page for: ${audioData.fileName}`);
        return await this.createPage(audioData);
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