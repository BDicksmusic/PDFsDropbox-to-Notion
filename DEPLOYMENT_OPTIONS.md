# Deployment Options for Existing Railway Environment

This guide explains how to deploy the Dropbox to Notion automation alongside your existing Railway website.

## Option 1: Separate Railway Project (Recommended)

### Pros:
- Clean separation of concerns
- Independent scaling and monitoring
- No interference with your website
- Easier debugging and maintenance

### Steps:
1. **Create new Railway project**
2. **Connect new GitHub repo** with this automation code
3. **Set up separate API keys** (or reuse compatible ones)
4. **Deploy independently**

### API Key Sharing:
- **Dropbox**: Can reuse same access token
- **Notion**: Can reuse same integration (different database)
- **OpenAI**: Can reuse same API key

## Option 2: Same Railway Project, Different Service

### Pros:
- Easier management
- Shared billing
- Same team access
- Centralized monitoring

### Steps:
1. **Add new service** to existing Railway project
2. **Use different port** (e.g., 3001 instead of 3000)
3. **Set environment variables** for the new service
4. **Configure webhook URL** to point to new service

### Configuration:
```bash
# In your existing Railway project, add a new service
# Set these environment variables for the new service:
PORT=3001
BACKGROUND_MODE=true
# ... other API keys
```

## Option 3: Background Service Mode

### What it does:
- Runs with minimal routes (`/health` and `/webhook` only)
- Optimized for background processing
- Reduced resource usage
- Focused on webhook handling

### Enable Background Mode:
```bash
BACKGROUND_MODE=true
```

### Available Routes in Background Mode:
- `GET /health` - Health check
- `POST /webhook` - Dropbox webhook endpoint

## Option 4: Shared Environment Variables

### Compatible API Keys:

#### Dropbox API
```bash
# Can be shared across multiple applications
DROPBOX_ACCESS_TOKEN=your_existing_token
DROPBOX_WEBHOOK_SECRET=your_webhook_secret
```

#### Notion API
```bash
# Same integration can access multiple databases
NOTION_API_KEY=your_existing_integration_key
NOTION_DATABASE_ID=new_database_for_automation
```

#### OpenAI API
```bash
# Same API key works for all projects
OPENAI_API_KEY=your_existing_openai_key
```

## Recommended Approach for Your Situation

### Step 1: Check Your Existing API Keys
1. **Dropbox**: Check if you already have an access token
2. **Notion**: Check if you have an existing integration
3. **OpenAI**: Check if you already have an API key

### Step 2: Choose Deployment Method
- **If you want clean separation**: Use Option 1 (separate project)
- **If you want easier management**: Use Option 2 (same project, different service)
- **If you want minimal setup**: Use Option 3 (background mode)

### Step 3: Configure Webhook
Regardless of deployment method, you'll need to:
1. **Set up Dropbox webhook** to point to your new service URL
2. **Test the webhook** with a sample file
3. **Monitor the logs** for any issues

## Quick Setup Commands

### For Separate Project:
```bash
# Create new Railway project
railway login
railway init
railway link

# Set environment variables
railway variables set DROPBOX_ACCESS_TOKEN=your_token
railway variables set NOTION_API_KEY=your_key
railway variables set OPENAI_API_KEY=your_key
railway variables set BACKGROUND_MODE=true

# Deploy
railway up
```

### For Same Project (New Service):
```bash
# Add to existing Railway project
railway service create automation
railway service use automation

# Set environment variables
railway variables set PORT=3001
railway variables set BACKGROUND_MODE=true
# ... other variables

# Deploy
railway up
```

## Cost Considerations

### Railway Costs:
- **Separate project**: Additional $5-20/month
- **Same project**: No additional cost (shared resources)

### API Costs:
- **Dropbox**: Free tier usually sufficient
- **Notion**: Free tier usually sufficient
- **OpenAI**: Pay per use (~$0.006 per minute of audio)

## Troubleshooting

### Common Issues:
1. **Webhook not receiving**: Check Railway URL and webhook configuration
2. **API key errors**: Verify keys are set correctly in Railway
3. **Port conflicts**: Use different ports for multiple services
4. **Database access**: Ensure Notion integration has access to database

### Debug Commands:
```bash
# Check service status
railway status

# View logs
railway logs

# Test health endpoint
curl https://your-app.railway.app/health

# Check environment variables
railway variables
``` 