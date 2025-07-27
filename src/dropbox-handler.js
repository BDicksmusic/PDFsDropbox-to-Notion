const axios = require('axios');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const config = require('../config/config');
const { logger, ensureTempDir, cleanupTempFile, isValidAudioFormat, isValidFileSize } = require('./utils');

class DropboxHandler {
  constructor() {
    this.accessToken = config.dropbox.accessToken;
    this.refreshToken = config.dropbox.refreshToken; // Add refresh token support
    this.appKey = config.dropbox.appKey; // Add app key for token refresh
    this.appSecret = config.dropbox.appSecret; // Add app secret for token refresh
    this.webhookSecret = config.dropbox.webhookSecret;
    this.folderPath = config.dropbox.folderPath;
    // Remove in-memory tracking - we'll use Notion database as source of truth
  }

  // Refresh access token using refresh token
  async refreshAccessToken() {
    if (!this.refreshToken || !this.appKey || !this.appSecret) {
      throw new Error('Refresh token, app key, and app secret are required for token refresh');
    }

    try {
      logger.info('Attempting to refresh Dropbox access token');
      
      const response = await axios({
        method: 'POST',
        url: 'https://api.dropboxapi.com/oauth2/token',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
          client_id: this.appKey,
          client_secret: this.appSecret
        })
      });

      this.accessToken = response.data.access_token;
      
      // If a new refresh token is provided, update it
      if (response.data.refresh_token) {
        this.refreshToken = response.data.refresh_token;
      }

      logger.info('Successfully refreshed Dropbox access token');
      
      // Note: In production, you should save these tokens to your environment/database
      // For now, we'll just use them in memory for the current session
      
