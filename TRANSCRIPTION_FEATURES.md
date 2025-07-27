# Transcription Features and Configuration

This document describes the enhanced transcription features and configuration options available in the Automation-Connections system.

## Auto-Formatting Features

### Paragraph Breaks
The system can automatically add paragraph breaks to transcriptions based on natural speech patterns:

- **PARAGRAPH_BREAK_THRESHOLD**: Minimum characters before considering a paragraph break (default: 150)
- **Transition Detection**: Automatically detects common transition words like "now", "so", "well", "okay", etc.
- **Natural Breaks**: Identifies natural speech breaks and pauses

### Automatic Titles
For longer transcriptions, the system can automatically add section titles:

- **ADD_TITLES_TO_TRANSCRIPTION**: Enable/disable automatic titles (default: true)
- **TITLE_FREQUENCY**: Characters between titles (default: 1000)
- **Smart Title Generation**: Creates titles based on the first few words of each section

## Configuration Options

### Environment Variables

```bash
# Auto-formatting settings
AUTO_FORMAT_TRANSCRIPTION=true
ADD_TITLES_TO_TRANSCRIPTION=true
PARAGRAPH_BREAK_THRESHOLD=150
TITLE_FREQUENCY=1000

# Custom prompts (optional)
KEY_POINTS_PROMPT=your_custom_prompt_here
SUMMARY_PROMPT=your_custom_summary_prompt_here

# Model settings
TRANSCRIPTION_MODEL=whisper-1
ANALYSIS_MODEL=gpt-3.5-turbo
MAX_TOKENS=500
TEMPERATURE=0.3
```

### Custom Prompts

You can customize the prompts used for key points extraction and summarization:

#### Key Points Prompt
Use the `KEY_POINTS_PROMPT` environment variable to set a custom prompt. Use `{TRANSCRIPT}` as a placeholder for the transcript text.

Example:
```bash
KEY_POINTS_PROMPT="Analyze this transcript and extract the main points: {TRANSCRIPT}"
```

#### Summary Prompt
Use the `SUMMARY_PROMPT` environment variable for custom summary prompts.

## Manual Processing with Custom Names

### Endpoints

1. **Standard Manual Processing**
   ```
   POST /process-file
   {
     "filePath": "/path/to/file.m4a",
     "customName": "Optional Custom Name"
   }
   ```

2. **Custom Name Required**
   ```
   POST /process-file-with-name
   {
     "filePath": "/path/to/file.m4a",
     "customName": "Required Custom Name"
   }
   ```

### Benefits
- Use descriptive names instead of file names
- Better organization in Notion
- Consistent naming conventions

## Duplicate Prevention

The system now includes robust duplicate prevention:

- **File Tracking**: Maintains a list of processed files
- **Processing State**: Tracks files currently being processed
- **Error Recovery**: Failed files can be retried without creating duplicates
- **Webhook Handling**: Prevents duplicate processing from multiple webhook events

## Error Handling Improvements

- **File Existence Checks**: Validates files exist before processing
- **Transcription Validation**: Only creates Notion pages for successful transcriptions
- **Graceful Cleanup**: Properly cleans up temporary files even on errors
- **Better Logging**: More detailed error messages and debugging information

## Example Usage

### Basic Auto-formatting
```bash
# Enable auto-formatting with default settings
AUTO_FORMAT_TRANSCRIPTION=true
ADD_TITLES_TO_TRANSCRIPTION=true
```

### Custom Configuration
```bash
# More aggressive paragraph breaks
PARAGRAPH_BREAK_THRESHOLD=100

# More frequent titles
TITLE_FREQUENCY=500

# Custom prompt for technical content
KEY_POINTS_PROMPT="Extract technical specifications and requirements from: {TRANSCRIPT}"
```

### Manual Processing with Custom Name
```bash
curl -X POST http://localhost:3000/process-file-with-name \
  -H "Content-Type: application/json" \
  -d '{
    "filePath": "/Recordings/meeting-2024-01-15.m4a",
    "customName": "Q1 Planning Meeting - January 15, 2024"
  }'
```

## Troubleshooting

### Common Issues

1. **Files not being processed**
   - Check if files are already in the processed list
   - Verify file format is supported
   - Check file size limits

2. **Transcription failures**
   - Verify OpenAI API key is valid
   - Check file exists and is accessible
   - Review error logs for specific issues

3. **Duplicate pages in Notion**
   - The system should prevent this automatically
   - Check if multiple webhooks are being sent
   - Verify file tracking is working

### Debugging

Enable detailed logging:
```bash
LOG_LEVEL=debug
```

Check processed files:
```javascript
// In your application
const dropboxHandler = new DropboxHandler();
console.log(dropboxHandler.getProcessedFiles());
``` 