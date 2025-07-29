const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');
const { logger, ensureTempDir, cleanupTempFile, isValidFileSize } = require('./utils');
const DropboxHandler = require('./dropbox-handler');
const NotionHandler = require('./notion-handler');
const NotionPDFHandler = require('./notion-pdf-handler');
const DocumentHandler = require('./document-handler');
const URLMonitor = require('./url-monitor');

class AutomationServer {
  constructor() {
    try {
      console.log('🔧 Initializing Automation Server...');

      this.app = express();
      console.log('✅ Express app created');

      this.dropboxHandler = new DropboxHandler();
      console.log('✅ Dropbox handler created');

      this.notionHandler = new NotionHandler();
      console.log('✅ Notion handler created');

      try {
        this.notionPDFHandler = new NotionPDFHandler();
        console.log('✅ Notion PDF handler created');
      } catch (error) {
        console.log('⚠️ Notion PDF handler creation failed:', error.message);
        this.notionPDFHandler = null;
      }

      try {
        this.documentHandler = new DocumentHandler();
        console.log('✅ Document handler created');
      } catch (error) {
        console.log('⚠️ Document handler creation failed:', error.message);
        this.documentHandler = null;
      }

      try {
        this.urlMonitor = new URLMonitor();
        console.log('✅ URL monitor created');
      } catch (error) {
        console.log('⚠️ URL monitor creation failed:', error.message);
        this.urlMonitor = null;
      }

      // API rate limiting
      this.apiCallCount = 0;
      this.dailyApiLimit = config.apiLimits.dailyApiLimit;
      this.lastResetDate = new Date().toDateString();
      this.processingQueue = [];

      // Background mode flag
      this.backgroundMode = process.env.BACKGROUND_MODE === 'true';

      // Periodic scan settings
      this.periodicScanEnabled = config.apiLimits.periodicScanEnabled;
      this.periodicScanInterval = parseInt(process.env.PERIODIC_SCAN_INTERVAL_MINUTES) || 30; // Default 30 minutes

      console.log('🔧 Setting up middleware...');
      this.setupMiddleware();
      console.log('✅ Middleware setup complete');

      console.log('🔧 Setting up routes...');
      this.setupRoutes();
      console.log('✅ Routes setup complete');

      console.log('✅ Server initialization complete');

    } catch (error) {
      console.error('❌ Server initialization failed:', error);
      throw error;
    }
  }

