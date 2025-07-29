const axios = require('axios');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const config = require('../config/config');
const { logger, ensureTempDir, cleanupTempFile, isValidAudioFormat, isValidFileSize, sanitizeFilename, generateUniqueFilename } = require('./utils');

class GoogleDriveHandler {
  constructor() {
    this.clientId = config.googleDrive.clientId;
    this.clientSecret = config.googleDrive.clientSecret;
    this.refreshToken = config.googleDrive.refreshToken;
    this.accessToken = config.googleDrive.accessToken;
    this.audioFolderId = config.googleDrive.audioFolderId;
    this.webhookSecret = config.googleDrive.webhookSecret;
    this.recentlyProcessedFiles = new Set();
  }

  // Refresh Google Drive access token
  async refreshAccessToken() {
    try {
      logger.info('Attempting to refresh Google Drive access token');
      
      const response = await axios({
        method: 'POST',
        url: 'https://oauth2.googleapis.com/token',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret
        }).toString()
      });

      this.accessToken = response.data.access_token;
      logger.info('Successfully refreshed Google Drive access token');
      
      return this.accessToken;
    } catch (error) {
      logger.error('Failed to refresh Google Drive access token:', error.response?.data || error.message);
      throw new Error('Failed to refresh Google Drive access token');
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
        logger.warn('Received 401 error from Google Drive, attempting to refresh token and retry');
        
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
          logger.error('Failed to refresh Google Drive token and retry:', refreshError.message);
          throw error;
        }
      }
      
      throw error;
    }
  }

  // List audio files from Google Drive folder
  async listAudioFiles() {
    try {
      logger.info(`Listing audio files from Google Drive folder: ${this.audioFolderId}`);
      
      const response = await this.makeAuthenticatedRequest({
        method: 'GET',
        url: 'https://www.googleapis.com/drive/v3/files',
        params: {
          q: `'${this.audioFolderId}' in parents and trashed=false`,
          fields: 'files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink)',
          orderBy: 'modifiedTime desc'
        }
      });

      const files = response.data.files || [];
      const audioExtensions = ['mp3', 'wav', 'm4a', 'flac', 'aac', 'ogg'];
      
      const audioFiles = files.filter(file => {
        const extension = file.name.toLowerCase().split('.').pop();
        return audioExtensions.includes(extension);
      });

      logger.info(`Found ${audioFiles.length} audio files in Google Drive folder`);
      return audioFiles;
    } catch (error) {
      logger.error('Failed to list audio files from Google Drive:', error.response?.data || error.message);
      throw error;
    }
  }

  // Download file from Google Drive
  async downloadFile(fileId, fileName) {
    try {
      await ensureTempDir();
      
      const uniqueFileName = generateUniqueFilename(sanitizeFilename(fileName));
      const localPath = path.join(config.processing.tempFolder, uniqueFileName);
      
      logger.info(`📥 Downloading file: ${fileName} -> ${uniqueFileName}`);
      
      const response = await this.makeAuthenticatedRequest({
        method: 'GET',
        url: `https://www.googleapis.com/drive/v3/files/${fileId}`,
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

  // Get file metadata
  async getFileMetadata(fileId) {
    try {
      const response = await this.makeAuthenticatedRequest({
        method: 'GET',
        url: `https://www.googleapis.com/drive/v3/files/${fileId}`,
        params: {
          fields: 'id,name,mimeType,size,createdTime,modifiedTime,webViewLink'
        }
      });

      return response.data;
    } catch (error) {
      logger.error(`Failed to get file metadata for ${fileId}:`, error.response?.data || error.message);
      throw error;
    }
  }

  // Process Google Drive webhook notification
  async processWebhookNotification(notification) {
    try {
      logger.info('Processing Google Drive webhook notification', { 
        resourceId: notification.resourceId,
        resourceUri: notification.resourceUri
      });

      // Get all audio files from the monitored folder
      const audioFiles = await this.listAudioFiles();
      
      logger.info(`Found ${audioFiles.length} audio files to process`);
      
      // Filter for recently modified files (within last 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recentFiles = audioFiles.filter(file => {
        const modifiedTime = new Date(file.modifiedTime);
        return modifiedTime > fiveMinutesAgo;
      });

      logger.info(`Found ${recentFiles.length} recently modified audio files`);

      // Process each recent file
      const processedFiles = [];
      for (const file of recentFiles) {
        try {
          logger.info(`Processing audio file: ${file.name}`);
          
          // Check if file was recently processed
          if (this.recentlyProcessedFiles.has(file.id)) {
            logger.info(`⏭️ File ${file.name} was recently processed, skipping`);
            continue;
          }

          // Download the file
          const localPath = await this.downloadFile(file.id, file.name);
          
          // Add to recently processed set
          this.recentlyProcessedFiles.add(file.id);
          
          // Clean up after 5 minutes
          setTimeout(() => {
            this.recentlyProcessedFiles.delete(file.id);
          }, 5 * 60 * 1000);

          processedFiles.push({
            originalPath: file.id,
            localPath: localPath,
            fileName: file.name,
            fileType: 'audio',
            size: file.size,
            modifiedTime: file.modifiedTime,
            webViewLink: file.webViewLink
          });

        } catch (error) {
          logger.error(`Failed to process audio file ${file.name}:`, error.message);
        }
      }

      logger.info(`Successfully processed ${processedFiles.length} audio files from Google Drive`);
      return processedFiles;
    } catch (error) {
      logger.error('Error processing Google Drive webhook notification:', error.message);
      throw error;
    }
  }

  // Verify webhook signature (if configured)
  verifyWebhookSignature(body, signature) {
    if (!this.webhookSecret) {
      logger.warn('No Google Drive webhook secret configured, skipping signature verification');
      return true;
    }

    try {
      logger.info('Verifying webhook signature...');
      logger.info('Body length:', body.length);
      logger.info('Signature received:', signature ? signature.substring(0, 10) + '...' : 'none');
      
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(body)
        .digest('hex');
      
      logger.info('Expected signature:', expectedSignature.substring(0, 10) + '...');
      logger.info('Signatures match:', signature === expectedSignature);
      
      return signature === expectedSignature;
    } catch (error) {
      logger.error('Error verifying Google Drive webhook signature:', error);
      return false;
    }
  }
}

module.exports = GoogleDriveHandler;