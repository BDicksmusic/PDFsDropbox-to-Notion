const axios = require('axios');
const config = require('./config/config');

async function testPDFDatabaseSchema() {
  try {
    console.log('🔍 Testing PDF Database Schema...');
    
    const headers = {
      'Authorization': `Bearer ${config.notion.apiKey}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    };

    const response = await axios({
      method: 'GET',
      url: `https://api.notion.com/v1/databases/${config.notion.pdfDatabaseId}`,
      headers: headers
    });

    console.log('✅ Database found!');
    console.log('📋 Database Title:', response.data.title[0]?.plain_text || 'No title');
    console.log('🆔 Database ID:', response.data.id);
    
    console.log('\n📊 Available Properties:');
    const properties = response.data.properties;
    
    Object.keys(properties).forEach(propName => {
      const prop = properties[propName];
      console.log(`  • ${propName} (${prop.type})`);
      
      // Show additional details for certain property types
      if (prop.type === 'select' && prop.select?.options) {
        console.log(`    Options: ${prop.select.options.map(opt => opt.name).join(', ')}`);
      }
      if (prop.type === 'multi_select' && prop.multi_select?.options) {
        console.log(`    Options: ${prop.multi_select.options.map(opt => opt.name).join(', ')}`);
      }
      if (prop.type === 'relation') {
        console.log(`    Related Database: ${prop.relation?.database_id || 'Unknown'}`);
      }
    });

    console.log('\n🎯 Recommended Property Mappings:');
    console.log('  • Name → Link Tags (relation)');
    console.log('  • Main Entry → rich_text (summary)');
    console.log('  • URL → url (Dropbox link)');
    console.log('  • Files → files (uploaded document)');
    console.log('  • Status → select (processing status)');

  } catch (error) {
    console.error('❌ Error testing database schema:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      console.error('💡 Database not found. Check your NOTION_PDF_DATABASE_ID');
    } else if (error.response?.status === 401) {
      console.error('💡 Authentication failed. Check your NOTION_API_KEY');
    }
  }
}

// Run the test
testPDFDatabaseSchema();