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
    this.webhookSecret = config.dropbox.webhookSecret;
    this.folderPath = config.dropbox.folderPath;
    this.processedFiles = new Set(); // Track processed files to prevent duplicates
    this.processingFiles = new Set(); // Track files currently being processed
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
      // The webhook just tells us something changed, not what specifically
      logger.info('Checking folder for new files after webhook notification');
      
      const files = await this.listFiles();
      
      // Filter for new files that haven't been processed yet
      const newFiles = files.filter(entry => 
        entry['.tag'] === 'file' && 
        entry.path_lower.startsWith(this.folderPath.toLowerCase()) &&
        !this.processedFiles.has(entry.path_lower) &&
        !this.processingFiles.has(entry.path_lower)
      );

      logger.info(`Found ${newFiles.length} new files in monitored folder`);

      const processedFiles = [];
      for (const file of newFiles) {
        try {
          // Mark file as being processed
          this.processingFiles.add(file.path_lower);
          
          const processedFile = await this.processFile(file);
          if (processedFile) {
            processedFiles.push(processedFile);
            // Mark file as successfully processed
            this.processedFiles.add(file.path_lower);
          } else {
            logger.warn(`Skipping file ${file.path_lower}: download or processing failed`);
          }
        } catch (error) {
          logger.error(`Failed to process file ${file.path_lower}:`, error.message);
          // Don't mark as processed if it failed
        } finally {
          // Always remove from processing set
          this.processingFiles.delete(file.path_lower);
        }
      }

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

    logger.info(`Processing file: ${fileName}`);
    logger.info(`File path: ${filePath}, Folder path: ${this.folderPath}`);

    // Check if file was already processed
    if (this.processedFiles.has(filePath)) {
      logger.info(`File ${fileName} already processed, skipping`);
      return null;
    }

    // Check if file is currently being processed
    if (this.processingFiles.has(filePath)) {
      logger.info(`File ${fileName} is currently being processed, skipping`);
      return null;
    }

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

    // Download file
    try {
      const localFilePath = await this.downloadFile(filePath, fileName);
      
      return {
        originalPath: filePath,
        fileName: fileName,
        localPath: localFilePath,
        size: fileEntry.size,
        modified: fileEntry.server_modified
      };
    } catch (error) {
      logger.error(`Failed to download file ${fileName}:`, error.message);
      return null; // Return null to indicate download failure
    }
  }

  // Download file from Dropbox
  async downloadFile(dropboxPath, fileName) {
    try {
      await ensureTempDir();
      
      const localFilePath = path.join(config.processing.tempFolder, fileName);
      
      logger.info(`Downloading file from Dropbox: ${dropboxPath}`);

      const response = await axios({
        method: 'POST',
        url: 'https://content.dropboxapi.com/2/files/download',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
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
      const response = await axios({
        method: 'POST',
        url: 'https://api.dropboxapi.com/2/files/get_metadata',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
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
      const response = await axios({
        method: 'POST',
        url: 'https://api.dropboxapi.com/2/files/list_folder',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
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

  // Get list of processed files (for debugging)
  getProcessedFiles() {
    return Array.from(this.processedFiles);
  }

  // Clear processed files list (for testing/reset)
  clearProcessedFiles() {
    this.processedFiles.clear();
    this.processingFiles.clear();
  }
}

module.exports = DropboxHandler; 