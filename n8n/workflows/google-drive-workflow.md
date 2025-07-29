# Google Drive to Notion Workflow

## Overview
This workflow processes audio files from Google Drive, transcribes them, and creates Notion pages with AI analysis.

## Workflow Steps

### 1. Google Drive Webhook Trigger
```
Node: Google Drive Trigger
- Event: File Created
- Folder: {{ AUDIO_FOLDER_ID }}
- File Types: mp3, wav, m4a, flac
```

### 2. Filter Files
```
Node: IF
- Condition: {{ $json['mimeType'].includes('audio') }}
```

### 3. Download File
```
Node: Google Drive
- Operation: Download
- File ID: {{ $json['id'] }}
```

### 4. OpenAI Whisper Transcription
```
Node: OpenAI
- Model: whisper-1
- Audio File: {{ Downloaded File }}
```

### 5. OpenAI Analysis
```
Node: OpenAI
- Model: gpt-3.5-turbo
- Prompt: Analyze this transcript and provide:
  - Summary
  - Key Points
  - Action Items
  - Topics
  - Sentiment
  - Title
```

### 6. Create Notion Page
```
Node: Notion
- Operation: Create Page
- Database: Audio Database
- Properties:
  - Name: {{ Generated Title }}
  - URL: {{ $json['webViewLink'] }}
  - Summary: {{ OpenAI Response }}
  - Status: 📥 Processing
  - Audio Log?: true
```

## Setup Instructions

1. **Create Google Drive App**
   - Go to Google Cloud Console
   - Enable Drive API
   - Create OAuth 2.0 credentials
   - Set redirect URI to your N8N webhook URL

2. **Configure Google Drive Trigger**
   - Add Google Drive credentials
   - Set webhook URL
   - Test webhook delivery

3. **Set Up Notion Database**
   - Create database with required properties
   - Get database ID
   - Add Notion credentials

4. **Configure OpenAI**
   - Add OpenAI API key
   - Test API connection

## Testing

1. Upload a test audio file to your Google Drive folder
2. Monitor workflow execution in N8N
3. Verify Notion page creation
4. Check transcription and AI analysis quality

## Troubleshooting

- **Webhook not firing**: Check Google Drive API permissions
- **File download fails**: Verify file permissions and quota
- **Transcription fails**: Check audio file format and OpenAI quota
- **Notion creation fails**: Check database ID and properties
- **OpenAI errors**: Verify API key and quota

## Environment Variables

Make sure these are set in Railway:
- `GOOGLE_DRIVE_CLIENT_ID`
- `GOOGLE_DRIVE_CLIENT_SECRET`
- `GOOGLE_DRIVE_REFRESH_TOKEN`
- `AUDIO_FOLDER_ID` (your Google Drive folder ID)