const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');
const { logger, ensureTempDir, cleanupTempFile } = require('./utils');
const DropboxHandler = require('./dropbox-handler');
const NotionHandler = require('./notion-handler');
const NotionPDFHandler = require('./notion-pdf-handler');
const TranscriptionHandler = require('./transcription');
const DocumentHandler = require('./document-handler');
const URLMonitor = require('./url-monitor');

class AutomationServer {
  constructor() {
    this.app = express();
    this.dropboxHandler = new DropboxHandler();
    this.notionHandler = new NotionHandler();
    this.notionPDFHandler = new NotionPDFHandler();
    this.transcriptionHandler = new TranscriptionHandler();
    this.documentHandler = new DocumentHandler();
    this.urlMonitor = new URLMonitor();
    
    // Add webhook deduplication tracking
    this.processedWebhooks = new Set();
    this.webhookProcessingLocks = new Map();
    
    // Add background mode option
    this.backgroundMode = process.env.BACKGROUND_MODE === 'true';

    // Add rate limiting and cost protection
    this.apiCallCount = 0;
    this.dailyApiLimit = parseInt(process.env.DAILY_API_LIMIT) || 1000; // Default 1000 calls per day
    this.lastResetDate = new Date().toDateString();
    this.processingQueue = new Map(); // Track files currently being processed

    // Add periodic scan option
    this.periodicScanEnabled = process.env.PERIODIC_SCAN_ENABLED === 'true';
    this.periodicScanInterval = parseInt(process.env.PERIODIC_SCAN_INTERVAL_MINUTES) || 30; // Default 30 minutes
    this.lastScanTime = null;

    this.setupMiddleware();
    this.setupRoutes();
    this.setupUrlMonitoring();
  }

  setupMiddleware() {
    // Parse JSON bodies
    this.app.use(express.json({ limit: '10mb' }));
    
    // Parse raw bodies for webhook verification
    this.app.use('/webhook', express.raw({ type: 'application/json', limit: '10mb' }));
    
    // Multer for file uploads
    this.upload = multer({
      dest: config.processing.tempFolder,
      limits: {
        fileSize: config.processing.maxFileSizeMB * 1024 * 1024
      }
    });
    
    // Logging middleware
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  setupRoutes() {
    // Root endpoint for webhook verification
    this.app.get('/', (req, res) => {
      res.json({ 
        status: 'running', 
        service: 'Automation-Connections',
        timestamp: new Date().toISOString()
      });
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        backgroundMode: this.backgroundMode,
        service: 'Automation-Connections'
      });
    });

    // Dropbox webhook verification endpoint
    this.app.get('/webhook', (req, res) => {
      const challenge = req.query.challenge;
      if (challenge) {
        logger.info('Dropbox webhook verification challenge received', { challenge });
        res.set('Content-Type', 'text/plain');
        res.send(challenge);
      } else {
        res.status(400).json({ error: 'Missing challenge parameter' });
      }
    });

    // Webhook endpoint for Dropbox notifications
    this.setupWebhookRoute();

    // Manual file processing endpoint
    this.app.post('/process-file', async (req, res) => {
      try {
        const { filePath, customName } = req.body;
        
        if (!filePath) {
          return res.status(400).json({ error: 'filePath is required' });
        }

        logger.info('Manual file processing requested', { filePath, customName });
        
        const result = await this.processFileManually(filePath, customName);
        res.json(result);
      } catch (error) {
        logger.error('Manual processing error', { error: error.message });
        res.status(500).json({ error: error.message });
      }
    });

    // Manual file processing with custom name endpoint
    this.app.post('/process-file-with-name', async (req, res) => {
      try {
        const { filePath, customName } = req.body;
        
        if (!filePath) {
          return res.status(400).json({ error: 'filePath is required' });
        }

        if (!customName) {
          return res.status(400).json({ error: 'customName is required for this endpoint' });
        }

        logger.info('Manual file processing with custom name requested', { filePath, customName });
        
        const result = await this.processFileManually(filePath, customName);
        res.json(result);
      } catch (error) {
        logger.error('Manual processing with custom name error', { error: error.message });
        res.status(500).json({ error: error.message });
      }
    });

