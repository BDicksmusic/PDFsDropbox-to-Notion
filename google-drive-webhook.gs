// Google Apps Script for Automation Connections Webhook
// This script monitors a Google Drive folder and sends webhook notifications

// Configuration - Update these values
const WEBHOOK_URL = 'https://your-railway-app.railway.app/webhook/google-drive'; // Replace with your Railway URL
const FOLDER_ID = '1Wb4U-PM1BgeYtzp6I_bFwVMoS9O88Irm'; // Your audio folder ID
const WEBHOOK_SECRET = '0a31de66ee1081f2f298ff68694547738cc8cf0bd37c4dac07937f79f3b34366'; // Your webhook secret

// Store the last check time in PropertiesService
const PROPERTIES_KEY = 'lastCheckTime';

function setupTrigger() {
  // Delete existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'checkForNewFiles') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Create a new trigger that runs every 1 minute
  ScriptApp.newTrigger('checkForNewFiles')
    .timeBased()
    .everyMinutes(1)
    .create();
    
  console.log('Webhook trigger created successfully');
}

function checkForNewFiles() {
  try {
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const files = folder.getFiles();
    const lastCheckTime = getLastCheckTime();
    const currentTime = new Date();
    
    let hasNewFiles = false;
    
    while (files.hasNext()) {
      const file = files.next();
      const modifiedTime = file.getLastUpdated();
      
      // Check if file was modified since last check
      if (modifiedTime > lastCheckTime) {
        hasNewFiles = true;
        console.log(`New/modified file detected: ${file.getName()}`);
      }
    }
    
    // If new files were found, send webhook
    if (hasNewFiles) {
      sendWebhookNotification();
    }
    
    // Update last check time
    setLastCheckTime(currentTime);
    
  } catch (error) {
    console.error('Error checking for new files:', error);
  }
}

function sendWebhookNotification() {
  try {
    const payload = {
      resourceId: FOLDER_ID,
      resourceUri: `https://www.googleapis.com/drive/v3/files?q='${FOLDER_ID}'+in+parents`,
      state: 'sync',
      timestamp: new Date().toISOString()
    };
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': WEBHOOK_SECRET
      },
      payload: JSON.stringify(payload)
    };
    
    const response = UrlFetchApp.fetch(WEBHOOK_URL, options);
    
    if (response.getResponseCode() === 200) {
      console.log('Webhook notification sent successfully');
    } else {
      console.error('Failed to send webhook notification:', response.getContentText());
    }
    
  } catch (error) {
    console.error('Error sending webhook notification:', error);
  }
}

function getLastCheckTime() {
  const properties = PropertiesService.getScriptProperties();
  const lastCheck = properties.getProperty(PROPERTIES_KEY);
  return lastCheck ? new Date(lastCheck) : new Date(Date.now() - 5 * 60 * 1000); // Default to 5 minutes ago
}

function setLastCheckTime(time) {
  const properties = PropertiesService.getScriptProperties();
  properties.setProperty(PROPERTIES_KEY, time.toISOString());
}

function testWebhook() {
  console.log('Testing webhook notification...');
  sendWebhookNotification();
}

function manualCheck() {
  console.log('Running manual check for new files...');
  checkForNewFiles();
}

// Run this function once to set up the trigger
function initialize() {
  setupTrigger();
  console.log('Google Drive webhook initialized successfully');
}