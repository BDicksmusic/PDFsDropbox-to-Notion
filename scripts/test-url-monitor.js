const axios = require('axios');

async function testUrlMonitoring() {
  const baseUrl = 'http://localhost:3000';
  
  try {
    console.log('Testing URL monitoring...\n');
    
    // Test 1: Add bulletin URL to monitoring
    console.log('1. Adding bulletin URL to monitoring...');
    const addResponse = await axios.post(`${baseUrl}/monitor/bulletin`);
    console.log('✅ Bulletin URL added:', addResponse.data);
    
    // Test 2: Check monitoring status
    console.log('\n2. Checking monitoring status...');
    const statusResponse = await axios.get(`${baseUrl}/monitor/status`);
    console.log('✅ Monitoring status:', statusResponse.data);
    
    // Test 3: Manual check of the URL
    console.log('\n3. Performing manual URL check...');
    const checkResponse = await axios.post(`${baseUrl}/monitor/check`, {
      url: 'https://tricityministries.org/bskpdf/bulletin/'
    });
    console.log('✅ Manual check result:', checkResponse.data);
    
    console.log('\n🎉 URL monitoring test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing URL monitoring:', error.response?.data || error.message);
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testUrlMonitoring();
}

module.exports = { testUrlMonitoring }; 