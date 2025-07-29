require('dotenv').config();

const config = {
  dropbox: {
    accessToken: process.env.DROPBOX_ACCESS_TOKEN,
    refreshToken: process.env.DROPBOX_REFRESH_TOKEN,
    appKey: process.env.DROPBOX_APP_KEY,
    appSecret: process.env.DROPBOX_APP_SECRET,
    webhookSecret: process.env.DROPBOX_WEBHOOK_SECRET,
    pdfFolderPath: process.env.DROPBOX_PDF_FOLDER_PATH || '/Apps/PDFs'
  },
  
  notion: {
    apiKey: process.env.NOTION_API_KEY,
    databaseId: process.env.NOTION_DATABASE_ID
  },
  
  openai: {
    apiKey: process.env.OPENAI_API_KEY
  },
  
  server: {
    port: process.env.PORT || 3000,
    railwayUrl: process.env.RAILWAY_URL
  },
  
  processing: {
    maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB) || 50,
    supportedDocumentFormats: (process.env.SUPPORTED_DOCUMENT_FORMATS || 'pdf,jpg,jpeg,png,bmp,tiff,tif,webp,docx,doc').split(','),
    tempFolder: process.env.TEMPORARY_FOLDER || './temp'
  },

  documents: {
    // Vision model settings for GPT-4 Vision
    visionModel: process.env.VISION_MODEL || 'gpt-4-vision-preview',
    visionMaxTokens: parseInt(process.env.VISION_MAX_TOKENS) || 4096,
    visionTemperature: parseFloat(process.env.VISION_TEMPERATURE) || 0.3,
    imageDetail: process.env.IMAGE_DETAIL || 'high',
    
    // Document analysis settings
    documentAnalysisModel: process.env.DOCUMENT_ANALYSIS_MODEL || 'gpt-3.5-turbo',
    documentMaxTokens: parseInt(process.env.DOCUMENT_MAX_TOKENS) || 1000,
    documentTemperature: parseFloat(process.env.DOCUMENT_TEMPERATURE) || 0.3,
    
    // Custom prompts
    extractionPrompt: process.env.EXTRACTION_PROMPT || null,
    
    // File upload settings
    uploadFilesToNotion: process.env.UPLOAD_FILES_TO_NOTION === 'true' || false
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info'
  },

  // API rate limiting
  apiLimits: {
    dailyApiLimit: parseInt(process.env.DAILY_API_LIMIT) || 1000
  }
};

// Validation
const requiredEnvVars = [
  'DROPBOX_ACCESS_TOKEN',
  'NOTION_API_KEY', 
  'NOTION_DATABASE_ID',
  'OPENAI_API_KEY'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.warn(`Warning: Missing required environment variables: ${missingVars.join(', ')}`);
}

module.exports = config; 