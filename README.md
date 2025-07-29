# PDF & Image to Notion Automation

A cost-effective automation system that processes PDF documents and images from Dropbox, extracts text and key information using AI, and imports the structured data into Notion.

## System Overview

1. **Document Upload**: PDF files or images are uploaded to a designated Dropbox folder
2. **Webhook Trigger**: Dropbox webhook notifies the system when new files are added
3. **Document Processing**: System downloads and processes documents using OpenAI Vision API
4. **Information Extraction**: AI extracts text, key points, and structured information
5. **Notion Integration**: Structured data is automatically imported into Notion

## Cost-Effective Architecture

- **Railway**: Hosts the webhook server and processing logic
- **OpenAI GPT-4 Vision**: For PDF and image text extraction and analysis
- **OpenAI GPT-3.5-turbo**: For content analysis and structuring
- **Dropbox API**: Free tier with generous limits
- **Notion API**: Free tier available

## Project Structure

```
pdf-dropbox-to-notion/
├── src/
│   ├── server.js              # Main webhook server
│   ├── dropbox-handler.js     # Dropbox file processing
│   ├── document-processor.js  # PDF/Image processing logic
│   ├── notion-handler.js      # Notion integration
│   └── utils.js               # Utility functions
├── config/
│   └── config.js              # Configuration settings
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
- `OPENAI_API_KEY`: OpenAI API key for document processing
- `RAILWAY_URL`: Your Railway deployment URL

## Features

- ✅ Automatic file detection via Dropbox webhooks
- ✅ PDF text extraction and processing
- ✅ Image OCR and text extraction
- ✅ Key point extraction and summarization
- ✅ Structured data import to Notion
- ✅ Error handling and logging
- ✅ Cost monitoring and optimization 