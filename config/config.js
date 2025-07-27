require('dotenv').config();

const config = {
  dropbox: {
    accessToken: process.env.DROPBOX_ACCESS_TOKEN,
    webhookSecret: process.env.DROPBOX_WEBHOOK_SECRET,
    folderPath: process.env.DROPBOX_FOLDER_PATH || '/Apps/Easy Voice Recordings'
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
    supportedFormats: (process.env.SUPPORTED_AUDIO_FORMATS || 'mp3,wav,m4a,flac').split(','),
    tempFolder: process.env.TEMPORARY_FOLDER || './temp'
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