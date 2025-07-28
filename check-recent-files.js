const DropboxHandler = require('./src/dropbox-handler');

async function checkRecentFiles() {
  try {
    const handler = new DropboxHandler();
    const files = await handler.listFiles();
    
    const recent = files.filter(f => 
      f['.tag'] === 'file' && 
      new Date(f.server_modified) > new Date(Date.now() - 24*60*60*1000)
    );
    
    console.log(`Recent files (last 24h): ${recent.length}`);
    recent.forEach(f => {
      console.log(`- ${f.name} (${f.server_modified}) - Path: ${f.path_lower}`);
    });
    
    if (recent.length === 0) {
      console.log('No recent files found. Checking all files...');
      const allFiles = files.filter(f => f['.tag'] === 'file');
      console.log(`Total files: ${allFiles.length}`);
      allFiles.slice(0, 5).forEach(f => {
        console.log(`- ${f.name} (${f.server_modified}) - Path: ${f.path_lower}`);
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkRecentFiles(); 