  setupMiddleware() {
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Add request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
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
    this.app.get('/health', async (req, res) => {
      try {
        const healthStatus = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          backgroundMode: this.backgroundMode,
          service: 'Automation-Connections',
          services: {
            dropbox: {
              available: !!this.dropboxHandler,
              status: 'operational'
            },
            notion: {
              available: !!this.notionHandler,
              status: 'operational'
            },
            documentProcessing: {
              available: !!this.documentHandler,
              status: this.documentHandler ? 'operational' : 'unavailable'
            }
          }
        };

        res.json(healthStatus);
      } catch (error) {
        logger.error('Health check error:', error);
        res.status(500).json({
          status: 'error',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
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

    // Webhook endpoint for Dropbox notifications (documents only)
    this.app.post('/webhook/dropbox', async (req, res) => {
      try {
        logger.info('Received Dropbox webhook notification');

        // Verify webhook signature if configured
        const signature = req.headers['x-dropbox-signature'];
        if (!this.dropboxHandler.verifyWebhookSignature(JSON.stringify(req.body), signature)) {
          logger.warn('Invalid webhook signature from Dropbox');
          return res.status(401).json({ error: 'Invalid signature' });
        }

        // Process the webhook notification
        const processedFiles = await this.dropboxHandler.processWebhookNotification(req.body);

        // Process each document file
        for (const file of processedFiles) {
          await this.processDocumentFile(file);
        }

        res.json({ status: 'success', filesProcessed: processedFiles.length });
      } catch (error) {
        logger.error('Error processing Dropbox webhook:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Test endpoint to check webhook secret
    this.app.get('/test-webhook-secret', (req, res) => {
      res.json({
        webhookSecretConfigured: false, // No webhook secret for Dropbox
        webhookSecretValue: 'N/A'
      });
    });

    // Manual file processing endpoint
    this.app.post('/process-file', async (req, res) => {
      try {
        const { filePath, customName, source } = req.body;

        if (!filePath) {
          return res.status(400).json({ error: 'filePath is required' });
        }

        logger.info('Manual file processing requested', { filePath, customName, source });

        let processedFile;
        if (source === 'dropbox') {
          // Process Dropbox file
          const fileMetadata = await this.dropboxHandler.getFileMetadata(filePath);
          const localPath = await this.dropboxHandler.downloadFile(filePath, fileMetadata.name);
          const shareableUrl = await this.dropboxHandler.createShareableLink(filePath);

          processedFile = {
            originalPath: filePath,
            localPath: localPath,
            fileName: customName || fileMetadata.name,
            fileType: 'document',
            size: fileMetadata.size,
            serverModified: fileMetadata.server_modified,
            shareableUrl: shareableUrl
          };

          await this.processDocumentFile(processedFile);
        } else {
          // Default to Dropbox if source is not specified or unknown
          const fileMetadata = await this.dropboxHandler.getFileMetadata(filePath);
          const localPath = await this.dropboxHandler.downloadFile(filePath, fileMetadata.name);
          const shareableUrl = await this.dropboxHandler.createShareableLink(filePath);

          processedFile = {
            originalPath: filePath,
            localPath: localPath,
            fileName: customName || fileMetadata.name,
            fileType: 'document',
            size: fileMetadata.size,
            serverModified: fileMetadata.server_modified,
            shareableUrl: shareableUrl
          };

          await this.processDocumentFile(processedFile);
        }

        res.json({
          status: 'success',
          message: 'File processed successfully',
          file: processedFile
        });
      } catch (error) {
        logger.error('Manual file processing error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // API status endpoint
    this.app.get('/api-status', async (req, res) => {
      try {
        const status = {
          apiCallCount: this.apiCallCount,
          dailyApiLimit: this.dailyApiLimit,
          lastResetDate: this.lastResetDate,
          processingQueue: this.processingQueue.length,
          backgroundMode: this.backgroundMode,
          periodicScanEnabled: this.periodicScanEnabled,
          periodicScanInterval: this.periodicScanInterval
        };

        res.json(status);
      } catch (error) {
        logger.error('API status check error', { error: error.message });
        res.status(500).json({ error: error.message });
      }
    });

    // Force scan endpoint for Dropbox
    this.app.post('/force-scan', async (req, res) => {
      try {
        logger.info('Force scan requested - processing all document files from Dropbox');

        const results = [];

        // Scan Dropbox for document files
        try {
          const documentFiles = await this.dropboxHandler.listDocumentFiles();
          logger.info(`Found ${documentFiles.length} document files in Dropbox`);

          for (const file of documentFiles) {
            try {
              const localPath = await this.dropboxHandler.downloadFile(file.path_display, file.name);
              const shareableUrl = await this.dropboxHandler.createShareableLink(file.path_display);

              const processedFile = {
                originalPath: file.path_display,
                localPath: localPath,
                fileName: file.name,
                fileType: 'document',
                size: file.size,
                serverModified: file.server_modified,
                shareableUrl: shareableUrl
              };

              await this.processDocumentFile(processedFile);
              results.push({
                fileName: file.name,
                status: 'processed',
                source: 'dropbox'
              });
            } catch (error) {
              logger.error(`Failed to process document file ${file.name}:`, error.message);
              results.push({
                fileName: file.name,
                status: 'error',
                reason: error.message,
                source: 'dropbox'
              });
            }
          }
        } catch (error) {
          logger.error('Failed to scan Dropbox:', error.message);
        }

        res.json({
          status: 'success',
          message: 'Force scan completed',
          results: results
        });
      } catch (error) {
        logger.error('Force scan error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Background mode: minimal routes for webhook only
    if (this.backgroundMode) {
      logger.info('Running in background mode - minimal routes enabled');
      return;
    }

    // Additional routes for full mode
    this.setupAdditionalRoutes();
  }

  setupAdditionalRoutes() {
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
  }

  // Process document file from Dropbox
  async processDocumentFile(fileInfo) {
    try {
      logger.info(`Processing document file: ${fileInfo.fileName}`);

      // Validate file
      if (!this.isValidDocumentFormat(fileInfo.fileName)) {
        logger.warn(`Skipping file ${fileInfo.fileName}: unsupported document format`);
        return;
      }

      if (!isValidFileSize(fileInfo.size)) {
        logger.warn(`Skipping file ${fileInfo.fileName}: file too large`);
        return;
      }

      // Check if already processed in Notion
      const existingPages = await this.notionPDFHandler.searchByDropboxUrl(fileInfo.shareableUrl);
      if (existingPages.length > 0) {
        logger.info(`File ${fileInfo.fileName} already exists in Notion, skipping`);
        return;
      }

      // For document files:
      const processedDocumentData = await this.documentHandler.processDocument(fileInfo.localPath, fileInfo.fileName);
      const completeDocumentData = { ...fileInfo, ...processedDocumentData };
      const pageId = await this.notionPDFHandler.createPage(completeDocumentData);

      logger.info(`Successfully processed document file ${fileInfo.fileName} -> Notion page: ${pageId}`);

      // Clean up local file
      await cleanupTempFile(fileInfo.localPath);

    } catch (error) {
      logger.error(`Failed to process document file ${fileInfo.fileName}:`, error);
      await cleanupTempFile(fileInfo.localPath);
      throw error;
    }
  }

  // Check if file is a valid document format
  isValidDocumentFormat(fileName) {
    const extension = fileName.toLowerCase().split('.').pop();
    const documentExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'bmp', 'tiff', 'tif', 'webp', 'docx', 'doc'];
    return documentExtensions.includes(extension);
  }

  // Start the server
  start() {
    const port = config.server.port;

    try {
      this.app.listen(port, () => {
        logger.info(`Server started on port ${port}`);
        logger.info(`Health check: http://localhost:${port}/health`);
        logger.info(`Dropbox webhook URL: http://localhost:${port}/webhook/dropbox`);
        logger.info('Google Drive webhook not available (handler removed)');

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

  // Start periodic scan
  startPeriodicScan() {
    logger.info(`Starting periodic scan every ${this.periodicScanInterval} minutes`);

    setInterval(async () => {
      try {
        logger.info('Running periodic scan...');

        // Scan Dropbox for document files
        try {
          const documentFiles = await this.dropboxHandler.listDocumentFiles();
          logger.info(`Periodic scan found ${documentFiles.length} document files in Dropbox`);

          for (const file of documentFiles) {
            try {
              const localPath = await this.dropboxHandler.downloadFile(file.path_display, file.name);
              const shareableUrl = await this.dropboxHandler.createShareableLink(file.path_display);

              const processedFile = {
                originalPath: file.path_display,
                localPath: localPath,
                fileName: file.name,
                fileType: 'document',
                size: file.size,
                serverModified: file.server_modified,
                shareableUrl: shareableUrl
              };

              await this.processDocumentFile(processedFile);
            } catch (error) {
              logger.error(`Failed to process document file ${file.name} during periodic scan:`, error.message);
            }
          }
        } catch (error) {
          logger.error('Periodic scan error:', error);
        }

      } catch (error) {
        logger.error('Periodic scan error:', error);
      }
    }, this.periodicScanInterval * 60 * 1000);
  }
}

module.exports = AutomationServer; 