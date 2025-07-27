const fs = require('fs').promises;
const path = require('path');
const winston = require('winston');
const config = require('../config/config');

// Configure logger
const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'automation-connections' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Ensure temp directory exists
async function ensureTempDir() {
  try {
    await fs.access(config.processing.tempFolder);
  } catch {
    await fs.mkdir(config.processing.tempFolder, { recursive: true });
    logger.info(`Created temp directory: ${config.processing.tempFolder}`);
  }
}

// Clean up temp files
async function cleanupTempFile(filePath) {
  try {
    await fs.unlink(filePath);
    logger.info(`Cleaned up temp file: ${filePath}`);
  } catch (error) {
    logger.warn(`Failed to cleanup temp file ${filePath}:`, error.message);
  }
}

// Validate file format
function isValidAudioFormat(filename) {
  const extension = path.extname(filename).toLowerCase().substring(1);
  return config.processing.supportedFormats.includes(extension);
}

// Validate file size
function isValidFileSize(sizeInBytes) {
  const maxSizeInBytes = config.processing.maxFileSizeMB * 1024 * 1024;
  return sizeInBytes <= maxSizeInBytes;
}

// Generate unique filename
function generateUniqueFilename(originalName) {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  const extension = path.extname(originalName);
  const nameWithoutExt = path.basename(originalName, extension);
  return `${nameWithoutExt}_${timestamp}_${randomString}${extension}`;
}

// Extract key information from filename
function extractFileInfo(filename) {
  const nameWithoutExt = path.basename(filename, path.extname(filename));
  const date = new Date().toISOString().split('T')[0];
  
  return {
    originalName: filename,
    processedName: nameWithoutExt,
    date: date,
    type: 'voice_recording'
  };
}

// Format duration for display
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

// Calculate estimated cost for OpenAI operations
function estimateCost(inputTokens, outputTokens = 0, model = 'gpt-3.5-turbo') {
  const costs = {
    'gpt-3.5-turbo': { input: 0.0015, output: 0.002 }, // per 1K tokens
    'whisper-1': 0.006 // per minute
  };
  
  if (model === 'whisper-1') {
    return (inputTokens / 60) * costs[model]; // inputTokens represents minutes for Whisper
  }
  
  const inputCost = (inputTokens / 1000) * costs[model].input;
  const outputCost = (outputTokens / 1000) * costs[model].output;
  
  return inputCost + outputCost;
}

// Sanitize filename for safe file system operations
function sanitizeFilename(filename) {
  // Remove or replace problematic characters
  return filename
    .replace(/[<>:"/\\|?*]/g, '_') // Replace problematic chars with underscore
    .replace(/[\x00-\x1f]/g, '')   // Remove control characters
    .replace(/\s+/g, '_')          // Replace spaces with underscores
    .replace(/_{2,}/g, '_')        // Replace multiple underscores with single
    .replace(/^_+|_+$/g, '');      // Remove leading/trailing underscores
}

module.exports = {
  logger,
  ensureTempDir,
  cleanupTempFile,
  isValidAudioFormat,
  isValidFileSize,
  generateUniqueFilename,
  extractFileInfo,
  formatDuration,
  estimateCost,
  sanitizeFilename
}; 