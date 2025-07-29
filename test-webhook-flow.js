const config = require('./config/config');
const { logger } = require('./src/utils');
const GoogleDriveHandler = require('./src/google-drive-handler');
const TranscriptionHandler = require('./src/transcription');
const NotionHandler = require('./src/notion-handler');

async function testWebhookFlow() {
  try {
    console.log('🧪 Testing webhook flow...');
    
    // Step 1: Test Google Drive handler
    console.log('\n1️⃣ Testing Google Drive handler...');
    const googleDriveHandler = new GoogleDriveHandler();
    
    if (!googleDriveHandler.isConfigured()) {
      console.error('❌ Google Drive handler not configured');
      return;
    }
    
    console.log('✅ Google Drive handler configured');
    
    // Step 2: Test listing files
    console.log('\n2️⃣ Testing file listing...');
    const audioFiles = await googleDriveHandler.listAudioFiles();
    console.log(`✅ Found ${audioFiles.length} audio files`);
    
    if (audioFiles.length === 0) {
      console.log('⚠️ No audio files found in Google Drive folder');
      console.log('Please upload some audio files to your Google Drive folder');
      return;
    }
    
    // Step 3: Test downloading a file
    console.log('\n3️⃣ Testing file download...');
    const testFile = audioFiles[0];
    console.log(`Testing with file: ${testFile.name}`);
    
    const localPath = await googleDriveHandler.downloadFile(testFile.id, testFile.name);
    console.log(`✅ File downloaded to: ${localPath}`);
    
    // Step 4: Test transcription
    console.log('\n4️⃣ Testing transcription...');
    const transcriptionHandler = new TranscriptionHandler();
    
    const processedAudioData = await transcriptionHandler.processAudioFile(localPath, testFile.name);
    console.log('✅ Transcription completed');
    console.log(`Title: ${processedAudioData.generatedTitle}`);
    console.log(`Summary: ${processedAudioData.summary.substring(0, 100)}...`);
    console.log(`Key Points: ${processedAudioData.keyPoints.length} points`);
    
    // Step 5: Test Notion page creation
    console.log('\n5️⃣ Testing Notion page creation...');
    const notionHandler = new NotionHandler();
    
    const completeAudioData = {
      ...testFile,
      ...processedAudioData,
      localPath: localPath
    };
    
    const pageId = await notionHandler.createPage(completeAudioData);
    console.log(`✅ Notion page created: ${pageId}`);
    
    console.log('\n🎉 Webhook flow test completed successfully!');
    console.log('Your automation is working correctly.');
    
  } catch (error) {
    console.error('❌ Webhook flow test failed:', error.message);
    console.error('Error details:', error);
  }
}

// Run the test
if (require.main === module) {
  testWebhookFlow()
    .then(() => {
      console.log('\n✅ Test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testWebhookFlow };