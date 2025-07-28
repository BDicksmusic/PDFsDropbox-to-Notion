const config = require('../config/config');
const DropboxHandler = require('../src/dropbox-handler');

async function setupDropboxFolders() {
  try {
    console.log('🔧 Setting up Dropbox folders...\n');
    
    const dropboxHandler = new DropboxHandler();
    
    console.log('📁 Required folder paths:');
    console.log(`   Audio: ${dropboxHandler.audioFolderPath}`);
    console.log(`   PDF: ${dropboxHandler.pdfFolderPath}`);
    console.log('');
    
    // Test Dropbox connection
    console.log('🔗 Testing Dropbox connection...');
    const allEntries = await dropboxHandler.listFiles();
    console.log(`✅ Connected! Found ${allEntries.length} total entries`);
    
    // Check existing folders
    const folders = allEntries.filter(entry => entry['.tag'] === 'folder');
    console.log(`📂 Found ${folders.length} existing folders`);
    
    // Check if our required folders exist
    const audioFolderExists = folders.some(folder => 
      folder.path_lower === dropboxHandler.audioFolderPath.toLowerCase()
    );
    const pdfFolderExists = folders.some(folder => 
      folder.path_lower === dropboxHandler.pdfFolderPath.toLowerCase()
    );
    
    console.log('\n📋 Folder status:');
    console.log(`   Audio folder: ${audioFolderExists ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`   PDF folder: ${pdfFolderExists ? '✅ EXISTS' : '❌ MISSING'}`);
    
    if (!audioFolderExists || !pdfFolderExists) {
      console.log('\n⚠️  Action required:');
      console.log('   Please create these folders in your Dropbox:');
      if (!audioFolderExists) {
        console.log(`   1. Create folder: ${dropboxHandler.audioFolderPath}`);
      }
      if (!pdfFolderExists) {
        console.log(`   2. Create folder: ${dropboxHandler.pdfFolderPath}`);
      }
      console.log('\n   Steps:');
      console.log('   1. Open Dropbox in your browser');
      console.log('   2. Navigate to the Apps folder');
      console.log('   3. Create the missing folders');
      console.log('   4. Upload some test files');
    } else {
      console.log('\n✅ All required folders exist!');
      
      // Check for files in the folders
      const audioFiles = allEntries.filter(entry => 
        entry['.tag'] === 'file' && 
        entry.path_lower.startsWith(dropboxHandler.audioFolderPath.toLowerCase())
      );
      const pdfFiles = allEntries.filter(entry => 
        entry['.tag'] === 'file' && 
        entry.path_lower.startsWith(dropboxHandler.pdfFolderPath.toLowerCase())
      );
      
      console.log('\n📄 Files in folders:');
      console.log(`   Audio files: ${audioFiles.length}`);
      console.log(`   PDF files: ${pdfFiles.length}`);
      
      if (audioFiles.length === 0 && pdfFiles.length === 0) {
        console.log('\n💡 Tip: Upload some test files to trigger processing!');
        console.log('   - Audio files (mp3, wav, m4a) to the audio folder');
        console.log('   - PDF/image files to the PDF folder');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Check your Dropbox access token');
    console.log('   2. Verify the app has proper permissions');
    console.log('   3. Ensure the folders exist in Dropbox');
  }
}

setupDropboxFolders(); 