require('dotenv').config();

const config = {
  dropbox: {
    accessToken: process.env.DROPBOX_ACCESS_TOKEN,
    refreshToken: process.env.DROPBOX_REFRESH_TOKEN, // For automatic token refresh
    appKey: process.env.DROPBOX_APP_KEY, // Required for token refresh
    appSecret: process.env.DROPBOX_APP_SECRET, // Required for token refresh
    webhookSecret: process.env.DROPBOX_WEBHOOK_SECRET,
    folderPath: process.env.DROPBOX_FOLDER_PATH || '/Recordings',
    pdfFolderPath: process.env.DROPBOX_PDF_FOLDER_PATH || '/Apps/PDFs'
  },
  
  notion: {
    apiKey: process.env.NOTION_API_KEY,
    databaseId: process.env.NOTION_DATABASE_ID,
    pdfDatabaseId: process.env.NOTION_PDF_DATABASE_ID
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
    supportedFormats: (process.env.SUPPORTED_AUDIO_FORMATS || 'mp3,wav,m4a,flac').split(','),
    supportedDocumentFormats: (process.env.SUPPORTED_DOCUMENT_FORMATS || 'pdf,jpg,jpeg,png,bmp,tiff,tif,webp,docx,doc').split(','),
    tempFolder: process.env.TEMPORARY_FOLDER || './temp'
  },
  
  transcription: {
    // Auto-formatting settings
    autoFormat: process.env.AUTO_FORMAT_TRANSCRIPTION === 'true' || true,
    addTitles: process.env.ADD_TITLES_TO_TRANSCRIPTION === 'true' || true,
    paragraphBreakThreshold: parseInt(process.env.PARAGRAPH_BREAK_THRESHOLD) || 150, // characters
    titleFrequency: parseInt(process.env.TITLE_FREQUENCY) || 1000, // characters between titles
    
    // Custom prompts
    keyPointsPrompt: process.env.KEY_POINTS_PROMPT || null, // Use default if not set
    summaryPrompt: process.env.SUMMARY_PROMPT || null, // Use default if not set
    
    // Model settings
    transcriptionModel: process.env.TRANSCRIPTION_MODEL || 'whisper-1',
    analysisModel: process.env.ANALYSIS_MODEL || 'gpt-3.5-turbo',
    maxTokens: parseInt(process.env.MAX_TOKENS) || 500,
    temperature: parseFloat(process.env.TEMPERATURE) || 0.3
  },

  documents: {
    // OCR settings
    ocrLanguage: process.env.OCR_LANGUAGE || 'eng',
    ocrConfidence: parseFloat(process.env.OCR_CONFIDENCE_THRESHOLD) || 60,
    
    // Image preprocessing
    imagePreprocessing: process.env.ENABLE_IMAGE_PREPROCESSING === 'true' || true,
    
    // Analysis settings
    analysisModel: process.env.DOCUMENT_ANALYSIS_MODEL || 'gpt-3.5-turbo',
    maxTextLength: parseInt(process.env.MAX_DOCUMENT_TEXT_LENGTH) || 16000,
    
    // File upload settings
    uploadToNotion: process.env.UPLOAD_FILES_TO_NOTION === 'true' || true
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info'
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