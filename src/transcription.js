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
        model: config.transcription.transcriptionModel,
        response_format: 'verbose_json',
        language: 'en'
      });

      logger.info(`Transcription completed successfully`);
      logger.info(`Actual duration: ${formatDuration(transcription.duration)}`);
      logger.info(`Word count: ${transcription.text.split(' ').length}`);

      // Auto-format the transcription if enabled
      let formattedText = transcription.text;
      if (config.transcription.autoFormat) {
        formattedText = this.autoFormatTranscription(transcription.text);
      }

      return {
        text: formattedText,
        originalText: transcription.text, // Keep original for reference
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

  // Auto-format transcription with paragraphs and titles
  autoFormatTranscription(text) {
    if (!text || text.length < config.transcription.paragraphBreakThreshold) {
      return text;
    }

    let formattedText = text;
    
    // Add paragraph breaks for natural speech patterns
    formattedText = this.addParagraphBreaks(formattedText);
    
    // Add titles if enabled
    if (config.transcription.addTitles) {
      formattedText = this.addTitles(formattedText);
    }

    return formattedText;
  }

  // Add paragraph breaks based on natural speech patterns
  addParagraphBreaks(text) {
    // Split by sentences and group into paragraphs
    const sentences = text.split(/(?<=[.!?])\s+/);
    const paragraphs = [];
    let currentParagraph = '';

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      currentParagraph += sentence + ' ';

      // Start new paragraph if:
      // 1. Current paragraph is long enough
      // 2. Next sentence starts with common paragraph transition words
      // 3. We're at a natural break point
      const shouldBreak = 
        currentParagraph.length > config.transcription.paragraphBreakThreshold &&
        (i === sentences.length - 1 || 
         this.isParagraphTransition(sentences[i + 1]) ||
         this.isNaturalBreak(sentence));

      if (shouldBreak) {
        paragraphs.push(currentParagraph.trim());
        currentParagraph = '';
      }
    }

    // Add any remaining text
    if (currentParagraph.trim()) {
      paragraphs.push(currentParagraph.trim());
    }

    return paragraphs.join('\n\n');
  }

  // Check if sentence indicates a paragraph transition
  isParagraphTransition(sentence) {
    if (!sentence) return false;
    
    const transitionWords = [
      'now', 'so', 'well', 'okay', 'right', 'alright', 'anyway',
      'moving on', 'next', 'first', 'second', 'third', 'finally',
      'in addition', 'furthermore', 'moreover', 'however', 'but',
      'on the other hand', 'meanwhile', 'later', 'earlier'
    ];

    const lowerSentence = sentence.toLowerCase();
    return transitionWords.some(word => lowerSentence.startsWith(word));
  }

  // Check if sentence ends with a natural break
  isNaturalBreak(sentence) {
    if (!sentence) return false;
    
    // Natural breaks often end with certain punctuation or phrases
    const naturalEndings = [
      'you know', 'right', 'okay', 'so', 'well', 'anyway'
    ];

    const lowerSentence = sentence.toLowerCase();
    return naturalEndings.some(ending => lowerSentence.endsWith(ending));
  }

  // Add titles to long transcriptions
  addTitles(text) {
    if (text.length < config.transcription.titleFrequency) {
      return text;
    }

    const paragraphs = text.split('\n\n');
    const titledParagraphs = [];
    let characterCount = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      
      // Add title every N characters
      if (characterCount >= config.transcription.titleFrequency) {
        const title = this.generateTitle(paragraph);
        titledParagraphs.push(`## ${title}\n\n${paragraph}`);
        characterCount = 0;
      } else {
        titledParagraphs.push(paragraph);
      }
      
      characterCount += paragraph.length;
    }

    return titledParagraphs.join('\n\n');
  }

  // Generate a simple title based on paragraph content
  generateTitle(paragraph) {
    // Extract key words for title
    const words = paragraph.split(' ').slice(0, 5); // First 5 words
    const title = words.join(' ').replace(/[.!?]$/, ''); // Remove trailing punctuation
    
    // Capitalize first letter of each word
    return title.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
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
        model: config.transcription.analysisModel,
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
        max_tokens: config.transcription.maxTokens,
        temperature: config.transcription.temperature
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
    // Use custom prompt if configured, otherwise use default
    if (config.transcription.keyPointsPrompt) {
      return config.transcription.keyPointsPrompt.replace('{TRANSCRIPT}', transcriptText);
    }

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

      // Step 3: Generate descriptive title
      const generatedTitle = await this.generateTitle(transcription.text, fileName);

      // Combine results
      const result = {
        fileName: fileName,
        generatedTitle: generatedTitle,
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

  // Generate a descriptive title from transcript content
  async generateTitle(transcript, fileName) {
    try {
      logger.info(`Generating title for: ${fileName}`);

      // Truncate transcript if it's too long for the API
      const maxChars = 8000; // Leave room for prompt and response
      const truncatedTranscript = transcript.length > maxChars 
        ? transcript.substring(0, maxChars) + '...' 
        : transcript;

      const response = await this.openai.chat.completions.create({
        model: config.transcription.summaryModel,
        messages: [{
          role: 'user',
          content: `Please generate a concise, descriptive title for this audio transcript. The title should be 2-7 words long and capture the main topic or purpose of the conversation.

Transcript:
${truncatedTranscript}

Generate only the title, nothing else. Examples of good titles:
- "Team Meeting Project Updates"
- "Customer Support Call Resolution" 
- "Marketing Strategy Discussion"
- "Technical Architecture Review"
- "Sales Pipeline Review Meeting"
- "Audio Recording Test"
- "Meeting Notes Discussion"`
        }],
        max_tokens: 50,
        temperature: 0.3
      });

      let title = response.choices[0].message.content.trim();
      
      // Clean up the title - remove quotes and ensure it's reasonable length
      title = title.replace(/^["']|["']$/g, ''); // Remove surrounding quotes
      
      // Ensure title is within word count limits (2-7 words)
      const words = title.split(' ').filter(word => word.length > 0);
      if (words.length < 2) {
        // If too short, add descriptive words
        title = `Audio Recording ${fileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ')}`;
      } else if (words.length > 7) {
        title = words.slice(0, 7).join(' ');
      }
      
      // Final validation - ensure we have a reasonable title
      if (!title || title.length < 3) {
        logger.warn(`Generated title too short, using fallback for ${fileName}`);
        title = this.createFallbackTitle(fileName);
      }

      logger.info(`Generated title: "${title}" for ${fileName}`);
      return title;

    } catch (error) {
      logger.error(`Title generation failed for ${fileName}:`, error.message);
      // Fallback to cleaned filename with descriptive prefix
      const fallbackTitle = this.createFallbackTitle(fileName);
      logger.info(`Using fallback title: "${fallbackTitle}"`);
      return fallbackTitle;
    }
  }

  // Create a fallback title that's always 2-7 words
  createFallbackTitle(fileName) {
    const cleanName = fileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
    const words = cleanName.split(' ').filter(word => word.length > 0);
    
    if (words.length >= 2 && words.length <= 7) {
      return words.join(' ');
    } else if (words.length > 7) {
      return words.slice(0, 7).join(' ');
    } else {
      // If filename is too short, add descriptive words
      return `Audio Recording ${cleanName}`;
    }
  }
}

module.exports = TranscriptionHandler; 