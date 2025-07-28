# Automation-Connections

A powerful automation service that processes audio recordings and documents from Dropbox and automatically creates structured pages in Notion with AI-powered analysis.

## Features

### Audio Processing
- **Automatic Transcription**: Converts audio files (MP3, WAV, M4A, FLAC) to text using OpenAI Whisper
- **AI Analysis**: Extracts key points, action items, and generates summaries using GPT-3.5-turbo
- **Smart Organization**: Creates structured Notion pages with categorized content
- **Duplicate Prevention**: Prevents processing the same file multiple times

### Document Processing
- **PDF Text Extraction**: Extracts text from PDF files using pdf-parse
- **Image OCR**: Extracts text from images (JPG, PNG, BMP, TIFF, WebP) using Tesseract.js
- **Document Analysis**: Processes Word documents (.docx, .doc) using mammoth
- **AI Content Analysis**: Analyzes extracted text for key points, summaries, and action items
- **File Upload**: Optionally uploads original files to Notion for reference

### Webhook Integration
- **Real-time Processing**: Automatically processes new files via Dropbox webhooks
- **Dual Folder Monitoring**: Monitors separate folders for audio and document files
- **Deduplication**: Prevents duplicate processing with URL and filename tracking
- **Error Handling**: Robust error handling and retry mechanisms

## Supported File Types

### Audio Files
- MP3, WAV, M4A, FLAC, AAC, OGG

### Document Files
- **PDFs**: Full text extraction and analysis
- **Images**: OCR text extraction (JPG, JPEG, PNG, BMP, TIFF, TIF, WebP)
- **Word Documents**: Text extraction from .docx and .doc files

## Architecture

```
Dropbox Folders
├── /Recordings (Audio files)
└── /PDFs (Documents & Images)
    ↓
Webhook Notifications
    ↓
File Type Detection
    ↓
Processing Pipeline
├── Audio → Whisper → GPT Analysis → Notion Audio DB
└── Documents → Text Extraction → GPT Analysis → Notion PDF DB
```

## Setup

### 1. Environment Configuration

Copy `env.example` to `.env` and configure:

```bash
# Dropbox Configuration
DROPBOX_ACCESS_TOKEN=your_dropbox_access_token_here
DROPBOX_REFRESH_TOKEN=your_dropbox_refresh_token_here
DROPBOX_APP_KEY=your_dropbox_app_key_here
DROPBOX_APP_SECRET=your_dropbox_app_secret_here
DROPBOX_WEBHOOK_SECRET=your_webhook_secret_here
DROPBOX_FOLDER_PATH=/Recordings
DROPBOX_PDF_FOLDER_PATH=/PDFs

# Notion Configuration
NOTION_API_KEY=your_notion_api_key_here
NOTION_DATABASE_ID=your_audio_database_id_here
NOTION_PDF_DATABASE_ID=your_pdf_database_id_here

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Processing Configuration
MAX_FILE_SIZE_MB=50
SUPPORTED_AUDIO_FORMATS=mp3,wav,m4a,flac
SUPPORTED_DOCUMENT_FORMATS=pdf,jpg,jpeg,png,bmp,tiff,tif,webp,docx,doc

# Document Processing
OCR_LANGUAGE=eng
OCR_CONFIDENCE_THRESHOLD=60
ENABLE_IMAGE_PREPROCESSING=true
UPLOAD_FILES_TO_NOTION=true
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Dropbox Setup

1. Create a Dropbox app at https://www.dropbox.com/developers/apps
2. Configure OAuth 2 redirect URI
3. Generate access token and refresh token
4. Set up webhook URL: `https://your-domain.com/webhook`

### 4. Notion Setup

1. Create two databases in Notion:
   - **Audio Database**: For voice recordings and transcriptions
   - **PDF Database**: For documents and extracted text

2. Required database properties:
   - **Audio DB**: Name, Main Entry, URL, Status, Audio Log?
   - **PDF DB**: Name, Main Entry, URL, Status, Document Type

