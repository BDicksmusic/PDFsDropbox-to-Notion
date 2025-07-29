const axios = require('axios');
const config = require('./config/config');

async function findNotionDatabases() {
  try {
    console.log('🔍 Finding Notion Databases...');
    
    const headers = {
      'Authorization': `Bearer ${config.notion.apiKey}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    };

    // Search for databases
    const response = await axios({
      method: 'POST',
      url: 'https://api.notion.com/v1/search',
      headers: headers,
      data: {
        filter: {
          property: 'object',
          value: 'database'
        }
      }
    });

    console.log('✅ Found Databases:');
    response.data.results.forEach((db, index) => {
      const title = db.title[0]?.plain_text || 'Untitled';
      console.log(`\n${index + 1}. ${title}`);
      console.log(`   ID: ${db.id}`);
      console.log(`   URL: ${db.url}`);
      
      // Show properties if available
      if (db.properties) {
        console.log('   Properties:');
        Object.keys(db.properties).forEach(propName => {
          const prop = db.properties[propName];
          console.log(`     • ${propName} (${prop.type})`);
        });
      }
    });

    console.log('\n📝 To use a database, copy its ID and set it in your .env file:');
    console.log('   NOTION_DATABASE_ID=<audio-database-id>');
    console.log('   NOTION_PDF_DATABASE_ID=<pdf-database-id>');

  } catch (error) {
    console.error('❌ Error finding databases:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.error('💡 Authentication failed. Check your NOTION_API_KEY');
    }
  }
}

// Run the search
findNotionDatabases();