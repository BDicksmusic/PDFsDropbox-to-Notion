# N8N Automation for Dropbox/Google Drive to Notion

This repository contains N8N workflows for automating file processing from Dropbox and Google Drive to Notion.

## Features

- **Dropbox Integration**: Process PDFs and documents
- **Google Drive Integration**: Process audio files with transcription
- **Notion Integration**: Create structured pages with AI analysis
- **OpenAI Integration**: Text extraction, transcription, and analysis

## Quick Start

### 1. Deploy to Railway

1. Go to [Railway.app](https://railway.app)
2. Create new project
3. Connect this GitHub repository
4. Add PostgreSQL database
5. Set environment variables (see below)

### 2. Environment Variables

Set these in your Railway project:

```bash
# N8N Configuration
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=your-secure-password
N8N_HOST=0.0.0.0
N8N_PORT=3000
N8N_PROTOCOL=https
WEBHOOK_URL=https://your-app.railway.app
N8N_ENCRYPTION_KEY=your-32-character-encryption-key

# Database
DB_TYPE=postgresdb
DB_POSTGRESDB_HOST=${DATABASE_URL}
DB_POSTGRESDB_PORT=5432
DB_POSTGRESDB_DATABASE=n8n
DB_POSTGRESDB_USER=${DATABASE_USER}
DB_POSTGRESDB_PASSWORD=${DATABASE_PASSWORD}

# API Keys
DROPBOX_ACCESS_TOKEN=your-dropbox-access-token
GOOGLE_DRIVE_CLIENT_ID=your-google-client-id
GOOGLE_DRIVE_CLIENT_SECRET=your-google-client-secret
GOOGLE_DRIVE_REFRESH_TOKEN=your-google-refresh-token
NOTION_API_KEY=your-notion-api-key
OPENAI_API_KEY=your-openai-api-key
```

### 3. Access N8N Dashboard

Once deployed, access your N8N dashboard at:
`https://your-app.railway.app`

Login with:
- Username: `admin`
- Password: `your-secure-password`

### 4. Import Workflows

1. Create the Dropbox workflow (see `workflows/dropbox-workflow.md`)
2. Create the Google Drive workflow (see `workflows/google-drive-workflow.md`)
3. Test with sample files

## Local Development

```bash
# Install dependencies
npm install

# Start N8N locally
npm run dev
```

## Workflows

### Dropbox Workflow
- **Trigger**: Dropbox webhook
- **Process**: PDFs and documents
- **Output**: Notion pages with AI analysis

### Google Drive Workflow
- **Trigger**: Google Drive webhook
- **Process**: Audio files
- **Output**: Notion pages with transcription and analysis

## File Structure

```
n8n/
├── Dockerfile              # Docker configuration
├── docker-compose.yml      # Local development
├── package.json           # Dependencies
├── README.md             # This file
└── workflows/            # Workflow documentation
    ├── dropbox-workflow.md
    └── google-drive-workflow.md
```

## Support

For issues or questions, please refer to the main repository documentation.