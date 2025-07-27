# Dropbox to Notion Voice Automation

A cost-effective automation system that processes voice recordings from Dropbox, transcribes them, extracts key points, and imports the data into Notion.

## System Overview

1. **Voice Recording Upload**: Audio files are uploaded to a designated Dropbox folder
2. **Webhook Trigger**: Dropbox webhook notifies the system when new files are added
3. **Audio Processing**: System downloads and transcribes the audio using OpenAI Whisper
4. **Key Point Extraction**: AI extracts important information from the transcript
5. **Notion Integration**: Structured data is automatically imported into Notion

## Cost-Effective Architecture

- **Railway**: Hosts the webhook server and processing logic
- **OpenAI Whisper**: Free tier for transcription (up to 3 hours/month)
- **OpenAI GPT-3.5-turbo**: Minimal cost for key point extraction
- **Dropbox API**: Free tier with generous limits
- **Notion API**: Free tier available

## Project Structure

```
dropbox-notion-automation/
├── src/
│   ├── server.js          # Main webhook server
│   ├── dropbox-handler.js # Dropbox file processing
│   ├── transcription.js   # Audio transcription logic
│   ├── notion-handler.js  # Notion integration
│   └── utils.js           # Utility functions
├── config/
│   └── config.js          # Configuration settings
├── package.json
├── .env.example
└── README.md
```

## Setup Instructions

1. Clone this repository
2. Install dependencies: `npm install`
3. Set up environment variables (see `.env.example`)
4. Deploy to Railway
5. Configure Dropbox webhook
6. Set up Notion integration

## Environment Variables

- `DROPBOX_ACCESS_TOKEN`: Your Dropbox API access token
- `NOTION_API_KEY`: Your Notion integration token
- `NOTION_DATABASE_ID`: Target Notion database ID
- `OPENAI_API_KEY`: OpenAI API key for transcription and analysis
- `RAILWAY_URL`: Your Railway deployment URL

## Features

- ✅ Automatic file detection via Dropbox webhooks
- ✅ Audio transcription using OpenAI Whisper
- ✅ Key point extraction and summarization
- ✅ Structured data import to Notion
- ✅ Error handling and logging
- ✅ Cost monitoring and optimization 