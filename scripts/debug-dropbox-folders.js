const config = require('../config/config');
const DropboxHandler = require('../src/dropbox-handler');
const { logger } = require('../src/utils');

async function debugDropboxFolders() {
  try {
    console.log('🔍 Debugging Dropbox folders...\n');
    
    const dropboxHandler = new DropboxHandler();
    
    console.log('📁 Configured folder paths:');
    console.log(`   Audio folder: ${dropboxHandler.audioFolderPath}`);
    console.log(`   PDF folder: ${dropboxHandler.pdfFolderPath}`);
    console.log('');
    
    // List all files in Dropbox
    console.log('📋 Listing all files in Dropbox...');
    const allFiles = await dropboxHandler.listFiles();
    console.log(`   Total files found: ${allFiles.length}`);
    
    // Show first 10 files for debugging
    console.log('\n📄 First 10 files in Dropbox:');
    allFiles.slice(0, 10).forEach((file, index) => {
      console.log(`   ${index + 1}. ${file.path_lower} (${file['.tag']})`);
    });
    
    // Check for audio folder files
    console.log('\n🎵 Checking audio folder files...');
    const audioFiles = allFiles.filter(entry => 
      entry['.tag'] === 'file' && 
      entry.path_lower.startsWith(dropboxHandler.audioFolderPath.toLowerCase())
    );
    console.log(`   Audio files found: ${audioFiles.length}`);
    audioFiles.forEach((file, index) => {
      console.log(`   ${index + 1}. ${file.path_lower}`);
    });
    
    // Check for PDF folder files
    console.log('\n📄 Checking PDF folder files...');
    const pdfFiles = allFiles.filter(entry => 
      entry['.tag'] === 'file' && 
      entry.path_lower.startsWith(dropboxHandler.pdfFolderPath.toLowerCase())
    );
    console.log(`   PDF files found: ${pdfFiles.length}`);
    pdfFiles.forEach((file, index) => {
      console.log(`   ${index + 1}. ${file.path_lower}`);
    });
    
    // Check if folders exist
    console.log('\n📂 Checking if folders exist...');
    const folders = allFiles.filter(entry => entry['.tag'] === 'folder');
    const audioFolderExists = folders.some(folder => 
      folder.path_lower === dropboxHandler.audioFolderPath.toLowerCase()
    );
    const pdfFolderExists = folders.some(folder => 
      folder.path_lower === dropboxHandler.pdfFolderPath.toLowerCase()
    );
    
    console.log(`   Audio folder exists: ${audioFolderExists ? '✅' : '❌'}`);
    console.log(`   PDF folder exists: ${pdfFolderExists ? '✅' : '❌'}`);
    
    // Show all folders for reference
    console.log('\n📁 All folders in Dropbox:');
    folders.forEach((folder, index) => {
      console.log(`   ${index + 1}. ${folder.path_lower}`);
    });
    
    console.log('\n🎯 Summary:');
    console.log(`   - Audio folder path: ${dropboxHandler.audioFolderPath}`);
    console.log(`   - Audio folder exists: ${audioFolderExists}`);
    console.log(`   - Audio files found: ${audioFiles.length}`);
    console.log(`   - PDF folder path: ${dropboxHandler.pdfFolderPath}`);
    console.log(`   - PDF folder exists: ${pdfFolderExists}`);
    console.log(`   - PDF files found: ${pdfFiles.length}`);
    
  } catch (error) {
    console.error('❌ Error debugging Dropbox folders:', error.message);
  }
}

// Run the debug script
if (require.main === module) {
  debugDropboxFolders();
}

module.exports = { debugDropboxFolders }; 