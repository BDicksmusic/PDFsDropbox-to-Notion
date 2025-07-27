const OpenAI = require('openai');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config/config');
const { logger, estimateCost, formatDuration } = require('./utils');

class TranscriptionHandler {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey
    });
  }

  // Transcribe audio file using OpenAI Whisper
  async transcribeAudio(filePath) {
    try {
      logger.info(`Starting transcription for: ${path.basename(filePath)}`);

      const fileBuffer = await fs.readFile(filePath);
      const fileSize = fileBuffer.length;
      const estimatedMinutes = this.estimateAudioDuration(fileSize);
      const estimatedCost = estimateCost(estimatedMinutes, 0, 'whisper-1');

      logger.info(`Estimated audio duration: ${formatDuration(estimatedMinutes * 60)}`);
      logger.info(`Estimated cost: $${estimatedCost.toFixed(4)}`);

      // Create a file object with the required properties for OpenAI API
      const file = new File([fileBuffer], path.basename(filePath), {
        type: this.getMimeType(path.extname(filePath))
      });

      const transcription = await this.openai.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        response_format: 'verbose_json',
        language: 'en'
      });

      logger.info(`Transcription completed successfully`);
      logger.info(`Actual duration: ${formatDuration(transcription.duration)}`);
      logger.info(`Word count: ${transcription.text.split(' ').length}`);

      return {
        text: transcription.text,
        duration: transcription.duration,
        language: transcription.language,
        segments: transcription.segments || [],
        wordCount: transcription.text.split(' ').length
      };

    } catch (error) {
      logger.error(`Transcription failed for ${path.basename(filePath)}:`, error.message);
      throw error;
    }
  }

  // Extract key points from transcript using GPT-3.5-turbo
  async extractKeyPoints(transcript, fileName) {
    try {
      logger.info(`Extracting key points from transcript for: ${fileName}`);

      const prompt = this.buildKeyPointsPrompt(transcript.text);
      const estimatedTokens = Math.ceil(transcript.text.length / 4) + 500; // Rough estimation
      const estimatedCost = estimateCost(estimatedTokens, 300, 'gpt-3.5-turbo');

      logger.info(`Estimated tokens: ${estimatedTokens}`);
      logger.info(`Estimated cost: $${estimatedCost.toFixed(4)}`);

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that extracts key information from voice recordings. Provide structured, actionable insights.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.3
      });

      const response = completion.choices[0].message.content;
      const keyPoints = this.parseKeyPointsResponse(response);

      logger.info(`Key points extraction completed`);
      logger.info(`Actual tokens used: ${completion.usage.total_tokens}`);
      logger.info(`Actual cost: $${estimateCost(completion.usage.prompt_tokens, completion.usage.completion_tokens, 'gpt-3.5-turbo').toFixed(4)}`);

      return {
        summary: keyPoints.summary,
        keyPoints: keyPoints.points,
        actionItems: keyPoints.actionItems,
        topics: keyPoints.topics,
        sentiment: keyPoints.sentiment,
        wordCount: transcript.wordCount,
        duration: transcript.duration
      };

    } catch (error) {
      logger.error(`Key points extraction failed for ${fileName}:`, error.message);
      throw error;
    }
  }

  // Build prompt for key points extraction
  buildKeyPointsPrompt(transcriptText) {
    return `Please analyze the following voice recording transcript and extract key information in a structured format:

TRANSCRIPT:
${transcriptText}

Please provide the following in JSON format:
1. A brief summary (2-3 sentences)
2. Key points (3-5 main points discussed)
3. Action items (if any tasks or follow-ups mentioned)
4. Topics covered (categories/themes)
5. Overall sentiment (positive, neutral, negative, or mixed)

Format your response as valid JSON with these fields:
{
  "summary": "brief summary",
  "keyPoints": ["point1", "point2", "point3"],
  "actionItems": ["action1", "action2"],
  "topics": ["topic1", "topic2"],
  "sentiment": "positive/neutral/negative/mixed"
}`;
  }

  // Parse the AI response into structured data
  parseKeyPointsResponse(response) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback parsing if JSON extraction fails
      return this.fallbackParse(response);
    } catch (error) {
      logger.warn('Failed to parse AI response as JSON, using fallback parsing');
      return this.fallbackParse(response);
    }
  }

  // Fallback parsing method
  fallbackParse(response) {
    const lines = response.split('\n').filter(line => line.trim());
    
    return {
      summary: lines.find(line => line.toLowerCase().includes('summary'))?.split(':')[1]?.trim() || 'Summary not available',
      keyPoints: lines.filter(line => line.includes('•') || line.includes('-')).map(line => line.replace(/^[•\-]\s*/, '').trim()),
      actionItems: lines.filter(line => line.toLowerCase().includes('action') || line.toLowerCase().includes('task')).map(line => line.replace(/^[•\-]\s*/, '').trim()),
      topics: lines.filter(line => line.toLowerCase().includes('topic') || line.toLowerCase().includes('theme')).map(line => line.replace(/^[•\-]\s*/, '').trim()),
      sentiment: lines.find(line => line.toLowerCase().includes('sentiment'))?.split(':')[1]?.trim() || 'neutral'
    };
  }

  // Get MIME type for file extension
  getMimeType(extension) {
    const mimeTypes = {
      '.mp3': 'audio/mpeg',
      '.m4a': 'audio/mp4',
      '.wav': 'audio/wav',
      '.flac': 'audio/flac',
      '.ogg': 'audio/ogg',
      '.webm': 'audio/webm'
    };
    return mimeTypes[extension.toLowerCase()] || 'audio/mpeg';
  }

  // Estimate audio duration based on file size (rough approximation)
  estimateAudioDuration(fileSizeInBytes) {
    // Rough estimation: 1MB ≈ 1 minute for compressed audio
    const sizeInMB = fileSizeInBytes / (1024 * 1024);
    return Math.max(1, Math.min(60, sizeInMB)); // Between 1 minute and 60 minutes
  }

  // Process complete audio file (transcribe + extract key points)
  async processAudioFile(filePath, fileName) {
    try {
      logger.info(`Starting complete audio processing for: ${fileName}`);

      // Step 1: Transcribe audio
      const transcription = await this.transcribeAudio(filePath);

      // Step 2: Extract key points
      const keyPoints = await this.extractKeyPoints(transcription, fileName);

      // Combine results
      const result = {
        fileName: fileName,
        originalText: transcription.text,
        summary: keyPoints.summary,
        keyPoints: keyPoints.keyPoints,
        actionItems: keyPoints.actionItems,
        topics: keyPoints.topics,
        sentiment: keyPoints.sentiment,
        metadata: {
          duration: transcription.duration,
          wordCount: transcription.wordCount,
          language: transcription.language,
          processedAt: new Date().toISOString()
        }
      };

      logger.info(`Audio processing completed successfully for: ${fileName}`);
      return result;

    } catch (error) {
      logger.error(`Audio processing failed for ${fileName}:`, error.message);
      throw error;
    }
  }
}

module.exports = TranscriptionHandler; 