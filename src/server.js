const express = require('express');
const config = require('../config/config');
const { logger, ensureTempDir, cleanupTempFile, isValidFileSize } = require('./utils');
const DropboxHandler = require('./dropbox-handler');
const NotionHandler = require('./notion-handler');
const DocumentProcessor = require('./document-processor');

class AutomationServer {
  constructor() {
    try {
      console.log('🔧 Initializing PDF Automation Server...');

      this.app = express();
      console.log('✅ Express app created');

      this.dropboxHandler = new DropboxHandler();
      console.log('✅ Dropbox handler created');

      this.notionHandler = new NotionHandler();
      console.log('✅ Notion handler created');

      this.documentProcessor = new DocumentProcessor();
      console.log('✅ Document processor created');

      // API rate limiting
      this.apiCallCount = 0;
      this.dailyApiLimit = config.apiLimits.dailyApiLimit;
      this.lastResetDate = new Date().toDateString();

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
        service: 'PDF-Automation',
        timestamp: new Date().toISOString()
      });
    });

    // Health check endpoint
    this.app.get('/health', async (req, res) => {
      try {
        const healthStatus = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          service: 'PDF-Automation',
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
              available: !!this.documentProcessor,
              status: this.documentProcessor ? 'operational' : 'unavailable'
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

    // Webhook endpoint for Dropbox notifications
    this.app.post('/webhook/dropbox', async (req, res) => {
      try {
        logger.info('Received Dropbox webhook notification');

        // Verify webhook signature if configured
        const signature = req.headers['x-dropbox-signature'];
        if (config.dropbox.webhookSecret && !this.dropboxHandler.verifyWebhookSignature(JSON.stringify(req.body), signature)) {
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

    // Manual file processing endpoint
    this.app.post('/process-file', async (req, res) => {
      try {
        const { filePath, customName } = req.body;

        if (!filePath) {
          return res.status(400).json({ error: 'filePath is required' });
        }

        logger.info('Manual file processing requested', { filePath, customName });

        const fileMetadata = await this.dropboxHandler.getFileMetadata(filePath);
        const localPath = await this.dropboxHandler.downloadFile(filePath, fileMetadata.name);
        const shareableUrl = await this.dropboxHandler.createShareableLink(filePath);

        const processedFile = {
          originalPath: filePath,
          localPath: localPath,
          fileName: customName || fileMetadata.name,
          fileType: 'document',
          size: fileMetadata.size,
          serverModified: fileMetadata.server_modified,
          shareableUrl: shareableUrl
        };

        await this.processDocumentFile(processedFile);

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

    // Force scan endpoint
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
      const existingPages = await this.notionHandler.searchByDropboxUrl(fileInfo.shareableUrl);
      if (existingPages.length > 0) {
        logger.info(`File ${fileInfo.fileName} already exists in Notion, skipping`);
        return;
      }

      // Process document with AI
      const processedDocumentData = await this.documentProcessor.processDocument(fileInfo.localPath, fileInfo.fileName);
      const completeDocumentData = { ...fileInfo, ...processedDocumentData };
      
      // Create Notion page
      const pageId = await this.notionHandler.createPage(completeDocumentData);

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
      });
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

module.exports = AutomationServer; 