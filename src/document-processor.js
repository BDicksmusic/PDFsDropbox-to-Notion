const OpenAI = require('openai');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config/config');
const { logger, estimateCost } = require('./utils');

class DocumentProcessor {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey
    });
  }

  // Process a document (PDF or image)
  async processDocument(filePath) {
    try {
      const fileExtension = path.extname(filePath).toLowerCase();
      const fileName = path.basename(filePath);
      
      logger.info(`Starting document processing for: ${fileName}`);

      let extractedData;
      
      if (fileExtension === '.pdf') {
        extractedData = await this.processPDF(filePath);
      } else {
        // Image file
        extractedData = await this.processImage(filePath);
      }

      // Extract key information using AI
      const analysis = await this.analyzeContent(extractedData.text, extractedData.type);
      
      logger.info(`Document processing completed successfully`);
      logger.info(`Extracted text length: ${extractedData.text.length} characters`);
      logger.info(`Total cost: $${(extractedData.cost + analysis.cost).toFixed(4)}`);

      return {
        text: extractedData.text,
        originalText: extractedData.text, // For Notion compatibility
        keyPoints: analysis.keyPoints,
        summary: analysis.summary,
        generatedTitle: analysis.title || path.basename(filePath, path.extname(filePath)),
        actionItems: analysis.actionItems || [],
        topics: analysis.topics || [],
        sentiment: 'neutral', // Default sentiment for documents
        metadata: {
          ...extractedData.metadata,
          wordCount: extractedData.text.split(' ').length,
          characterCount: extractedData.text.length,
          processingCost: extractedData.cost + analysis.cost,
          documentType: extractedData.type
        }
      };

    } catch (error) {
      logger.error(`Document processing failed for ${path.basename(filePath)}:`, error.message);
      throw error;
    }
  }

  // Process PDF files by converting to images first
  async processPDF(filePath) {
    try {
      logger.info('Processing PDF - converting to image for vision model');
      
      // For now, we'll use a simple text extraction approach
      // In production, you'd want to use pdf-parse or similar library
      const fileBuffer = await fs.readFile(filePath);
      
      // Use a simple text extraction approach since vision model doesn't support PDFs directly
      // This is a fallback - ideally use pdf-parse for better text extraction
      const extractedText = `PDF Document: ${path.basename(filePath)}\n\nThis is a placeholder for PDF text extraction. In a production environment, you would use a library like pdf-parse to extract text from PDF files.`;
      
      const cost = 0.001; // Minimal cost for placeholder processing

      return {
        text: extractedText,
        type: 'pdf',
        metadata: {
          fileName: path.basename(filePath),
          fileSize: fileBuffer.length,
          processedAt: new Date().toISOString(),
          note: 'PDF text extraction placeholder - implement pdf-parse for full functionality'
        },
        cost: cost
      };
    } catch (error) {
      logger.error('PDF processing error:', error);
      throw error;
    }
  }

  // Process image files
  async processImage(filePath) {
    try {
      const fileBuffer = await fs.readFile(filePath);
      const base64Image = fileBuffer.toString('base64');
      const mimeType = this.getMimeType(path.extname(filePath));
      
      logger.info('Processing image with AI vision model');
      
      const response = await this.openai.chat.completions.create({
        model: config.documents.visionModel,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: config.documents.extractionPrompt || 
                      "Extract all text content from this image. If this is a document, maintain the structure. If it contains tables, preserve the table format. Include all visible text."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                  detail: config.documents.imageDetail
                }
              }
            ]
          }
        ],
        max_tokens: config.documents.visionMaxTokens,
        temperature: config.documents.visionTemperature
      });

      const extractedText = response.choices[0].message.content;
      const cost = estimateCost(
        response.usage.prompt_tokens,
        response.usage.completion_tokens,
        config.documents.visionModel
      );

      return {
        text: extractedText,
        type: 'image',
        metadata: {
          fileName: path.basename(filePath),
          fileSize: fileBuffer.length,
          mimeType: mimeType,
          processedAt: new Date().toISOString()
        },
        cost: cost
      };
    } catch (error) {
      logger.error('Image processing error:', error);
      throw error;
    }
  }

  // Analyze extracted content to get key points and summary
  async analyzeContent(text, documentType) {
    try {
      const systemPrompt = `You are an AI assistant that analyzes ${documentType} content and extracts key information.`;
      
      const userPrompt = config.documents.extractionPrompt || 
        `Analyze the following text and provide:
1. A suitable title for this document
2. A list of key points (bullet points)
3. A brief summary (2-3 sentences)
4. Any action items or tasks mentioned
5. Main topics or themes discussed

Format your response as JSON with the following structure:
{
  "title": "Document title",
  "keyPoints": ["point 1", "point 2", ...],
  "summary": "Brief summary here",
  "actionItems": ["action 1", "action 2", ...],
  "topics": ["topic 1", "topic 2", ...]
}

Text to analyze:
${text}`;

      const response = await this.openai.chat.completions.create({
        model: config.documents.documentAnalysisModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: config.documents.documentMaxTokens,
        temperature: config.documents.documentTemperature,
        response_format: { type: "json_object" }
      });

      const analysis = JSON.parse(response.choices[0].message.content);
      const cost = estimateCost(
        response.usage.prompt_tokens,
        response.usage.completion_tokens,
        config.documents.documentAnalysisModel
      );

      return {
        title: analysis.title || '',
        keyPoints: analysis.keyPoints || [],
        summary: analysis.summary || '',
        actionItems: analysis.actionItems || [],
        topics: analysis.topics || [],
        cost: cost
      };
    } catch (error) {
      logger.error('Content analysis error:', error);
      // Return default structure on error
      return {
        title: 'Error',
        keyPoints: ['Error extracting key points'],
        summary: 'Error generating summary',
        actionItems: [],
        topics: [],
        cost: 0
      };
    }
  }

  // Get MIME type for image files
  getMimeType(extension) {
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.tiff': 'image/tiff',
      '.pdf': 'application/pdf'
    };
    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
  }
}

module.exports = DocumentProcessor;