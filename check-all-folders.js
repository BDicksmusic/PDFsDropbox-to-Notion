const DropboxHandler = require('./src/dropbox-handler');

async function checkAllFolders() {
  try {
    const handler = new DropboxHandler();
    
    console.log('🔍 Checking root /Apps folder structure...\n');
    
    // Check the root Apps folder
    const appsResponse = await handler.makeAuthenticatedRequest({
      method: 'POST',
      url: 'https://api.dropboxapi.com/2/files/list_folder',
      headers: {
        'Content-Type': 'application/json'
      },
      data: {
        path: '/Apps',
        recursive: true,
        include_media_info: false,
        include_deleted: false,
        include_has_explicit_shared_members: false,
        include_mounted_folders: true,
        include_non_downloadable_files: false
      }
    });
    
    const allEntries = appsResponse.data.entries;
    const files = allEntries.filter(entry => entry['.tag'] === 'file');
    const folders = allEntries.filter(entry => entry['.tag'] === 'folder');
    
    console.log(`📁 Folders found in /Apps:`);
    folders.forEach(folder => {
      console.log(`  📂 ${folder.path_display}`);
    });
    
    console.log(`\n📄 Files found in /Apps (${files.length} total):`);
    files.forEach((file, index) => {
      const modifiedDate = new Date(file.server_modified);
      const isRecent = modifiedDate > new Date(Date.now() - 24*60*60*1000);
      const recentFlag = isRecent ? '🆕' : '📄';
      
      console.log(`${recentFlag} ${index + 1}. ${file.name}`);
      console.log(`   Path: ${file.path_display}`);
      console.log(`   Modified: ${file.server_modified}`);
      console.log(`   Size: ${file.size} bytes`);
      console.log('');
    });
    
    // Check specifically configured folders
    console.log('🎯 Checking specifically configured folders:');
    console.log(`Audio folder: /Apps/Easy Voice Recorder`);
    console.log(`PDF folder: /Apps/PDFs`);
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response?.data) {
      console.error('Dropbox API Error:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

checkAllFolders(); 