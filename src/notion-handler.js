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
        // Title property (required)
        'Title': {
          title: [
            {
              type: 'text',
              text: {
                content: fileName.replace(/\.[^/.]+$/, '') // Remove file extension
              }
            }
          ]
        },

        // Summary property
        'Summary': {
          rich_text: [
            {
              type: 'text',
              text: {
                content: summary || 'No summary available'
              }
            }
          ]
        },

        // Key Points property
        'Key Points': {
          rich_text: [
            {
              type: 'text',
              text: {
                content: keyPoints?.join('\n• ') || 'No key points identified'
              }
            }
          ]
        },

        // Action Items property
        'Action Items': {
          rich_text: [
            {
              type: 'text',
              text: {
                content: actionItems?.length > 0 ? actionItems.join('\n• ') : 'No action items identified'
              }
            }
          ]
        },

        // Topics property
        'Topics': {
          multi_select: topics?.map(topic => ({ name: topic })) || []
        },

        // Sentiment property
        'Sentiment': {
          select: {
            name: this.normalizeSentiment(sentiment)
          }
        },

        // Duration property
        'Duration': {
          number: metadata?.duration || 0
        },

        // Word Count property
        'Word Count': {
          number: metadata?.wordCount || 0
        },

        // Language property
        'Language': {
          select: {
            name: metadata?.language || 'Unknown'
          }
        },

        // Processed Date property
        'Processed Date': {
          date: {
            start: metadata?.processedAt || new Date().toISOString()
          }
        },

        // File Name property
        'File Name': {
          rich_text: [
            {
              type: 'text',
              text: {
                content: fileName
              }
            }
          ]
        },

        // Status property
        'Status': {
          select: {
            name: 'Processed'
          }
        }
      },

      // Add the full transcript as a block
      children: [
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: 'Full Transcript'
                }
              }
            ]
          }
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: audioData.originalText || 'No transcript available'
                }
              }
            ]
          }
        }
      ]
    };
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
      const response = await axios({
        method: 'POST',
        url: `${this.baseURL}/databases/${this.databaseId}/query`,
        headers: this.getHeaders(),
        data: {
          filter: {
            property: 'File Name',
            rich_text: {
              equals: fileName
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

  // Update existing page
  async updatePage(pageId, audioData) {
    try {
      logger.info(`Updating Notion page: ${pageId}`);

      const pageData = this.buildPageData(audioData);
      
      const response = await axios({
        method: 'PATCH',
        url: `${this.baseURL}/pages/${pageId}`,
        headers: this.getHeaders(),
        data: {
          properties: pageData.properties
        }
      });

      logger.info(`Successfully updated Notion page: ${pageId}`);
      return response.data;

    } catch (error) {
      logger.error(`Failed to update Notion page ${pageId}:`, error.response?.data || error.message);
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