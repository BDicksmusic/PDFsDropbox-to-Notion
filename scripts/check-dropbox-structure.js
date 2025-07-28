const config = require('../config/config');
const DropboxHandler = require('../src/dropbox-handler');

async function checkDropboxStructure() {
  try {
    console.log('🔍 Checking Dropbox structure...\n');
    
    const dropboxHandler = new DropboxHandler();
    
    console.log('📁 Expected folder paths:');
    console.log(`   Audio: ${dropboxHandler.audioFolderPath}`);
    console.log(`   PDF: ${dropboxHandler.pdfFolderPath}`);
    console.log('');
    
    // Get all files and folders
    const allEntries = await dropboxHandler.listFiles();
    
    // Separate files and folders
    const files = allEntries.filter(entry => entry['.tag'] === 'file');
    const folders = allEntries.filter(entry => entry['.tag'] === 'folder');
    
    console.log(`📊 Total entries: ${allEntries.length}`);
    console.log(`📁 Folders: ${folders.length}`);
    console.log(`📄 Files: ${files.length}`);
    console.log('');
    
    // Show all folders
    console.log('📂 All folders in Dropbox:');
    folders.forEach((folder, index) => {
      console.log(`   ${index + 1}. ${folder.path_lower}`);
    });
    
    console.log('');
    
    // Check if our expected folders exist
    const audioFolderExists = folders.some(folder => 
      folder.path_lower === dropboxHandler.audioFolderPath.toLowerCase()
    );
    const pdfFolderExists = folders.some(folder => 
      folder.path_lower === dropboxHandler.pdfFolderPath.toLowerCase()
    );
    
    console.log('✅ Folder existence check:');
    console.log(`   Audio folder (${dropboxHandler.audioFolderPath}): ${audioFolderExists ? 'EXISTS' : 'MISSING'}`);
    console.log(`   PDF folder (${dropboxHandler.pdfFolderPath}): ${pdfFolderExists ? 'EXISTS' : 'MISSING'}`);
    
    if (!audioFolderExists || !pdfFolderExists) {
      console.log('\n⚠️  Missing folders detected!');
      console.log('   You need to create these folders in your Dropbox:');
      if (!audioFolderExists) {
        console.log(`   - ${dropboxHandler.audioFolderPath}`);
      }
      if (!pdfFolderExists) {
        console.log(`   - ${dropboxHandler.pdfFolderPath}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkDropboxStructure(); 