3. Share databases with your Notion integration

### 5. Folder Structure

Create these folders in your Dropbox:
- `/Recordings` - For audio files
- `/PDFs` - For documents and images

## Usage

### Start the Server

```bash
npm start
```

### Manual File Processing

```bash
# Process audio file
curl -X POST http://localhost:3000/process-file \
  -H "Content-Type: application/json" \
  -d '{"filePath": "/Recordings/meeting.mp3"}'

# Process document with custom name
curl -X POST http://localhost:3000/process-file-with-name \
  -H "Content-Type: application/json" \
  -d '{"filePath": "/PDFs/report.pdf", "customName": "Q4 Report"}'

# Force reprocess file
curl -X POST http://localhost:3000/force-reprocess-file \
  -H "Content-Type: application/json" \
  -d '{"filePath": "/PDFs/image.jpg"}'
```

### Health Check

```bash
curl http://localhost:3000/health
```

### System Status

```bash
curl http://localhost:3000/status
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Service status |
| `/health` | GET | Health check |
| `/status` | GET | System status with service connections |
| `/webhook` | GET | Dropbox webhook verification |
| `/webhook` | POST | Dropbox webhook notifications |
| `/process-file` | POST | Manual file processing |
| `/process-file-with-name` | POST | Manual processing with custom name |
| `/force-reprocess-file` | POST | Force reprocess existing file |

## Processing Pipeline

### Audio Files
1. **Download**: File downloaded from Dropbox
2. **Transcribe**: OpenAI Whisper converts audio to text
3. **Analyze**: GPT-3.5-turbo extracts key points, summary, action items
4. **Create Page**: Structured Notion page in audio database
5. **Cleanup**: Temporary files removed

### Document Files
1. **Download**: File downloaded from Dropbox
2. **Extract Text**: 
   - PDF: pdf-parse library
   - Images: Tesseract.js OCR with preprocessing
   - Word: mammoth library
3. **Analyze**: GPT-3.5-turbo analyzes extracted text
4. **Create Page**: Structured Notion page in PDF database
5. **Upload File**: Original file uploaded to Notion (optional)
6. **Cleanup**: Temporary files removed

## Configuration Options

### Document Processing
- `OCR_LANGUAGE`: Language for OCR (default: eng)
- `OCR_CONFIDENCE_THRESHOLD`: Minimum confidence for OCR results
- `ENABLE_IMAGE_PREPROCESSING`: Optimize images for better OCR
- `UPLOAD_FILES_TO_NOTION`: Upload original files to Notion

### File Size Limits
- `MAX_FILE_SIZE_MB`: Maximum file size (default: 50MB)

### AI Models
- `TRANSCRIPTION_MODEL`: Whisper model (default: whisper-1)
- `ANALYSIS_MODEL`: GPT model for analysis (default: gpt-3.5-turbo)

## Deployment

### Railway Deployment
1. Connect your GitHub repository to Railway
2. Set environment variables in Railway dashboard
3. Deploy automatically on push

### Local Development
```bash
npm run dev
```

## Troubleshooting

### Common Issues

1. **Webhook Not Working**
   - Verify webhook URL is accessible
   - Check Dropbox app permissions
   - Ensure webhook secret is configured

2. **OCR Quality Issues**
   - Enable image preprocessing
   - Check image resolution and quality
   - Adjust OCR confidence threshold

3. **File Upload Failures**
   - Check file size limits
   - Verify supported formats
   - Ensure proper file permissions

4. **Notion Connection Issues**
   - Verify API key and database IDs
   - Check database permissions
   - Ensure required properties exist

### Logs

Check logs for detailed error information:
```bash
# View logs
tail -f logs/app.log

# Check specific errors
grep "ERROR" logs/app.log
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review logs for error details
3. Open an issue on GitHub

---

**Note**: This service requires OpenAI API credits for transcription and analysis. Monitor your usage to avoid unexpected charges. 