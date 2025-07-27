# Railway Integration Guide: Same Project, Multiple Services

This guide shows how to add the Dropbox to Notion automation as a service within your existing Railway project.

## Railway Structure Overview

```
Your Workspace
└── Your Project (with your website)
    └── Environment
        ├── Service 1: Your Website (existing)
        └── Service 2: Dropbox Automation (new)
```

## Step 1: Add New Service to Existing Project

### Option A: Via Railway Dashboard
1. Go to your existing Railway project
2. Click "New Service" → "GitHub Repo"
3. Connect this automation repository
4. Railway will create a new service automatically

### Option B: Via Railway CLI
```bash
# Navigate to your automation code
cd automation-connections

# Link to your existing Railway project
railway link

# Create new service
railway service create automation

# Switch to the new service
railway service use automation
```

## Step 2: Configure Environment Variables

### For the New Automation Service:
```bash
# Required API Keys
DROPBOX_ACCESS_TOKEN=your_dropbox_token
DROPBOX_WEBHOOK_SECRET=your_webhook_secret
NOTION_API_KEY=your_notion_key
NOTION_DATABASE_ID=your_database_id
OPENAI_API_KEY=your_openai_key

# Service Configuration
PORT=3001
BACKGROUND_MODE=true
RAILWAY_URL=https://automation.yourdomain.com

# Processing Settings
MAX_FILE_SIZE_MB=50
SUPPORTED_AUDIO_FORMATS=mp3,wav,m4a,flac
TEMPORARY_FOLDER=./temp
LOG_LEVEL=info
```

### Set Variables via Dashboard:
1. Go to your automation service in Railway
2. Click "Variables" tab
3. Add each variable above

### Set Variables via CLI:
```bash
railway variables set DROPBOX_ACCESS_TOKEN=your_token
railway variables set NOTION_API_KEY=your_key
railway variables set OPENAI_API_KEY=your_key
railway variables set PORT=3001
railway variables set BACKGROUND_MODE=true
# ... add all other variables
```

## Step 3: Domain Configuration

### Main Domain Setup:
- **Primary domain**: `yourdomain.com` → Your website service
- **Subdomain**: `automation.yourdomain.com` → Automation service

### Railway Domain Configuration:
1. **For your website service**:
   - Go to your website service
   - Click "Settings" → "Domains"
   - Add `yourdomain.com`

2. **For automation service**:
   - Go to your automation service
   - Click "Settings" → "Domains"
   - Add `automation.yourdomain.com`

### DNS Configuration:
```
Type    Name                    Value
A       yourdomain.com          Railway IP
CNAME   automation              yourdomain.com
```

## Step 4: Service Configuration

### Port Configuration:
- **Website service**: Port 3000 (default)
- **Automation service**: Port 3001

### Railway Configuration:
```json
// railway.json (for automation service)
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

## Step 5: Webhook Configuration

### Dropbox Webhook URL:
```
https://automation.yourdomain.com/webhook
```

### Webhook Setup:
1. Go to Dropbox App Console
2. Set webhook URL to your subdomain
3. Verify webhook is working

## Step 6: Testing & Verification

### Test Health Endpoints:
```bash
# Test website
curl https://yourdomain.com/health

# Test automation
curl https://automation.yourdomain.com/health
```

### Test Webhook:
1. Upload a test audio file to Dropbox
2. Check Railway logs for automation service
3. Verify Notion database is updated

## Benefits of This Approach

### ✅ **Cost Effective**:
- No additional Railway project costs
- Shared infrastructure
- Single billing

### ✅ **Management**:
- Unified dashboard
- Centralized logging
- Easy monitoring

### ✅ **Domain Management**:
- Professional subdomain structure
- SSL certificates handled automatically
- Clean URL structure

### ✅ **Team Access**:
- Same team can manage both services
- Shared environment variables (if needed)
- Unified permissions

## Monitoring & Maintenance

### Service Health:
- **Website**: `https://yourdomain.com/health`
- **Automation**: `https://automation.yourdomain.com/health`

### Logs:
- View logs per service in Railway dashboard
- Centralized log aggregation
- Easy debugging

### Scaling:
- Railway automatically scales both services
- Independent scaling based on demand
- Resource sharing when needed

## Troubleshooting

### Common Issues:

1. **Port Conflicts**:
   - Ensure different ports for each service
   - Check Railway service configuration

2. **Domain Issues**:
   - Verify DNS configuration
   - Check Railway domain settings
   - Ensure SSL certificates are valid

3. **Environment Variables**:
   - Verify variables are set for correct service
   - Check variable names match code
   - Ensure no typos in values

4. **Webhook Issues**:
   - Verify webhook URL is correct
   - Check Dropbox webhook configuration
   - Monitor automation service logs

### Debug Commands:
```bash
# Check service status
railway status

# View service logs
railway logs

# Check environment variables
railway variables

# Test webhook endpoint
curl -X POST https://automation.yourdomain.com/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

## Best Practices

1. **Service Naming**: Use descriptive service names
2. **Environment Variables**: Keep sensitive data in Railway variables
3. **Monitoring**: Set up alerts for service health
4. **Backups**: Regular backups of configuration
5. **Documentation**: Keep service documentation updated 