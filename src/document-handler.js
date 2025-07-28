const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const mammoth = require('mammoth');
const config = require('../config/config');
const { logger } = require('./utils');

class DocumentHandler {
  constructor() {
    this.supportedExtensions = {
      pdf: ['.pdf'],
      image: ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.webp'],
      document: ['.docx', '.doc']
    };
  }

  // Determine file type and process accordingly
  async processDocument(filePath, fileName) {
    try {
      const extension = path.extname(fileName).toLowerCase();
      const fileType = this.getFileType(extension);
      
      if (!fileType) {
        throw new Error(`Unsupported file type: ${extension}`);
      }

      logger.info(`Processing ${fileType} file: ${fileName}`);

      let extractedText = '';
      let metadata = {
        fileType: fileType,
        fileName: fileName,
        fileSize: fs.statSync(filePath).size,
        processedAt: new Date().toISOString()
      };

      switch (fileType) {
        case 'pdf':
          const pdfResult = await this.extractTextFromPDF(filePath);
          extractedText = pdfResult.text;
          metadata = { ...metadata, ...pdfResult.metadata };
          break;
        
        case 'image':
          const imageResult = await this.extractTextFromImage(filePath);
          extractedText = imageResult.text;
          metadata = { ...metadata, ...imageResult.metadata };
          break;
        
        case 'document':
          const docResult = await this.extractTextFromDocument(filePath);
          extractedText = docResult.text;
          metadata = { ...metadata, ...docResult.metadata };
          break;
        
        default:
          throw new Error(`Unsupported file type: ${fileType}`);
      }

      // Generate summary and key points using OpenAI
      const analysis = await this.analyzeContent(extractedText, fileName);

      return {
        fileName: fileName,
        originalText: extractedText,
        summary: analysis.summary,
        keyPoints: analysis.keyPoints,
        actionItems: analysis.actionItems,
        topics: analysis.topics,
        sentiment: analysis.sentiment,
        metadata: metadata,
        generatedTitle: analysis.title
      };

    } catch (error) {
      logger.error(`Failed to process document ${fileName}:`, error);
      throw error;
    }
  }

  // Get file type based on extension
  getFileType(extension) {
    for (const [type, extensions] of Object.entries(this.supportedExtensions)) {
      if (extensions.includes(extension)) {
        return type;
      }
    }
    return null;
  }

  // Extract text from PDF files
  async extractTextFromPDF(filePath) {
    try {
      logger.info(`Extracting text from PDF: ${path.basename(filePath)}`);
      
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      
      const metadata = {
        pageCount: data.numpages,
        textLength: data.text.length,
        info: data.info || {}
      };

      logger.info(`PDF processed: ${metadata.pageCount} pages, ${metadata.textLength} characters`);
      
      return {
        text: data.text,
        metadata: metadata
      };
    } catch (error) {
      logger.error(`Failed to extract text from PDF:`, error);
      
      // Check if it's a specific PDF parsing error
      if (error.name === 'InvalidPDFException') {
        logger.warn(`PDF appears to have invalid structure - attempting AI vision extraction for image-based PDF`);
        
        // Try AI vision extraction for image-based PDFs
        try {
          const aiExtractedText = await this.extractTextFromPDFWithAI(filePath);
          return {
            text: aiExtractedText,
            metadata: {
              pageCount: 1, // Assume single page for now
              textLength: aiExtractedText.length,
              info: { Title: path.basename(filePath) },
              extractionMethod: 'ai_vision',
              originalError: error.message
            }
          };
        } catch (aiError) {
          logger.error(`AI vision extraction also failed:`, aiError.message);
          
          // Return a fallback response instead of throwing
          return {
            text: `[PDF Text Extraction Failed]\n\nThis PDF could not be processed due to its structure. This commonly happens with:\n- Scanned documents (image-based PDFs)\n- Password-protected PDFs\n- Corrupted PDF files\n- PDFs with unusual formatting\n\nFile: ${path.basename(filePath)}\nError: ${error.message}\n\nAI Vision extraction also failed: ${aiError.message}`,
            metadata: {
              pageCount: 0,
              textLength: 0,
              info: { Title: path.basename(filePath) },
              extractionFailed: true,
              error: error.message,
              aiExtractionFailed: true,
              aiError: aiError.message
            }
          };
        }
      }
      
      // For other errors, still throw
      throw error;
    }
  }

