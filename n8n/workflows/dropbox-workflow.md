# Dropbox to Notion Workflow

## Overview
This workflow processes PDFs and documents from Dropbox and creates Notion pages with AI analysis.

## Workflow Steps

### 1. Dropbox Webhook Trigger
```
Node: Dropbox Trigger
- Event: File Created
- Folder: /Apps/PDFs
- File Types: pdf, doc, docx, jpg, jpeg, png
```

### 2. Filter Files
```
Node: IF
- Condition: {{ $json['.tag'] === 'file' }}
- AND: {{ $json['path_lower'].includes('/apps/pdfs') }}
```

### 3. Download File
```
Node: Dropbox
- Operation: Download
- File Path: {{ $json['path_display'] }}
```

### 4. Extract Text
```
Node: Code (JavaScript)
- Code: Extract text from PDF/image using OCR
```

### 5. OpenAI Analysis
```
Node: OpenAI
- Model: gpt-3.5-turbo
- Prompt: Analyze this document and provide:
  - Summary
  - Key Points
  - Action Items
  - Topics
  - Sentiment
```

### 6. Create Notion Page
```
Node: Notion
- Operation: Create Page
- Database: PDF Database
- Properties:
  - Name: {{ $json['name'] }}
  - URL: {{ $json['link'] }}
  - Summary: {{ OpenAI Response }}
  - Status: 📥 Processing
```

## Setup Instructions

1. **Create Dropbox App**
   - Go to Dropbox App Console
   - Create new app
   - Set redirect URI to your N8N webhook URL
   - Get access token

2. **Configure Dropbox Trigger**
   - Add Dropbox credentials
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

1. Upload a test PDF to `/Apps/PDFs` folder
2. Monitor workflow execution in N8N
3. Verify Notion page creation
4. Check AI analysis quality

## Troubleshooting

- **Webhook not firing**: Check Dropbox app permissions
- **File download fails**: Verify file path and permissions
- **Notion creation fails**: Check database ID and properties
- **OpenAI errors**: Verify API key and quota