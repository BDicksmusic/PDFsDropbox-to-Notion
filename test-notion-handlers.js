#!/usr/bin/env node

/**
 * Test Notion Handlers
 * 
 * This script tests the Notion API connection and database access
 * for both audio and PDF handlers.
 */

const NotionHandler = require('./src/notion-handler');
const NotionPDFHandler = require('./src/notion-pdf-handler');
const config = require('./config/config');

async function testNotionHandlers() {
  console.log('🧪 Testing Notion Handlers');
  console.log('==========================\n');

  try {
    // Test 1: Check configuration
    console.log('1. Checking configuration...');
    console.log(`   Notion API Key: ${config.notion.apiKey ? '✅ Set' : '❌ Missing'}`);
    console.log(`   Audio Database ID: ${config.notion.databaseId ? '✅ Set' : '❌ Missing'}`);
    console.log(`   PDF Database ID: ${config.notion.pdfDatabaseId ? '✅ Set' : '❌ Missing'}`);
    
    if (!config.notion.apiKey) {
      console.error('❌ Notion API Key is required!');
      return;
    }

    // Test 2: Test Audio Notion Handler
    console.log('\n2. Testing Audio Notion Handler...');
    const audioHandler = new NotionHandler();
    
    try {
      const audioSchema = await audioHandler.getDatabaseSchema();
      console.log('✅ Audio database schema retrieved successfully');
      console.log('   Properties found:', Object.keys(audioSchema).length);
      
      // Show available properties
      console.log('   Available properties:');
      Object.entries(audioSchema).forEach(([name, prop]) => {
        console.log(`     - ${name} (${prop.type})`);
      });
      
    } catch (error) {
      console.error('❌ Audio Notion Handler failed:', error.message);
    }

    // Test 3: Test PDF Notion Handler
    console.log('\n3. Testing PDF Notion Handler...');
    const pdfHandler = new NotionPDFHandler();
    
    try {
      const pdfSchema = await pdfHandler.getDatabaseSchema();
      console.log('✅ PDF database schema retrieved successfully');
      console.log('   Properties found:', Object.keys(pdfSchema).length);
      
      // Show available properties
      console.log('   Available properties:');
      Object.entries(pdfSchema).forEach(([name, prop]) => {
        console.log(`     - ${name} (${prop.type})`);
      });
      
    } catch (error) {
      console.error('❌ PDF Notion Handler failed:', error.message);
    }

    // Test 4: Test page creation (dry run)
    console.log('\n4. Testing page creation (dry run)...');
    
    const testAudioData = {
      fileName: 'test-audio.mp3',
      summary: 'This is a test summary',
      keyPoints: ['Point 1', 'Point 2', 'Point 3'],
      actionItems: ['Action 1', 'Action 2'],
      topics: ['Topic 1', 'Topic 2'],
      sentiment: 'positive',
      title: 'Test Audio Recording',
      transcript: 'This is a test transcript.',
      shareableUrl: 'https://example.com/test.mp3',
      duration: 120
    };

    try {
      const audioPageData = await audioHandler.buildPageData(testAudioData);
      console.log('✅ Audio page data built successfully');
      console.log('   Title:', audioPageData.properties.Name?.title?.[0]?.text?.content || 'N/A');
      console.log('   URL:', audioPageData.properties.URL?.url || 'N/A');
      console.log('   Status:', audioPageData.properties.Status?.select?.name || 'N/A');
      
    } catch (error) {
      console.error('❌ Audio page data building failed:', error.message);
    }

    const testPdfData = {
      fileName: 'test-document.pdf',
      summary: 'This is a test document summary',
      keyPoints: ['Document Point 1', 'Document Point 2'],
      actionItems: ['Document Action 1'],
      topics: ['Document Topic 1'],
      extractedText: 'This is extracted text from the document.',
      shareableUrl: 'https://example.com/test.pdf',
      pageCount: 5
    };

    try {
      const pdfPageData = await pdfHandler.buildPageData(testPdfData);
      console.log('✅ PDF page data built successfully');
      console.log('   Title:', pdfPageData.properties.Name?.title?.[0]?.text?.content || 'N/A');
      console.log('   URL:', pdfPageData.properties.URL?.url || 'N/A');
      console.log('   Status:', pdfPageData.properties.Status?.select?.name || 'N/A');
      
    } catch (error) {
      console.error('❌ PDF page data building failed:', error.message);
    }

    console.log('\n🎉 Notion Handlers test completed!');
    console.log('\n📋 Next steps:');
    console.log('   1. If all tests pass, your Notion integration is ready');
    console.log('   2. If any tests fail, check your Notion API key and database IDs');
    console.log('   3. Make sure your databases have the required properties');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testNotionHandlers();
}

module.exports = { testNotionHandlers };