  // Extract text from image-based PDFs using AI vision
  async extractTextFromPDFWithAI(filePath) {
    try {
      logger.info(`Attempting AI vision extraction for image-based PDF: ${path.basename(filePath)}`);
      
      const openai = require('openai');
      const client = new openai.OpenAI({
        apiKey: config.openai.apiKey
      });

      // Convert PDF to image (first page only for now)
      const pdfImageBuffer = await this.convertPDFToImage(filePath);
      
      // Use OpenAI's GPT-4 Vision to extract text
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini', // Use GPT-4o-mini for better performance and lower cost
        messages: [
          {
            role: 'system',
            content: 'You are an expert at extracting and transcribing text from images. Extract all visible text from the image, maintaining the original formatting and structure. If there are multiple columns, sections, or different text styles, preserve them in your transcription. Return only the extracted text without any additional commentary.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please extract all the text from this image. Maintain the original formatting, structure, and layout. If there are headers, subheaders, bullet points, or different sections, preserve them in your transcription.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${pdfImageBuffer.toString('base64')}`
                }
              }
            ]
          }
        ],
        max_tokens: 4000,
        temperature: 0.1
      });

      const extractedText = response.choices[0].message.content;
      
      logger.info(`AI vision extraction completed: ${extractedText.length} characters extracted`);
      
      return extractedText;
      
    } catch (error) {
      logger.error(`AI vision extraction failed:`, error);
      throw error;
    }
  }

  // Convert PDF to image for AI processing
  async convertPDFToImage(filePath) {
    try {
      logger.info(`Converting PDF to image for AI processing: ${path.basename(filePath)}`);
      
      const { pdfToPng } = require('pdf-to-png-converter');
      
      // Convert PDF to PNG images (first page only)
      const pngPages = await pdfToPng(filePath, {
        disableFontFace: true,
        useSystemFonts: false,
        viewportScale: 2.0, // Higher resolution for better text extraction
        pagesToProcess: [1], // Only process first page
        strictPagesToProcess: false
      });
      
      if (pngPages.length === 0) {
        throw new Error('No pages could be converted from PDF');
      }
      
      // Get the first page as a buffer
      const imageBuffer = pngPages[0].content;
      
      logger.info(`PDF converted to image successfully: ${imageBuffer.length} bytes`);
      
      return imageBuffer;
      
    } catch (error) {
      logger.error(`PDF to image conversion failed:`, error);
      throw error;
    }
  }

  // Extract text from images using OCR
  async extractTextFromImage(filePath) {
    try {
      logger.info(`Extracting text from image: ${path.basename(filePath)}`);
      
      // Preprocess image for better OCR results
      const processedImageBuffer = await this.preprocessImage(filePath);
      
      const result = await Tesseract.recognize(
        processedImageBuffer,
        'eng',
        {
          logger: m => logger.debug(`OCR: ${m}`)
        }
      );

      const metadata = {
        confidence: result.data.confidence,
        textLength: result.data.text.length,
        wordCount: result.data.text.split(/\s+/).length
      };

      logger.info(`Image OCR completed: ${metadata.confidence}% confidence, ${metadata.wordCount} words`);
      
      return {
        text: result.data.text,
        metadata: metadata
      };
    } catch (error) {
      logger.error(`Failed to extract text from image:`, error);
      throw error;
    }
  }

  // Preprocess image for better OCR results
  async preprocessImage(filePath) {
    try {
      const image = sharp(filePath);
      
      // Get image metadata
      const metadata = await image.metadata();
      
      // Apply preprocessing for better OCR
      const processed = await image
        .grayscale() // Convert to grayscale
        .normalize() // Normalize contrast
        .sharpen() // Sharpen edges
        .png() // Convert to PNG for better quality
        .toBuffer();
      
      logger.info(`Image preprocessed: ${metadata.width}x${metadata.height} -> optimized for OCR`);
      
      return processed;
    } catch (error) {
      logger.warn(`Image preprocessing failed, using original:`, error.message);
      // Return original file if preprocessing fails
      return fs.readFileSync(filePath);
    }
  }

  // Extract text from Word documents
  async extractTextFromDocument(filePath) {
    try {
      logger.info(`Extracting text from document: ${path.basename(filePath)}`);
      
      const result = await mammoth.extractRawText({ path: filePath });
      
      const metadata = {
        textLength: result.value.length,
        wordCount: result.value.split(/\s+/).length,
        messages: result.messages || []
      };

      logger.info(`Document processed: ${metadata.wordCount} words`);
      
      return {
        text: result.value,
        metadata: metadata
      };
    } catch (error) {
      logger.error(`Failed to extract text from document:`, error);
      throw error;
    }
  }

  // Analyze content using OpenAI (similar to transcription handler)
  async analyzeContent(text, fileName) {
    try {
      if (!text || text.trim().length === 0) {
        logger.warn(`No text extracted from ${fileName}`);
        return {
          title: fileName.replace(/\.[^/.]+$/, ''),
          summary: 'No text content found in document.',
          keyPoints: [],
          actionItems: [],
          topics: [],
          sentiment: 'neutral'
        };
      }

      const openai = require('openai');
      const client = new openai.OpenAI({
        apiKey: config.openai.apiKey
      });

      // Truncate text if too long for API
      const maxTokens = 4000;
      const truncatedText = text.length > maxTokens * 4 ? text.substring(0, maxTokens * 4) + '...' : text;

      const prompt = `Analyze the following document content and provide:
1. A concise title (max 100 characters)
2. A comprehensive summary (2-3 paragraphs)
3. Key points (5-10 bullet points)
4. Action items (if any are mentioned)
5. Main topics discussed
6. Overall sentiment (positive, negative, neutral, or mixed)

Document: ${truncatedText}

Please respond in JSON format:
{
  "title": "Document Title",
  "summary": "Comprehensive summary...",
  "keyPoints": ["Point 1", "Point 2", ...],
  "actionItems": ["Action 1", "Action 2", ...],
  "topics": ["Topic 1", "Topic 2", ...],
  "sentiment": "positive/negative/neutral/mixed"
}`;

      const response = await client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that analyzes documents and extracts key information. Always respond in valid JSON format.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      });

      const analysis = JSON.parse(response.choices[0].message.content);
      
      logger.info(`Content analysis completed for ${fileName}`);
      
      return analysis;

    } catch (error) {
      logger.error(`Failed to analyze content for ${fileName}:`, error);
      
      // Fallback analysis
      return {
        title: fileName.replace(/\.[^/.]+$/, ''),
        summary: `Document analysis failed. Extracted text: ${text.substring(0, 500)}...`,
        keyPoints: ['Document processing completed'],
        actionItems: [],
        topics: ['Document'],
        sentiment: 'neutral'
      };
    }
  }

  // Check if file is supported
  isSupportedFile(fileName) {
    const extension = path.extname(fileName).toLowerCase();
    return this.getFileType(extension) !== null;
  }

  // Get supported file types
  getSupportedFileTypes() {
    return this.supportedExtensions;
  }
}

module.exports = DocumentHandler; 