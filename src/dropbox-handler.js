const axios = require('axios');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const config = require('../config/config');
const { logger, ensureTempDir, cleanupTempFile, isValidAudioFormat, isValidFileSize, sanitizeFilename, generateUniqueFilename } = require('./utils');

class DropboxHandler {
  constructor() {
    this.accessToken = config.dropbox.accessToken;
    this.refreshToken = config.dropbox.refreshToken;
    this.appKey = config.dropbox.appKey;
    this.appSecret = config.dropbox.appSecret;
    this.webhookSecret = config.dropbox.webhookSecret;
    this.audioFolderPath = config.dropbox.folderPath;
    this.pdfFolderPath = config.dropbox.pdfFolderPath;
    this.recentlyProcessedFiles = new Set();
  }

  // Refresh Dropbox access token
  async refreshAccessToken() {
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
        }).toString()
      });

      this.accessToken = response.data.access_token;
      logger.info('Successfully refreshed Dropbox access token');
      
      return this.accessToken;
    } catch (error) {
      logger.error('Failed to refresh access token:', error.response?.data || error.message);
      throw new Error('Failed to refresh access token');
    }
  }

  // Make authenticated request with automatic token refresh
  async makeAuthenticatedRequest(requestConfig) {
    try {
      const response = await axios({
        ...requestConfig,
        headers: {
          ...requestConfig.headers,
          'Authorization': `Bearer ${this.accessToken}`
        }
      });
      
      return response;
    } catch (error) {
      if (error.response?.status === 401) {
        logger.warn('Received 401 error, attempting to refresh token and retry');
        
        try {
          await this.refreshAccessToken();
          
          const retryResponse = await axios({
            ...requestConfig,
            headers: {
              ...requestConfig.headers,
              'Authorization': `Bearer ${this.accessToken}`
            }
          });
          
          return retryResponse;
        } catch (refreshError) {
          logger.error('Failed to refresh token and retry:', refreshError.message);
          throw error;
        }
      }
      
      throw error;
    }
  }

  // Verify webhook signature
  verifyWebhookSignature(body, signature) {
    if (!this.webhookSecret) {
      logger.warn('No webhook secret configured, skipping signature verification');
      return true;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(body)
        .digest('hex');

      return signature === expectedSignature;
    } catch (error) {
      logger.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  // List all files from Dropbox (generic method for scripts)
  async listFiles() {
    try {
      logger.info('Listing all files from Dropbox root');
      
      const response = await this.makeAuthenticatedRequest({
        method: 'POST',
        url: 'https://api.dropboxapi.com/2/files/list_folder',
        data: {
          path: '',
          recursive: true
        }
      });

      const entries = response.data.entries || [];
      logger.info(`Found ${entries.length} total entries in Dropbox`);
      return entries;
    } catch (error) {
      logger.error('Failed to list files from Dropbox:', error.response?.data || error.message);
      throw error;
    }
  }

  // List document files from Dropbox PDF folder
  async listDocumentFiles() {
    try {
      logger.info(`Listing document files from Dropbox folder: ${this.pdfFolderPath}`);
      
      const response = await this.makeAuthenticatedRequest({
        method: 'POST',
        url: 'https://api.dropboxapi.com/2/files/list_folder',
        data: {
          path: this.pdfFolderPath,
          recursive: false
        }
      });

      const files = response.data.entries || [];
      const documentExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'bmp', 'tiff', 'tif', 'webp', 'docx', 'doc'];
      
      const documentFiles = files.filter(entry => {
        if (entry['.tag'] !== 'file') return false;
        
        const extension = entry.name.toLowerCase().split('.').pop();
        const isDocumentFile = documentExtensions.includes(extension);
        
        logger.info(`🔍 Document extension check: "${entry.name}" (${extension}) = ${isDocumentFile}`);
        if (isDocumentFile) {
          logger.info(`✅ Document file found: ${entry.name} (${extension})`);
        }
        
        return isDocumentFile;
      });

      logger.info(`Found ${documentFiles.length} document files in Dropbox folder`);
      return documentFiles;
    } catch (error) {
      logger.error('Failed to list document files from Dropbox:', error.response?.data || error.message);
      throw error;
    }
  }

  // Download file from Dropbox
  async downloadFile(dropboxPath, fileName) {
    try {
      await ensureTempDir();
      
      const uniqueFileName = generateUniqueFilename(sanitizeFilename(fileName));
      const localPath = path.join(config.processing.tempFolder, uniqueFileName);
      
      logger.info(`📥 Downloading file: ${fileName} -> ${uniqueFileName}`);
      
      const response = await this.makeAuthenticatedRequest({
        method: 'POST',
        url: 'https://content.dropboxapi.com/2/files/download',
        headers: {
          'Dropbox-API-Arg': JSON.stringify({ path: dropboxPath }),
          'Content-Type': 'text/plain'
        },
        responseType: 'stream'
      });

      const writer = fs.createWriteStream(localPath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          logger.info(`Successfully downloaded file: ${uniqueFileName}`);
          resolve(localPath);
        });
        writer.on('error', reject);
      });
    } catch (error) {
      logger.error(`Failed to download file ${fileName}:`, error.response?.data || error.message);
      throw error;
    }
  }

  // Create shareable link for a file
  async createShareableLink(dropboxPath) {
    try {
      const response = await this.makeAuthenticatedRequest({
        method: 'POST',
        url: 'https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings',
        data: {
          path: dropboxPath,
          settings: {
            requested_visibility: 'public',
            audience: 'public',
            access: 'viewer'
          }
        }
      });

      return response.data.url;
    } catch (error) {
      // If link already exists, get the existing link
      if (error.response?.status === 409 && error.response?.data?.error?.['.tag'] === 'shared_link_already_exists') {
        logger.info(`Shareable link already exists for ${dropboxPath}, getting existing link`);
        
        try {
          const existingLinkResponse = await this.makeAuthenticatedRequest({
            method: 'POST',
            url: 'https://api.dropboxapi.com/2/sharing/list_shared_links',
            data: {
              path: dropboxPath,
              direct_only: false
            }
          });

          if (existingLinkResponse.data.links && existingLinkResponse.data.links.length > 0) {
            return existingLinkResponse.data.links[0].url;
          }
        } catch (getLinkError) {
          logger.error(`Failed to get existing shareable link for ${dropboxPath}:`, getLinkError.response?.data || getLinkError.message);
        }
      }
      
      logger.error(`Failed to create shareable link for ${dropboxPath}:`, error.response?.data || error.message);
      throw error;
    }
  }

  // Process Dropbox webhook notification for documents only
  async processWebhookNotification(notification) {
    try {
      logger.info('Processing Dropbox webhook notification for documents', { 
        listFolder: notification.list_folder 
      });

      logger.info('Checking Dropbox folder for document files after webhook notification');
      
      const documentFiles = await this.listDocumentFiles();
      
      logger.info(`Found ${documentFiles.length} document files to process`);
      
      // Filter for recently modified files (within last 30 minutes for consistency)
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      const recentFiles = documentFiles.filter(file => {
        const modifiedTime = new Date(file.server_modified);
        const isRecent = modifiedTime > thirtyMinutesAgo;
        
        logger.info(`File ${file.name}: modified ${modifiedTime.toISOString()}, recent: ${isRecent}`);
        
        return isRecent;
      });

      logger.info(`Found ${recentFiles.length} recently modified document files`);

      // Process each recent file
      const processedFiles = [];
      for (const file of recentFiles) {
        try {
          logger.info(`Processing document file: ${file.name}`);
          
          // Check if file was recently processed
          if (this.recentlyProcessedFiles.has(file.id)) {
            logger.info(`⏭️ File ${file.name} was recently processed, skipping`);
            continue;
          }

          // Download the file
          const localPath = await this.downloadFile(file.path_display, file.name);
          
          // Create shareable link
          const shareableUrl = await this.createShareableLink(file.path_display);
          
          // Add to recently processed set
          this.recentlyProcessedFiles.add(file.id);
          
          // Clean up after 5 minutes
          setTimeout(() => {
            this.recentlyProcessedFiles.delete(file.id);
          }, 5 * 60 * 1000);

          processedFiles.push({
            originalPath: file.path_display,
            localPath: localPath,
            fileName: file.name,
            fileType: 'document',
            size: file.size,
            serverModified: file.server_modified,
            shareableUrl: shareableUrl
          });

        } catch (error) {
          logger.error(`Failed to process document file ${file.name}:`, error.message);
        }
      }

      logger.info(`Successfully processed ${processedFiles.length} document files from Dropbox`);
      return processedFiles;
    } catch (error) {
      logger.error('Error processing Dropbox webhook notification:', error.message);
      throw error;
    }
  }
}

module.exports = DropboxHandler; 