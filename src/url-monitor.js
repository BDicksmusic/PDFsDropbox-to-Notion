const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config/config');
const { logger } = require('./utils');
const { ensureTempDir, cleanupTempFile } = require('./utils');

class URLMonitor {
  constructor() {
    this.monitoredUrls = new Map(); // Store URL -> last hash
    this.isRunning = false;
    this.checkInterval = 1000 * 60 * 30; // Check every 30 minutes
  }

  // Add a URL to monitor
  addUrl(url, customName = null, checkInterval = null) {
    const monitorConfig = {
      url: url,
      customName: customName,
      checkInterval: checkInterval || this.checkInterval,
      lastCheck: 0,
      lastHash: null,
      enabled: true
    };

    this.monitoredUrls.set(url, monitorConfig);
    logger.info(`Added URL to monitor: ${url}`);
    
    return monitorConfig;
  }

  // Remove a URL from monitoring
  removeUrl(url) {
    const removed = this.monitoredUrls.delete(url);
    if (removed) {
      logger.info(`Removed URL from monitoring: ${url}`);
    }
    return removed;
  }

  // Get all monitored URLs
  getMonitoredUrls() {
    return Array.from(this.monitoredUrls.values());
  }

  // Start monitoring
  start() {
    if (this.isRunning) {
      logger.warn('URL monitor is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting URL monitor...');

    // Initial check
    this.checkAllUrls();

    // Set up periodic checking
    this.intervalId = setInterval(() => {
      this.checkAllUrls();
    }, this.checkInterval);

    logger.info(`URL monitor started. Checking every ${this.checkInterval / 1000 / 60} minutes`);
  }

  // Stop monitoring
  stop() {
    if (!this.isRunning) {
      logger.warn('URL monitor is not running');
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    logger.info('URL monitor stopped');
  }

  // Check all monitored URLs
  async checkAllUrls() {
    const urls = Array.from(this.monitoredUrls.values());
    
    for (const urlConfig of urls) {
      if (!urlConfig.enabled) continue;
      
      try {
        await this.checkUrl(urlConfig);
      } catch (error) {
        logger.error(`Error checking URL ${urlConfig.url}:`, error.message);
      }
    }
  }

  // Check a specific URL for changes
  async checkUrl(urlConfig) {
    try {
      logger.debug(`Checking URL: ${urlConfig.url}`);
      
      // Download the file
      const response = await axios({
        method: 'GET',
        url: urlConfig.url,
        responseType: 'stream',
        timeout: 30000, // 30 second timeout
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      // Generate hash of the content
      const hash = await this.generateHashFromStream(response.data);
      
      // Check if content has changed
      if (urlConfig.lastHash && urlConfig.lastHash === hash) {
        logger.debug(`No changes detected for ${urlConfig.url}`);
        return false;
      }

      // Content has changed, process the file
      logger.info(`Changes detected for ${urlConfig.url}, processing...`);
      
      // Save to temp file
      const tempFilePath = await this.saveStreamToFile(response.data, urlConfig.url);
      
      // Update the hash
      urlConfig.lastHash = hash;
      urlConfig.lastCheck = Date.now();

      // Create result object
      const result = {
        filePath: tempFilePath,
        url: urlConfig.url,
        customName: urlConfig.customName,
        hash: hash
      };

      // Call the callback if set
      if (this.onUrlChange) {
        await this.onUrlChange(result);
      }

      return result;

    } catch (error) {
      logger.error(`Failed to check URL ${urlConfig.url}:`, error.message);
      throw error;
    }
  }

  // Generate hash from stream
  async generateHashFromStream(stream) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('md5');
      
      stream.on('data', (chunk) => {
        hash.update(chunk);
      });
      
      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });
      
      stream.on('error', (error) => {
        reject(error);
      });
    });
  }

  // Save stream to temporary file
  async saveStreamToFile(stream, url) {
    const fileName = this.extractFileNameFromUrl(url) || 'downloaded-file.pdf';
    const tempFilePath = path.join(config.processing.tempFolder, fileName);
    
    await ensureTempDir();
    
    return new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(tempFilePath);
      
      stream.pipe(writer);
      
      writer.on('finish', () => {
        logger.info(`File saved to: ${tempFilePath}`);
        resolve(tempFilePath);
      });
      
      writer.on('error', (error) => {
        reject(error);
      });
    });
  }

  // Extract filename from URL
  extractFileNameFromUrl(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const fileName = path.basename(pathname);
      
      if (fileName && fileName !== '/') {
        return fileName;
      }
      
      // If no filename in URL, generate one based on domain
      const domain = urlObj.hostname;
      return `${domain}-${Date.now()}.pdf`;
    } catch (error) {
      logger.warn(`Could not extract filename from URL: ${url}`);
      return `downloaded-${Date.now()}.pdf`;
    }
  }

  // Manual check of a specific URL
  async checkUrlManually(url) {
    const urlConfig = this.monitoredUrls.get(url);
    if (!urlConfig) {
      throw new Error(`URL ${url} is not being monitored`);
    }
    
    return await this.checkUrl(urlConfig);
  }

  // Get status of all monitored URLs
  getStatus() {
    const status = {
      isRunning: this.isRunning,
      checkInterval: this.checkInterval,
      monitoredUrls: []
    };

    for (const [url, config] of this.monitoredUrls) {
      status.monitoredUrls.push({
        url: url,
        customName: config.customName,
        enabled: config.enabled,
        lastCheck: config.lastCheck,
        hasLastHash: !!config.lastHash
      });
    }

    return status;
  }
}

module.exports = URLMonitor; 