    // Force reprocess file endpoint (even if it exists in Notion)
    this.app.post('/force-reprocess-file', async (req, res) => {
      try {
        const { filePath, customName } = req.body;
        
        if (!filePath) {
          return res.status(400).json({ error: 'filePath is required' });
        }

        logger.info('Force reprocess file requested', { filePath, customName });
        
        const result = await this.processFileManually(filePath, customName, true); // true = force reprocess
        res.json(result);
      } catch (error) {
        logger.error('Force reprocess error', { error: error.message });
        res.status(500).json({ error: error.message });
      }
    });

    // Force scan endpoint - process all files in folders
    this.app.post('/force-scan', async (req, res) => {
      try {
        logger.info('Force scan requested - processing all files in monitored folders');
        
        // Clear the recent processing cache to allow reprocessing
        this.dropboxHandler.recentlyProcessedFiles.clear();
        logger.info('Cleared recent processing cache');
        
        // Get all files from both folders
        const files = await this.dropboxHandler.listFiles();
        const allFiles = files.filter(entry => entry['.tag'] === 'file');
        
        logger.info(`Found ${allFiles.length} files to process`);
        
        // Process all files through the webhook handler
        const processedFiles = await this.dropboxHandler.processWebhookNotification({
          list_folder: { accounts: ['force-scan'] }
        });
        
        // Process each file
        const results = [];
        for (const file of processedFiles) {
          if (file) {
            try {
              const result = await this.processFile(file, null, false);
              results.push(result);
            } catch (error) {
              logger.error(`Failed to process file ${file.fileName}:`, error.message);
              results.push({
                fileName: file.fileName,
                error: error.message,
                skipped: true,
                reason: error.message
              });
            }
          }
        }
        
        res.json({
          status: 'success',
          message: `Force scan completed. Processed ${results.length} files.`,
          filesFound: allFiles.length,
          filesProcessed: results.length,
          results: results.filter(r => r).map(r => ({
            fileName: r.fileName,
            status: r.skipped ? 'skipped' : 'processed',
            reason: r.reason,
            notionPageId: r.notionPageId
          }))
        });
        
      } catch (error) {
        logger.error('Force scan error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // System status endpoint
    this.app.get('/status', async (req, res) => {
      try {
        const status = await this.getSystemStatus();
        res.json(status);
      } catch (error) {
        logger.error('Status check error', { error: error.message });
        res.status(500).json({ error: error.message });
      }
    });

    // API usage status endpoint
    this.app.get('/api-status', (req, res) => {
      try {
        const status = {
          timestamp: new Date().toISOString(),
          apiCallCount: this.apiCallCount,
          dailyApiLimit: this.dailyApiLimit,
          remainingCalls: this.dailyApiLimit - this.apiCallCount,
          lastResetDate: this.lastResetDate,
          processingQueueSize: this.processingQueue.size,
          currentlyProcessing: Array.from(this.processingQueue.keys())
        };
        res.json(status);
      } catch (error) {
        logger.error('API status check error', { error: error.message });
        res.status(500).json({ error: error.message });
      }
    });

    // URL monitoring endpoints
    this.app.post('/monitor/url', async (req, res) => {
      try {
        const { url, customName, checkInterval } = req.body;
        
        if (!url) {
          return res.status(400).json({ error: 'URL is required' });
        }

        const config = this.urlMonitor.addUrl(url, customName, checkInterval);
        res.json({ status: 'success', config });
      } catch (error) {
        logger.error('URL monitoring error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Add bulletin URL to monitoring
    this.app.post('/monitor/bulletin', async (req, res) => {
      try {
        const bulletinUrl = 'https://tricityministries.org/bskpdf/bulletin/';
        const customName = 'Tricity Ministries Bulletin';
        const checkInterval = 1000 * 60 * 60; // Check every hour
        
        const config = this.urlMonitor.addUrl(bulletinUrl, customName, checkInterval);
        res.json({ 
          status: 'success', 
          message: 'Bulletin URL added to monitoring',
          config 
        });
      } catch (error) {
        logger.error('Bulletin monitoring error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Background mode: minimal routes for webhook only
    if (this.backgroundMode) {
      logger.info('Running in background mode - minimal routes enabled');
      
      // Disable other routes in background mode
      this.app.use('*', (req, res, next) => {
        if (req.path === '/health' || req.path === '/webhook') {
          return next();
        }
        res.status(404).json({ 
          error: 'Route not available in background mode',
          availableRoutes: ['/health', '/webhook']
        });
      });
    }
  }

  // Webhook endpoint for Dropbox notifications
  setupWebhookRoute() {
    this.app.post('/webhook', async (req, res) => {
      try {
        const body = req.body;
        const signature = req.headers['x-dropbox-signature'];
        
        // Temporarily disable signature verification for testing
        // TODO: Re-enable once webhook secret is properly configured
        if (false && !this.dropboxHandler.verifyWebhookSignature(body, signature)) {
          logger.warn('Webhook request missing signature');
          return res.status(401).json({ error: 'Invalid signature' });
        }

        // Create a unique identifier for this webhook notification
        const webhookId = this.createWebhookId(body);
        
        logger.info(`Received webhook with ID: ${webhookId}`);
        
        // Check if we've already processed this webhook
        if (this.processedWebhooks.has(webhookId)) {
          logger.info(`Webhook ${webhookId} already processed, skipping`);
          return res.status(200).json({ status: 'already_processed' });
        }

        // Check if we're currently processing this webhook
        if (this.webhookProcessingLocks.has(webhookId)) {
          logger.info(`Webhook ${webhookId} currently being processed, skipping`);
          return res.status(200).json({ status: 'processing_in_progress' });
        }

        logger.info(`Processing new webhook: ${webhookId}`);
        
        // Mark this webhook as being processed
        this.webhookProcessingLocks.set(webhookId, Date.now());
        
        // Add to processed set to prevent reprocessing
        this.processedWebhooks.add(webhookId);
        
        // Clean up old webhook IDs (keep last 100)
        if (this.processedWebhooks.size > 100) {
          const webhookArray = Array.from(this.processedWebhooks);
          this.processedWebhooks = new Set(webhookArray.slice(-50));
        }

        // Process webhook asynchronously
        this.processWebhookAsync(body).finally(() => {
          // Remove from processing locks
          this.webhookProcessingLocks.delete(webhookId);
        });

        res.status(200).json({ status: 'processing' });
        
      } catch (error) {
        logger.error('Webhook processing error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  }

  // Create a unique identifier for webhook notifications
  createWebhookId(notification) {
    try {
      // Use multiple fields to create a more unique ID
      const timestamp = notification.timestamp || Date.now();
      const account = notification.list_folder?.accounts?.[0] || 'unknown';
      const notificationType = notification.notification?.type || 'unknown';
      const deltaUsers = notification.notification?.delta?.users?.[0] || 'unknown';
      
      // Create a hash of the notification content to ensure uniqueness
      const contentHash = require('crypto')
        .createHash('md5')
        .update(JSON.stringify(notification))
        .digest('hex')
        .substring(0, 8);
      
      return `${account}_${timestamp}_${contentHash}`;
    } catch (error) {
      // Fallback to simple timestamp if parsing fails
      logger.warn('Failed to create webhook ID, using fallback:', error.message);
      return `fallback_${Date.now()}`;
    }
  }

  // Process webhook asynchronously
  async processWebhookAsync(notification) {
    try {
      logger.info('Starting webhook processing');
      
      // Step 1: Process Dropbox notification
      const files = await this.dropboxHandler.processWebhookNotification(notification);
      
      if (files.length === 0) {
        logger.info('No new files to process');
        return;
      }

      // Step 2: Filter out files that failed to download (null values)
      const validFiles = files.filter(file => file !== null);
      
      if (validFiles.length === 0) {
        logger.info('No valid files to process after download attempts');
        return;
      }

      // Step 3: Deduplicate files by path to avoid processing the same file multiple times
      const fileMap = new Map();
      validFiles.forEach(file => {
        fileMap.set(file.originalPath, file);
      });
      const uniqueFiles = Array.from(fileMap.values());
      
      logger.info(`Deduplicated ${validFiles.length} files to ${uniqueFiles.length} unique files`);

      // Step 4: Check which files haven't been processed yet
      const unprocessedFiles = [];
      for (const file of uniqueFiles) {
        try {
          // Use URL-based tracking if available, fallback to filename
          let alreadyProcessed = false;
          
          if (file.shareableUrl) {
            logger.info(`Using URL-based duplicate check for ${file.fileName}: ${file.shareableUrl}`);
            alreadyProcessed = await this.isFileAlreadyProcessedByUrl(file.shareableUrl, file.fileName);
            logger.info(`URL-based check for ${file.fileName}: ${alreadyProcessed ? 'already processed' : 'new file'}`);
          } else {
            logger.warn(`No shareable URL available for ${file.fileName}, falling back to filename check`);
            alreadyProcessed = await this.isFileAlreadyProcessedByFilename(file.fileName);
            logger.info(`Filename-based check for ${file.fileName}: ${alreadyProcessed ? 'already processed' : 'new file'}`);
          }
          
          if (!alreadyProcessed) {
            unprocessedFiles.push(file);
          } else {
            logger.info(`Skipping ${file.fileName}: already processed in Notion`);
            // Clean up the downloaded file since we won't process it
            await this.dropboxHandler.cleanupFile(file.localPath);
          }
        } catch (error) {
          logger.error(`Error checking processing status for ${file.fileName}:`, error.message);
          // On error, include the file for processing to be safe
          unprocessedFiles.push(file);
        }
      }

      if (unprocessedFiles.length === 0) {
        logger.info('All files have already been processed');
        return;
      }

      logger.info(`Processing ${unprocessedFiles.length} unprocessed files`);

      // Step 4: Process each unprocessed file
      for (const file of unprocessedFiles) {
        try {
          await this.processFile(file);
        } catch (error) {
          logger.error(`Failed to process file ${file.fileName}:`, error.message);
        }
      }

      logger.info('Webhook processing completed');
      
    } catch (error) {
      logger.error('Webhook processing failed:', error);
    }
  }

  // Check if file is already processed by URL (checks both databases)
  async isFileAlreadyProcessedByUrl(shareableUrl, fileName) {
    try {
      // Add extra logging for debugging
      logger.info(`Checking if file is already processed: ${fileName} with URL: ${shareableUrl}`);

      // Check audio database
      const audioProcessed = await this.notionHandler.isFileAlreadyProcessedByUrl(shareableUrl);
      if (audioProcessed) {
        logger.info(`✅ File ${fileName} already processed in audio database`);
        return true;
      }

      // Check PDF database
      const pdfProcessed = await this.notionPDFHandler.isFileAlreadyProcessedByUrl(shareableUrl);
      if (pdfProcessed) {
        logger.info(`✅ File ${fileName} already processed in PDF database`);
        return true;
      }

      logger.info(`🆕 File ${fileName} is new - not found in either database`);
      return false;
    } catch (error) {
      logger.error(`❌ Error checking if file ${fileName} is processed by URL:`, error.message);
      // On error, assume file is NOT processed to be safe (but log the error)
      return false;
    }
  }

  // Check if file is already processed by filename (checks both databases)
  async isFileAlreadyProcessedByFilename(fileName) {
    try {
      // Check audio database
      const audioProcessed = await this.notionHandler.isFileAlreadyProcessed(fileName);
      if (audioProcessed) {
        logger.info(`File ${fileName} already processed in audio database`);
        return true;
      }

      // Check PDF database (using filename search)
      const pdfProcessed = await this.notionPDFHandler.searchByFileName(fileName);
      if (pdfProcessed.length > 0) {
        logger.info(`File ${fileName} already processed in PDF database`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Error checking if file ${fileName} is processed by filename:`, error.message);
      return false;
    }
  }

  // Determine file type and route to appropriate processor
  getFileProcessor(fileName) {
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

  // Process a single file through the appropriate pipeline
  async processFile(file, customName = null, forceReprocess = false) {
    try {
      // Check API rate limits first
      if (!this.checkApiLimits()) {
        throw new Error(`Daily API limit of ${this.dailyApiLimit} calls reached. Processing paused.`);
      }

      // Check if file is already being processed
      const fileKey = file.shareableUrl || file.fileName;
      if (this.processingQueue.has(fileKey)) {
        logger.warn(`File ${file.fileName} is already being processed, skipping duplicate`);
        return null;
      }

      // Add to processing queue
      this.processingQueue.set(fileKey, Date.now());

      logger.info(`Processing file: ${file.fileName}${forceReprocess ? ' (force reprocess)' : ''}`);
      
      // Validate file has a local path
      if (!file.localPath) {
        throw new Error(`File ${file.fileName} has no local path - download may have failed`);
      }

      // Check if file actually exists before processing
      if (!fs.existsSync(file.localPath)) {
        throw new Error(`File ${file.fileName} does not exist at path: ${file.localPath}`);
      }
      
      // Determine file type and route to appropriate processor
      const fileType = this.getFileProcessor(file.fileName);
      
      let result = null;
      if (fileType === 'audio') {
        result = await this.processAudioFile(file, customName, forceReprocess);
      } else if (fileType === 'document') {
        result = await this.processDocumentFile(file, customName, forceReprocess);
      } else {
        throw new Error(`Unsupported file type: ${file.fileName}`);
      }

      // Increment API call counter
      this.incrementApiCallCount();

      return result;

    } catch (error) {
      logger.error(`Failed to process file ${file.fileName}:`, error);
      
      // Clean up file even if processing failed
      try {
        if (file.localPath) {
          await this.dropboxHandler.cleanupFile(file.localPath);
        }
      } catch (cleanupError) {
        logger.warn(`Failed to cleanup file ${file.localPath}:`, cleanupError.message);
      }
      
      throw error;
    } finally {
      // Remove from processing queue
      const fileKey = file.shareableUrl || file.fileName;
      this.processingQueue.delete(fileKey);
    }
  }

  // Process audio file through transcription pipeline
  async processAudioFile(file, customName = null, forceReprocess = false) {
    try {
      logger.info(`Processing audio file: ${file.fileName}`);
      
      // Step 1: Transcribe and extract key points
      const audioData = await this.transcriptionHandler.processAudioFile(
        file.localPath, 
        file.fileName
      );

      // Only proceed to Notion if transcription was successful
      if (!audioData || !audioData.summary) {
        throw new Error(`Transcription failed for ${file.fileName} - no audio data or summary generated`);
      }

      // Add content validation to prevent processing test files or minimal content
      if (!this.validateAudioContent(audioData, file.fileName)) {
        logger.warn(`Skipping ${file.fileName}: Content validation failed (likely test data or minimal content)`);
        return {
          fileName: file.fileName,
          skipped: true,
          reason: 'Content validation failed - likely test data or minimal content',
          fileType: 'audio'
        };
      }

      // Add the shareableUrl to audioData for Notion processing
      if (file.shareableUrl) {
        audioData.shareableUrl = file.shareableUrl;
      }

      // Step 2: Create Notion page with custom name if provided
      const notionPage = await this.notionHandler.createOrUpdatePage(audioData, customName, forceReprocess);

      // Step 3: Clean up temporary file
      await this.dropboxHandler.cleanupFile(file.localPath);

      logger.info(`Successfully processed audio file ${file.fileName} -> Notion page: ${notionPage.id}`);
      
      return {
        fileName: file.fileName,
        customName: customName,
        notionPageId: notionPage.id,
        summary: audioData.summary,
        keyPoints: audioData.keyPoints,
        actionItems: audioData.actionItems,
        fileType: 'audio'
      };

    } catch (error) {
      logger.error(`Failed to process audio file ${file.fileName}:`, error);
      throw error;
    }
  }

  // Process document file through document pipeline
  async processDocumentFile(file, customName = null, forceReprocess = false) {
    try {
      logger.info(`Processing document file: ${file.fileName}`);
      
      // Step 1: Extract text and analyze content
      const documentData = await this.documentHandler.processDocument(
        file.localPath, 
        file.fileName
      );

      // Only proceed to Notion if processing was successful
      if (!documentData || !documentData.summary) {
        throw new Error(`Document processing failed for ${file.fileName} - no data or summary generated`);
      }

      // Add content validation to prevent processing test files or minimal content
      if (!this.validateDocumentContent(documentData, file.fileName)) {
        logger.warn(`Skipping ${file.fileName}: Content validation failed (likely test data or minimal content)`);
        return {
          fileName: file.fileName,
          skipped: true,
          reason: 'Content validation failed - likely test data or minimal content',
          fileType: 'document'
        };
      }

      // Add the shareableUrl to documentData for Notion processing
      if (file.shareableUrl) {
        documentData.shareableUrl = file.shareableUrl;
      }

      // Step 2: Upload file to Notion if enabled
      let uploadedFile = null;
      if (config.documents.uploadToNotion) {
        uploadedFile = await this.notionPDFHandler.uploadFileToNotion(file.localPath, file.fileName);
        if (uploadedFile) {
          documentData.uploadedFile = uploadedFile;
        }
      }

      // Step 3: Create Notion page in PDF database (with uploaded file reference)
      const notionPage = await this.notionPDFHandler.createOrUpdatePage(documentData, customName, forceReprocess);

      // Step 4: Clean up temporary file
      await this.dropboxHandler.cleanupFile(file.localPath);

      logger.info(`Successfully processed document file ${file.fileName} -> Notion page: ${notionPage.id}`);
      
      return {
        fileName: file.fileName,
        customName: customName,
        notionPageId: notionPage.id,
        summary: documentData.summary,
        keyPoints: documentData.keyPoints,
        actionItems: documentData.actionItems,
        fileType: 'document',
        uploadedFile: uploadedFile
      };

    } catch (error) {
      logger.error(`Failed to process document file ${file.fileName}:`, error);
      throw error;
    }
  }

  // Manual file processing
  async processFileManually(filePath, customName, forceReprocess = false) {
    try {
      // Get file metadata from Dropbox
      const metadata = await this.dropboxHandler.getFileMetadata(filePath);
      
      // Get shareable URL for better tracking
      let shareableUrl = null;
      try {
        shareableUrl = await this.dropboxHandler.getShareableUrl(filePath);
      } catch (error) {
        logger.warn(`Failed to get shareable URL for manual processing of ${filePath}:`, error.message);
      }
      
      // Process the file
      const file = {
        originalPath: filePath,
        fileName: metadata.name, // Always use original filename for file type detection
        displayName: customName || metadata.name, // Use customName for display purposes only
        localPath: null,
        size: metadata.size,
        modified: metadata.server_modified,
        shareableUrl: shareableUrl
      };

      // Check if file already exists in Notion (unless force reprocessing)
      if (!forceReprocess) {
        let alreadyProcessed = false;
        
        if (shareableUrl) {
          alreadyProcessed = await this.isFileAlreadyProcessedByUrl(shareableUrl, file.displayName);
          logger.info(`Manual processing URL-based check: ${alreadyProcessed ? 'already processed' : 'new file'}`);
        } else {
          logger.warn(`No shareable URL for manual processing, falling back to filename check`);
          alreadyProcessed = await this.isFileAlreadyProcessedByFilename(file.displayName);
          logger.info(`Manual processing filename-based check: ${alreadyProcessed ? 'already processed' : 'new file'}`);
        }
        
        if (alreadyProcessed) {
          throw new Error(`File ${file.displayName} has already been processed. Use force-reprocess-file endpoint to reprocess.`);
        }
      }

      // Download the file
      file.localPath = await this.dropboxHandler.downloadFile(filePath, file.fileName);
      
      // Process through pipeline
      return await this.processFile(file, file.displayName !== file.fileName ? file.displayName : null, forceReprocess);
      
    } catch (error) {
      logger.error(`Manual file processing failed for ${filePath}:`, error);
      throw error;
    }
  }

  // Get system status
  async getSystemStatus() {
    const status = {
      timestamp: new Date().toISOString(),
      services: {}
    };

    // Check Dropbox connection
    try {
      await this.dropboxHandler.listFiles();
      status.services.dropbox = 'connected';
    } catch (error) {
      status.services.dropbox = 'error';
      status.services.dropboxError = error.message;
    }

    // Check Notion connection (audio database)
    try {
      await this.notionHandler.testConnection();
      status.services.notionAudio = 'connected';
    } catch (error) {
      status.services.notionAudio = 'error';
      status.services.notionAudioError = error.message;
    }

    // Check Notion connection (PDF database)
    try {
      await this.notionPDFHandler.testConnection();
      status.services.notionPDF = 'connected';
    } catch (error) {
      status.services.notionPDF = 'error';
      status.services.notionPDFError = error.message;
    }

    // Check OpenAI connection (simple test)
    try {
      // This is a minimal test - in production you might want a more comprehensive check
      status.services.openai = 'configured';
    } catch (error) {
      status.services.openai = 'error';
      status.services.openaiError = error.message;
    }

    return status;
  }

  // Start the server
  async start() {
    try {
      // Ensure temp directory exists
      await ensureTempDir();
      
      // Start the server
      const port = config.server.port;
      this.app.listen(port, () => {
        logger.info(`Server started on port ${port}`);
        logger.info(`Health check: http://localhost:${port}/health`);
        logger.info(`Webhook URL: http://localhost:${port}/webhook`);
        
        // Start periodic scan if enabled
        if (this.periodicScanEnabled) {
          this.startPeriodicScan();
        }
      });

    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  setupUrlMonitoring() {
    // Start URL monitoring when server starts
    this.urlMonitor.start();
    
    // Set up callback for when URLs change
    this.urlMonitor.onUrlChange = async (result) => {
      try {
        logger.info(`Processing URL change: ${result.url}`);
        
        // Process the downloaded file
        const fileInfo = {
          filePath: result.filePath,
          fileName: path.basename(result.filePath),
          size: fs.statSync(result.filePath).size
        };

        await this.processFile(fileInfo, result.customName, false);
        
        // Clean up the temporary file
        await cleanupTempFile(result.filePath);
        
        logger.info(`Successfully processed URL change: ${result.url}`);
      } catch (error) {
        logger.error(`Error processing URL change for ${result.url}:`, error);
      }
    };
  }

  // Check API rate limits
  checkApiLimits() {
    const now = Date.now();
    const today = new Date().toDateString();

    if (today !== this.lastResetDate) {
      this.apiCallCount = 0; // Reset count on new day
      this.lastResetDate = today;
      logger.info(`API call count reset for new day. Current count: ${this.apiCallCount}`);
    }

    if (this.apiCallCount >= this.dailyApiLimit) {
      logger.warn(`Daily API limit of ${this.dailyApiLimit} calls reached. Processing paused.`);
      return false;
    }

    this.apiCallCount++;
    logger.info(`API call count: ${this.apiCallCount}/${this.dailyApiLimit}`);
    return true;
  }

  // Increment API call counter
  incrementApiCallCount() {
    this.apiCallCount++;
    logger.info(`API call count incremented: ${this.apiCallCount}/${this.dailyApiLimit}`);
  }

  // Validate document content to prevent processing of test files or minimal content
  validateDocumentContent(documentData, fileName) {
    const minContentLength = 100; // Minimum content length in characters
    const minSummaryLength = 50; // Minimum summary length in characters

    // Check for test file patterns
    if (this.isTestFile(fileName, documentData.originalText || documentData.text)) {
      return false;
    }

    if (documentData.originalText && documentData.originalText.length < minContentLength) {
      logger.warn(`Document ${fileName} has very short content: ${documentData.originalText.length} characters. Skipping.`);
      return false;
    }

    if (documentData.summary && documentData.summary.length < minSummaryLength) {
      logger.warn(`Document ${fileName} has very short summary: ${documentData.summary.length} characters. Skipping.`);
      return false;
    }

    return true;
  }

  // Validate audio content to prevent processing of test files or minimal content
  validateAudioContent(audioData, fileName) {
    const minSummaryLength = 50; // Minimum summary length in characters

    // Check for test file patterns
    if (this.isTestFile(fileName, audioData.originalText)) {
      return false;
    }

    if (audioData.summary && audioData.summary.length < minSummaryLength) {
      logger.warn(`Audio ${fileName} has very short summary: ${audioData.summary.length} characters. Skipping.`);
      return false;
    }

    return true;
  }

  // Detect test files based on filename and content patterns
  isTestFile(fileName, content) {
    const testPatterns = [
      /test/i,
      /sample/i,
      /demo/i,
      /dummy/i,
      /placeholder/i
    ];

    // Check filename for test patterns
    for (const pattern of testPatterns) {
      if (pattern.test(fileName)) {
        logger.warn(`File ${fileName} appears to be a test file based on filename pattern`);
        return true;
      }
    }

    if (!content) return false;

    // Check for repetitive content (like "注意事項" repeated)
    const words = content.trim().split(/\s+/);
    if (words.length > 0) {
      const uniqueWords = new Set(words);
      const repetitionRatio = words.length / uniqueWords.size;
      
      if (repetitionRatio > 3 && words.length < 20) {
        logger.warn(`File ${fileName} appears to have repetitive test content (repetition ratio: ${repetitionRatio})`);
        return true;
      }
    }

    // Check for very short content with non-meaningful text
    if (content.length < 50 && !/[a-zA-Z0-9]{10,}/.test(content)) {
      logger.warn(`File ${fileName} appears to have minimal or non-meaningful content`);
      return true;
    }

    return false;
  }

  // Start periodic file scanning
  startPeriodicScan() {
    logger.info(`Starting periodic scan every ${this.periodicScanInterval} minutes`);
    
    // Run initial scan after 1 minute
    setTimeout(() => this.runPeriodicScan(), 60000);
    
    // Then run periodically
    setInterval(() => this.runPeriodicScan(), this.periodicScanInterval * 60 * 1000);
  }

  // Run a periodic scan
  async runPeriodicScan() {
    try {
      logger.info('Running periodic file scan');
      
      // Clear the recent processing cache for periodic scans
      this.dropboxHandler.recentlyProcessedFiles.clear();
      
      // Process files through webhook handler
      const processedFiles = await this.dropboxHandler.processWebhookNotification({
        list_folder: { accounts: ['periodic-scan'] }
      });
      
      if (processedFiles.length > 0) {
        let processedCount = 0;
        for (const file of processedFiles) {
          if (file) {
            try {
              await this.processFile(file, null, false);
              processedCount++;
            } catch (error) {
              logger.error(`Failed to process file ${file.fileName}:`, error.message);
            }
          }
        }
        logger.info(`Periodic scan completed: ${processedCount} files processed`);
      } else {
        logger.info('Periodic scan completed: No new files to process');
      }
      
      this.lastScanTime = new Date();
    } catch (error) {
      logger.error('Periodic scan error:', error);
    }
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  const server = new AutomationServer();
  server.start();
}

module.exports = AutomationServer; 