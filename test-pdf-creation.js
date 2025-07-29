const NotionPDFHandler = require('./src/notion-pdf-handler');

async function testPDFPageCreation() {
  try {
    console.log('🧪 Testing PDF Page Creation...');
    
    const notionPDFHandler = new NotionPDFHandler();
    
    // Test data
    const testDocumentData = {
      fileName: 'test-document.pdf',
      generatedTitle: 'Test Document',
      summary: 'This is a test summary extracted from the document.',
      keyPoints: ['Point 1', 'Point 2', 'Point 3'],
      actionItems: ['Action 1', 'Action 2'],
      topics: ['Topic 1', 'Topic 2'],
      sentiment: 'neutral',
      metadata: {
        fileType: 'pdf',
        wordCount: 150,
        characterCount: 750,
        processingCost: 0.05
      },
      shareableUrl: 'https://www.dropbox.com/s/test123/test-document.pdf?dl=0',
      text: 'This is the full extracted text from the document...'
    };

    console.log('📝 Creating test page in PDF database...');
    
    const page = await notionPDFHandler.createPage(testDocumentData, 'Test Document');
    
    console.log('✅ Successfully created test page!');
    console.log('🆔 Page ID:', page.id);
    console.log('🔗 Page URL:', page.url);
    
    console.log('\n📊 Page Properties:');
    if (page.properties) {
      Object.keys(page.properties).forEach(propName => {
        const prop = page.properties[propName];
        console.log(`  • ${propName}: ${prop.type}`);
      });
    }

  } catch (error) {
    console.error('❌ Error creating test page:', error.response?.data || error.message);
    
    if (error.response?.status === 400) {
      console.error('💡 Bad request. Check if the database properties match what we expect.');
    } else if (error.response?.status === 401) {
      console.error('💡 Authentication failed. Check your NOTION_API_KEY');
    } else if (error.response?.status === 404) {
      console.error('💡 Database not found. Check your NOTION_PDF_DATABASE_ID');
    }
  }
}

// Run the test
testPDFPageCreation();