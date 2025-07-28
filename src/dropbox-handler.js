const axios = require('axios');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const config = require('../config/config');
const { logger, ensureTempDir, cleanupTempFile, isValidAudioFormat, isValidFileSize, sanitizeFilename } = require('./utils');

class DropboxHandler {
  constructor() {
    this.accessToken = config.dropbox.accessToken;
    this.refreshToken = config.dropbox.refreshToken;
    this.appKey = config.dropbox.appKey;
    this.appSecret = config.dropbox.appSecret;
    this.folderPath = config.dropbox.folderPath;
    this.webhookSecret = config.dropbox.webhookSecret;
    
    // Add file processing deduplication
    this.recentlyProcessedFiles = new Map();
    this.processingLocks = new Map();
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

      // Filter for files that were modified recently (within the last 5 minutes)
      // This prevents processing old files on every webhook
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recentFiles = allFiles.filter(file => {
        const modifiedTime = new Date(file.server_modified);
        const isRecent = modifiedTime > fiveMinutesAgo;
        if (!isRecent) {
          logger.debug(`Skipping old file ${file.path_lower}: modified ${modifiedTime.toISOString()}`);
        }
        return isRecent;
      });

      logger.info(`Found ${recentFiles.length} recently modified files (within last 5 minutes)`);

      const processedFiles = [];
      for (const file of recentFiles) {
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
    const sanitizedFileName = sanitizeFilename(fileName);

    logger.info(`Checking file: ${fileName}`);

    // Check if we're currently processing this file
    if (this.processingLocks.has(filePath)) {
      logger.info(`File ${fileName} is currently being processed, skipping`);
      return null;
    }

    // Check if we've recently processed this file (within last 2 minutes)
    const recentlyProcessed = this.recentlyProcessedFiles.get(filePath);
    if (recentlyProcessed && (Date.now() - recentlyProcessed) < 2 * 60 * 1000) {
      logger.info(`File ${fileName} was recently processed, skipping`);
      return null;
    }

    // Mark file as being processed
    this.processingLocks.set(filePath, Date.now());

    try {
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

      // Check for problematic characters in filename
      const problematicChars = /[<>:"/\\|?*\x00-\x1f]/g;
      if (problematicChars.test(fileName)) {
        logger.warn(`Skipping file ${fileName}: contains problematic characters for file system`);
        return null;
      }

      // Check for special characters in the full path that might cause API issues
      if (/[^\x00-\x7F]/.test(filePath)) {
        logger.warn(`Skipping file ${fileName}: path contains special characters that may cause API issues`);
        logger.warn(`Problematic path: ${filePath}`);
        return null;
      }

      // Get shareable URL for the file
      let shareableUrl = null;
      try {
        shareableUrl = await this.getShareableUrl(filePath);
        logger.info(`Successfully obtained shareable URL for ${fileName}`);
      } catch (error) {
        logger.error(`Failed to get shareable URL for ${fileName}:`, error.message);
        // Continue without shareable URL - will use filename-based tracking
      }

      // Download the file
      const localFilePath = await this.downloadFile(filePath, sanitizedFileName);
      if (!localFilePath) {
        logger.error(`Failed to download file ${fileName}`);
        return null;
      }

      // Mark file as recently processed
      this.recentlyProcessedFiles.set(filePath, Date.now());

      // Clean up old entries (keep last 50 files)
      if (this.recentlyProcessedFiles.size > 50) {
        const entries = Array.from(this.recentlyProcessedFiles.entries());
        this.recentlyProcessedFiles = new Map(entries.slice(-25));
      }

      return {
        fileName: fileName,
        originalPath: filePath,
        localPath: localFilePath,
        shareableUrl: shareableUrl,
        size: fileEntry.size,
        modified: fileEntry.server_modified
      };

    } catch (error) {
      logger.error(`Failed to process file ${fileName}:`, error.message);
      return null;
    } finally {
      // Remove from processing locks
      this.processingLocks.delete(filePath);
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

      // Handle special characters in the file path
      // Dropbox API expects the path to be properly formatted
      let safePath = dropboxPath;
      
      // If the path contains special characters, try to encode them
      if (/[^\x00-\x7F]/.test(dropboxPath)) {
        logger.warn(`File path contains special characters: ${dropboxPath}`);
        // For now, we'll skip files with problematic characters
        throw new Error(`File path contains special characters that cannot be processed: ${dropboxPath}`);
      }

      // Ensure the Dropbox-API-Arg header is properly formatted
      const dropboxApiArg = {
        path: safePath
      };

      // Convert to JSON string and ensure it's properly encoded
      const headerValue = JSON.stringify(dropboxApiArg);
      
      logger.info(`Dropbox-API-Arg header value: ${headerValue}`);

      const response = await this.makeAuthenticatedRequest({
        method: 'POST',
        url: 'https://content.dropboxapi.com/2/files/download',
        headers: {
          'Dropbox-API-Arg': headerValue,
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
      
      // Add more specific error handling for header issues
      if (error.message.includes('Invalid character in header content')) {
        logger.error('Header encoding issue detected. This may be due to special characters in the file path.');
        logger.error('File path:', dropboxPath);
        logger.error('File name:', fileName);
        logger.error('Try renaming the file to remove special characters.');
        
        // Try to suggest a sanitized version
        const sanitizedPath = dropboxPath.replace(/[^\x00-\x7F]/g, '');
        logger.error('Sanitized path suggestion:', sanitizedPath);
      }
      
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