const DropboxHandler = require('./src/dropbox-handler');

async function checkAllFiles() {
  try {
    const handler = new DropboxHandler();
    const files = await handler.listFiles();
    
    const allFiles = files.filter(f => f['.tag'] === 'file');
    console.log(`\n📁 All files currently in Dropbox (${allFiles.length} total):`);
    
    allFiles.forEach((f, index) => {
      const modifiedDate = new Date(f.server_modified);
      const isRecent = modifiedDate > new Date(Date.now() - 24*60*60*1000);
      const recentFlag = isRecent ? '🆕' : '📄';
      
      console.log(`${recentFlag} ${index + 1}. ${f.name}`);
      console.log(`   Modified: ${f.server_modified}`);
      console.log(`   Path: ${f.path_lower}`);
      console.log(`   Size: ${f.size} bytes`);
      console.log('');
    });
    
    // Check the recent processing cache
    console.log('🔍 Checking what the system thinks is "recently processed":');
    console.log(`Recent processing cache size: ${handler.recentlyProcessedFiles.size}`);
    
    if (handler.recentlyProcessedFiles.size > 0) {
      console.log('Files in recent processing cache:');
      for (const [filePath, timestamp] of handler.recentlyProcessedFiles.entries()) {
        const age = Math.round((Date.now() - timestamp) / 1000 / 60);
        console.log(`- ${filePath} (cached ${age} minutes ago)`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkAllFiles(); 