      return this.accessToken;
    } catch (error) {
      logger.error('Failed to refresh Dropbox access token:', error.response?.data || error.message);
      throw error;
    }
  }

  // Make authenticated request with automatic token refresh
  async makeAuthenticatedRequest(requestConfig) {
    try {
      // First attempt with current token
      const response = await axios({
        ...requestConfig,
        headers: {
          ...requestConfig.headers,
          'Authorization': `Bearer ${this.accessToken}`
        }
      });
      
      return response;
    } catch (error) {
      // If we get a 401, try to refresh the token and retry once
      if (error.response?.status === 401 && this.refreshToken) {
        logger.warn('Received 401 error, attempting to refresh token and retry');
        
        try {
          await this.refreshAccessToken();
          
          // Retry the request with the new token
          const retryResponse = await axios({
            ...requestConfig,
            headers: {
              ...requestConfig.headers,
              'Authorization': `Bearer ${this.accessToken}`
            }
          });
          
          return retryResponse;
        } catch (refreshError) {
          logger.error('Token refresh failed, cannot retry request');
          throw refreshError;
        }
      }
      
      // If it's not a 401 or we don't have refresh capability, throw the original error
      throw error;
    }
  }

  // Verify webhook signature
  verifyWebhookSignature(body, signature) {
    if (!this.webhookSecret) {
      logger.warn('No webhook secret configured, skipping signature verification');
      return true;
    }

    // Convert body to string if it's an object
    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(bodyString)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  // Process webhook notification
  async processWebhookNotification(notification) {
    try {
      logger.info('Processing Dropbox webhook notification', { 
        listFolder: notification.list_folder 
      });

      // When we receive a webhook, we need to check the folder for new files
      logger.info('Checking folder for files after webhook notification');
      
      const files = await this.listFiles();
      
      // Get all files in the monitored folder
      const allFiles = files.filter(entry => 
        entry['.tag'] === 'file' && 
        entry.path_lower.startsWith(this.folderPath.toLowerCase())
      );

      logger.info(`Found ${allFiles.length} total files in monitored folder`);

      const processedFiles = [];
      for (const file of allFiles) {
        try {
          const processedFile = await this.processFile(file);
          if (processedFile) {
            processedFiles.push(processedFile);
          } else {
            logger.info(`Skipping file ${file.path_lower}: already processed or failed validation`);
          }
        } catch (error) {
          logger.error(`Failed to process file ${file.path_lower}:`, error.message);
        }
      }

      logger.info(`Successfully processed ${processedFiles.length} files`);
      return processedFiles;
    } catch (error) {
      logger.error('Error processing webhook notification:', error);
      throw error;
    }
  }

  // Process individual file
  async processFile(fileEntry) {
    const filePath = fileEntry.path_lower;
    const fileName = path.basename(filePath);

    logger.info(`Checking file: ${fileName}`);

    // Validate file format
    if (!isValidAudioFormat(fileName)) {
      logger.warn(`Skipping file ${fileName}: unsupported audio format`);
      return null;
    }

    // Validate file size
    if (!isValidFileSize(fileEntry.size)) {
      logger.warn(`Skipping file ${fileName}: file too large (${fileEntry.size} bytes)`);
      return null;
    }

    // Get shareable URL for the file
    let shareableUrl = null;
    try {
      shareableUrl = await this.getShareableUrl(filePath);
      logger.info(`Successfully obtained shareable URL for ${fileName}`);
    } catch (error) {
      logger.error(`Failed to get shareable URL for ${fileName}:`, error.message);
      logger.warn(`Will fall back to filename-based duplicate detection for ${fileName}`);
    }

    // Download file
    try {
      const localFilePath = await this.downloadFile(filePath, fileName);
      
      return {
        originalPath: filePath,
        fileName: fileName,
        localPath: localFilePath,
        size: fileEntry.size,
        modified: fileEntry.server_modified,
        shareableUrl: shareableUrl
      };
    } catch (error) {
      logger.error(`Failed to download file ${fileName}:`, error.message);
      return null;
    }
  }

  // Get shareable URL for a file
  async getShareableUrl(filePath) {
    try {
      logger.info(`Getting shareable URL for: ${filePath}`);

      const response = await this.makeAuthenticatedRequest({
        method: 'POST',
        url: 'https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings',
        headers: {
          'Content-Type': 'application/json'
        },
        data: {
          path: filePath,
          settings: {
            requested_visibility: 'public',
            audience: 'public',
            access: 'viewer'
          }
        }
      });

      logger.info(`Successfully created shareable URL for: ${filePath}`);
      return response.data.url;

    } catch (error) {
      // If link already exists, get existing link
      if (error.response?.data?.error?.['.tag'] === 'shared_link_already_exists') {
        try {
          logger.info(`Shared link already exists for ${filePath}, retrieving existing link`);
          
          const existingResponse = await this.makeAuthenticatedRequest({
            method: 'POST',
            url: 'https://api.dropboxapi.com/2/sharing/list_shared_links',
            headers: {
              'Content-Type': 'application/json'
            },
            data: {
              path: filePath,
              direct_only: true
            }
          });

          if (existingResponse.data.links && existingResponse.data.links.length > 0) {
            logger.info(`Retrieved existing shareable URL for: ${filePath}`);
            return existingResponse.data.links[0].url;
          }
        } catch (retrieveError) {
          logger.error(`Failed to retrieve existing shareable URL for ${filePath}:`, retrieveError.message);
        }
      }
      
      logger.error(`Failed to get shareable URL for ${filePath}:`, error.response?.data || error.message);
      throw error;
    }
  }

  // Download file from Dropbox
  async downloadFile(dropboxPath, fileName) {
    try {
      await ensureTempDir();
      
      const localFilePath = path.join(config.processing.tempFolder, fileName);
      
      logger.info(`Downloading file from Dropbox: ${dropboxPath}`);

      const response = await this.makeAuthenticatedRequest({
        method: 'POST',
        url: 'https://content.dropboxapi.com/2/files/download',
        headers: {
          'Dropbox-API-Arg': JSON.stringify({
            path: dropboxPath
          }),
          'Content-Type': 'application/octet-stream'
        },
        responseType: 'stream'
      });

      const writer = fs.createWriteStream(localFilePath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          logger.info(`Successfully downloaded file to: ${localFilePath}`);
          resolve(localFilePath);
        });
        writer.on('error', (error) => {
          logger.error(`Error writing file ${localFilePath}:`, error);
          reject(error);
        });
      });

    } catch (error) {
      logger.error(`Failed to download file ${dropboxPath}:`, error.message);
      logger.error(`Download error details:`, error.response?.data || error);
      throw error;
    }
  }

  // Get file metadata
  async getFileMetadata(filePath) {
    try {
      const response = await this.makeAuthenticatedRequest({
        method: 'POST',
        url: 'https://api.dropboxapi.com/2/files/get_metadata',
        headers: {
          'Content-Type': 'application/json'
        },
        data: {
          path: filePath
        }
      });

      return response.data;
    } catch (error) {
      logger.error(`Failed to get metadata for ${filePath}:`, error.message);
      throw error;
    }
  }

  // List files in monitored folder
  async listFiles() {
    try {
      const response = await this.makeAuthenticatedRequest({
        method: 'POST',
        url: 'https://api.dropboxapi.com/2/files/list_folder',
        headers: {
          'Content-Type': 'application/json'
        },
        data: {
          path: this.folderPath,
          recursive: false
        }
      });

      return response.data.entries.filter(entry => entry['.tag'] === 'file');
    } catch (error) {
      logger.error(`Failed to list files in ${this.folderPath}:`, error.message);
      
      // Provide more helpful error messages
      if (error.response?.status === 401) {
        logger.error('Authentication failed. Please check your Dropbox access token or refresh token configuration.');
        logger.error('To fix this:');
        logger.error('1. Generate a new access token at https://www.dropbox.com/developers/apps');
        logger.error('2. Update your DROPBOX_ACCESS_TOKEN environment variable');
        logger.error('3. Or implement OAuth 2.0 flow with refresh tokens for automatic renewal');
      }
      
      throw error;
    }
  }

  // Clean up downloaded file
  async cleanupFile(localFilePath) {
    try {
      await cleanupTempFile(localFilePath);
    } catch (error) {
      logger.warn(`Failed to cleanup temp file ${localFilePath}:`, error.message);
    }
  }
}

module.exports = DropboxHandler; 