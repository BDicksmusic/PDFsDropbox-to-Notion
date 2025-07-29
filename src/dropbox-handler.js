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
    this.audioFolderPath = config.dropbox.folderPath;
    this.pdfFolderPath = config.dropbox.pdfFolderPath;
    this.webhookSecret = config.dropbox.webhookSecret;
    
    // Add file processing deduplication
    this.recentlyProcessedFiles = new Map();
    this.processingLocks = new Map();
  }

  // Refresh access token using refresh token
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
        })
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
      // Add the authorization header and make the request
      const response = await axios({
        ...requestConfig,
        headers: {
          ...requestConfig.headers,
          'Authorization': `Bearer ${this.accessToken}`
        }
      });
      
      return response;
    } catch (error) {
      // If we get a 401 error, try to refresh the token and retry
      if (error.response?.status === 401) {
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
          logger.error('Failed to refresh token and retry:', refreshError.message);
          throw error; // Re-throw the original error
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

  // Process webhook notification
  async processWebhookNotification(notification) {
    try {
      logger.info('Processing Dropbox webhook notification', { 
        listFolder: notification.list_folder 
      });

      // When we receive a webhook, we need to check both folders for new files
      logger.info('Checking folders for files after webhook notification');
      
             const files = await this.listFiles();
       
       // Debug: Show all files before filtering
       const allFiles = files.filter(entry => entry['.tag'] === 'file');
       logger.info(`📁 All files found before filtering:`);
       allFiles.forEach((file, index) => {
         logger.info(`  ${index + 1}. ${file.name} (path: ${file.path_lower})`);
       });
       
                             // Get all files and filter by extension instead of folder path
        const audioExtensions = ['mp3', 'wav', 'm4a', 'flac', 'aac', 'ogg'];
        const documentExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'bmp', 'tiff', 'tif', 'webp', 'docx', 'doc'];
        
        const audioFiles = files.filter(entry => {
          const isFile = entry['.tag'] === 'file';
          if (!isFile) return false;
          
          const extension = entry.name.toLowerCase().split('.').pop();
          const isAudioFile = audioExtensions.includes(extension);
          
          // Debug logging for audio files
          logger.info(`🔍 Audio extension check: "${entry.name}" (${extension}) = ${isAudioFile}`);
          if (!isAudioFile) {
            logger.debug(`❌ Not audio file: ${entry.path_lower} (extension: ${extension})`);
          } else {
            logger.info(`✅ Audio file found: ${entry.name} (${extension})`);
          }
          
          return isAudioFile;
        });

        const pdfFiles = files.filter(entry => {
          const isFile = entry['.tag'] === 'file';
          if (!isFile) return false;
          
          const extension = entry.name.toLowerCase().split('.').pop();
          const isDocumentFile = documentExtensions.includes(extension);
          
          // Debug logging for document files
          logger.info(`🔍 Document extension check: "${entry.name}" (${extension}) = ${isDocumentFile}`);
          if (!isDocumentFile) {
            logger.debug(`❌ Not document file: ${entry.path_lower} (extension: ${extension})`);
          } else {
            logger.info(`✅ Document file found: ${entry.name} (${extension})`);
          }
          
          return isDocumentFile;
        });

             logger.info(`Found ${audioFiles.length} audio files, ${pdfFiles.length} document files (filtered by extension)`);
       
       // Debug: Log the extensions we're looking for
       logger.info(`Audio extensions: ${audioExtensions.join(', ')}`);
       logger.info(`Document extensions: ${documentExtensions.join(', ')}`);
      
             // Debug: Log all file paths to see what we're getting
       const allFilePaths = files.filter(entry => entry['.tag'] === 'file').map(entry => entry.path_lower);
       logger.info(`All file paths found: ${JSON.stringify(allFilePaths)}`);
       
       // Debug: Log original paths vs lowercase paths
       const fileDetails = files.filter(entry => entry['.tag'] === 'file').map(entry => ({
         original: entry.path_display,
         lower: entry.path_lower,
         name: entry.name
       }));
       logger.info(`File details: ${JSON.stringify(fileDetails)}`);
      
      // Debug: Log which files match each folder
      if (audioFiles.length > 0) {
        logger.info(`Audio files found: ${audioFiles.map(f => f.path_lower).join(', ')}`);
      }
      if (pdfFiles.length > 0) {
        logger.info(`PDF files found: ${pdfFiles.map(f => f.path_lower).join(', ')}`);
      }

             // Process all files found - let duplicate detection handle whether to create new entries
       logger.info(`Ready to process: ${audioFiles.length} audio files, ${pdfFiles.length} document files`);

      const processedFiles = [];
      
      // Process audio files
      for (const file of audioFiles) {
        try {
          logger.info(`Attempting to process audio file: ${file.path_lower} (${file.name})`);
          const processedFile = await this.processFile(file, 'audio');
          if (processedFile) {
            processedFiles.push(processedFile);
            logger.info(`Successfully processed audio file: ${file.name}`);
          } else {
            logger.warn(`Skipping audio file ${file.path_lower}: already processed or failed validation`);
          }
        } catch (error) {
          logger.error(`Failed to process audio file ${file.path_lower}:`, error.message);
        }
      }

      // Process PDF files
      for (const file of pdfFiles) {
        try {
          logger.info(`Attempting to process PDF file: ${file.path_lower} (${file.name})`);
          const processedFile = await this.processFile(file, 'document');
          if (processedFile) {
            processedFiles.push(processedFile);
            logger.info(`Successfully processed PDF file: ${file.name}`);
          } else {
            logger.warn(`Skipping PDF file ${file.path_lower}: already processed or failed validation`);
          }
        } catch (error) {
          logger.error(`Failed to process PDF file ${file.path_lower}:`, error.message);
        }
      }

      logger.info(`Successfully processed ${processedFiles.length} files total`);
      return processedFiles;
    } catch (error) {
      logger.error('Error processing webhook notification:', error);
      throw error;
    }
  }

  // Process individual file
  async processFile(fileEntry, fileType = null) {
    const filePath = fileEntry.path_lower;
    const originalPath = fileEntry.path_display || fileEntry.path_lower; // Use original case-sensitive path
    const fileName = path.basename(filePath);
    const sanitizedFileName = sanitizeFilename(fileName);

    logger.info(`🔍 Processing file: ${fileName} (type: ${fileType || 'auto-detect'}, size: ${fileEntry.size} bytes)`);
    logger.debug(`File details - Original path: ${originalPath}, Lower path: ${filePath}`);

    // Check if we're currently processing this file
    if (this.processingLocks.has(filePath)) {
      logger.info(`⏳ File ${fileName} is currently being processed, skipping`);
      return null;
    }

    // Check if we've recently processed this file (within last 2 minutes)
    const recentlyProcessed = this.recentlyProcessedFiles.get(filePath);
    if (recentlyProcessed && (Date.now() - recentlyProcessed) < 2 * 60 * 1000) {
      logger.info(`⏭️ File ${fileName} was recently processed, skipping`);
      return null;
    }

    // Mark file as being processed
    this.processingLocks.set(filePath, Date.now());

    try {
      // Auto-detect file type if not provided
      if (!fileType) {
        fileType = this.detectFileType(fileName);
        logger.debug(`🔍 Auto-detected file type: ${fileType} for ${fileName}`);
      }

      // Validate file format based on type
      if (fileType === 'audio' && !isValidAudioFormat(fileName)) {
        logger.warn(`❌ Skipping file ${fileName}: unsupported audio format`);
        return null;
      } else if (fileType === 'document' && !this.isValidDocumentFormat(fileName)) {
        logger.warn(`❌ Skipping file ${fileName}: unsupported document format`);
        return null;
      }

      // Validate file size
      if (!isValidFileSize(fileEntry.size)) {
        logger.warn(`❌ Skipping file ${fileName}: file too large (${fileEntry.size} bytes)`);
        return null;
      }

      logger.debug(`✅ File ${fileName} passed validation checks`);

      // Check for problematic characters in filename
      const problematicChars = /[<>:"/\\|?*\x00-\x1f]/g;
      if (problematicChars.test(fileName)) {
        logger.warn(`Skipping file ${fileName}: contains problematic characters for file system`);
        return null;
      }

      // Check for special characters in the full path that might cause API issues
      if (filePath.includes('\\') || filePath.includes('//')) {
        logger.warn(`Skipping file ${fileName}: path contains problematic characters`);
        return null;
      }

      // Download the file using original case-sensitive path
      const localPath = await this.downloadFile(originalPath, sanitizedFileName);
      
      // Get shareable URL for tracking using original case-sensitive path
      let shareableUrl = null;
      try {
        shareableUrl = await this.getShareableUrl(originalPath);
      } catch (error) {
        logger.warn(`Failed to get shareable URL for ${fileName}:`, error.message);
      }

      // Mark as recently processed
      this.recentlyProcessedFiles.set(filePath, Date.now());

      // Clean up processing lock
      this.processingLocks.delete(filePath);

      logger.info(`Successfully processed file ${fileName} (${fileType})`);
      
      return {
        originalPath: filePath,
        fileName: sanitizedFileName,
        localPath: localPath,
        size: fileEntry.size,
        modified: fileEntry.server_modified,
        shareableUrl: shareableUrl,
        fileType: fileType
      };

    } catch (error) {
      logger.error(`Failed to process file ${fileName}:`, error);
      
      // Clean up processing lock on error
      this.processingLocks.delete(filePath);
      
      return null;
    }
  }

  // Detect file type based on extension
  detectFileType(fileName) {
    const extension = fileName.toLowerCase().split('.').pop();
    
    // Audio files
    const audioExtensions = ['mp3', 'wav', 'm4a', 'flac', 'aac', 'ogg'];
    if (audioExtensions.includes(extension)) {
      return 'audio';
    }
    
    // Document files
    const documentExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'bmp', 'tiff', 'tif', 'webp', 'docx', 'doc'];
    if (documentExtensions.includes(extension)) {
      return 'document';
    }
    
    return 'unknown';
  }

  // Check if file is a valid document format
  isValidDocumentFormat(fileName) {
    const extension = fileName.toLowerCase().split('.').pop();
    const documentExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'bmp', 'tiff', 'tif', 'webp', 'docx', 'doc'];
    return documentExtensions.includes(extension);
  }

  // Get shareable URL for a file
  async getShareableUrl(filePath) {
    try {
      // First, try to create a new shared link
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

      return response.data.url;
    } catch (error) {
      // If the link already exists, get the existing link
      const errorTag = error.response?.data?.error?.['.tag'];
      const errorSummary = error.response?.data?.error_summary;
      
      if (errorTag === 'shared_link_already_exists' || errorSummary?.includes('shared_link_already_exists')) {
        logger.info(`Shared link already exists for ${filePath}, getting existing link`);
        
        try {
          const existingLinkResponse = await this.makeAuthenticatedRequest({
            method: 'POST',
            url: 'https://api.dropboxapi.com/2/sharing/list_shared_links',
            headers: {
              'Content-Type': 'application/json'
            },
            data: {
              path: filePath,
              direct_only: false
            }
          });

          if (existingLinkResponse.data.links && existingLinkResponse.data.links.length > 0) {
            return existingLinkResponse.data.links[0].url;
          } else {
            throw new Error('No existing shared link found');
          }
        } catch (existingLinkError) {
          logger.error(`Failed to get existing shared link for ${filePath}:`, existingLinkError.response?.data || existingLinkError.message);
          throw existingLinkError;
        }
      } else {
        logger.warn(`Failed to get shareable URL for ${filePath}:`, error.response?.data || error.message);
        // Don't throw error for shareable URL issues, just return null
        return null;
      }
    }
  }

  // Download file from Dropbox
  async downloadFile(dropboxPath, fileName) {
    try {
      // Ensure temp directory exists
      await ensureTempDir();
      
      const localPath = path.join(config.processing.tempFolder, fileName);
      
      logger.info(`Downloading file from Dropbox: ${dropboxPath} -> ${localPath}`);

      // Debug: Log the API request details
      const apiArg = JSON.stringify({ path: dropboxPath });
      logger.info(`Dropbox API request - URL: https://content.dropboxapi.com/2/files/download, Path: ${dropboxPath}, API-Arg: ${apiArg}`);

      // Use direct axios call for download with proper headers
      const response = await axios({
        method: 'POST',
        url: 'https://content.dropboxapi.com/2/files/download',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Dropbox-API-Arg': apiArg,
          'Content-Type': 'text/plain'  // Dropbox requires this specific Content-Type
        },
        data: '',  // Send empty body as required by Dropbox API
        responseType: 'stream',
        validateStatus: () => true
      });

      // Create write stream
      const writer = fs.createWriteStream(localPath);
      
      // Pipe the response to the file
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          logger.info(`Successfully downloaded file: ${fileName}`);
          resolve(localPath);
        });
        
        writer.on('error', (error) => {
          logger.error(`Failed to write file ${fileName}:`, error);
          reject(error);
        });
        
        response.data.on('error', (error) => {
          logger.error(`Failed to download file ${fileName}:`, error);
          reject(error);
        });
      });

         } catch (error) {
       // Try to extract the actual error message from the response
       let errorMessage = error.message;
       if (error.response?.data) {
         try {
           // If it's a stream, try to read it
           if (error.response.data.pipe) {
             let errorData = '';
             error.response.data.on('data', chunk => {
               errorData += chunk.toString();
             });
             error.response.data.on('end', () => {
               logger.error(`Dropbox API error details: ${errorData}`);
             });
           } else {
             errorMessage = JSON.stringify(error.response.data);
           }
         } catch (parseError) {
           errorMessage = `Response data: ${JSON.stringify(error.response.data)}`;
         }
       }
       
       logger.error(`Failed to download file ${fileName}: ${errorMessage}`);
       logger.error(`Request details - Path: ${dropboxPath}, Status: ${error.response?.status}`);
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
      logger.error(`Failed to get metadata for ${filePath}:`, error.response?.data || error.message);
      throw error;
    }
  }

  // List files in Dropbox
  async listFiles() {
    try {
      logger.info(`Listing files from specific folders: audio folder: ${this.audioFolderPath}, PDF folder: ${this.pdfFolderPath}`);
      
      const allFiles = [];
      
      // List files from audio folder
      try {
        const audioResponse = await this.makeAuthenticatedRequest({
          method: 'POST',
          url: 'https://api.dropboxapi.com/2/files/list_folder',
          headers: {
            'Content-Type': 'application/json'
          },
          data: {
            path: this.audioFolderPath,
            recursive: true,
            include_media_info: false,
            include_deleted: false,
            include_has_explicit_shared_members: false,
            include_mounted_folders: true,
            include_non_downloadable_files: false
          }
        });
        
        logger.info(`Received ${audioResponse.data.entries.length} entries from audio folder`);
        allFiles.push(...audioResponse.data.entries);
      } catch (error) {
        logger.warn(`Failed to list audio folder ${this.audioFolderPath}:`, error.response?.data || error.message);
      }
      
      // List files from PDF folder
      try {
        const pdfResponse = await this.makeAuthenticatedRequest({
          method: 'POST',
          url: 'https://api.dropboxapi.com/2/files/list_folder',
          headers: {
            'Content-Type': 'application/json'
          },
          data: {
            path: this.pdfFolderPath,
            recursive: true,
            include_media_info: false,
            include_deleted: false,
            include_has_explicit_shared_members: false,
            include_mounted_folders: true,
            include_non_downloadable_files: false
          }
        });
        
        logger.info(`Received ${pdfResponse.data.entries.length} entries from PDF folder`);
        allFiles.push(...pdfResponse.data.entries);
      } catch (error) {
        logger.warn(`Failed to list PDF folder ${this.pdfFolderPath}:`, error.response?.data || error.message);
      }

      logger.info(`Total entries found: ${allFiles.length}`);
      
      // Log all file entries for debugging
      allFiles.forEach((entry, index) => {
        if (entry['.tag'] === 'file') {
          logger.debug(`Entry ${index}: ${entry.path_lower} (modified: ${entry.server_modified})`);
        }
      });

      return allFiles;
    } catch (error) {
      logger.error('Failed to list files:', error.response?.data || error.message);
      throw error;
    }
  }

  // Clean up local file
  async cleanupFile(localFilePath) {
    try {
      if (localFilePath && fs.existsSync(localFilePath)) {
        await cleanupTempFile(localFilePath);
        logger.info(`Cleaned up temporary file: ${path.basename(localFilePath)}`);
      }
    } catch (error) {
      logger.warn(`Failed to cleanup file ${localFilePath}:`, error.message);
    }
  }
}

module.exports = DropboxHandler; 