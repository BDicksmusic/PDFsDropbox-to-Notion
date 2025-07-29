# N8N Deployment Guide

## Option 1: Deploy from this Repository (Recommended)

### 1. Create Railway Project
1. Go to [Railway.app](https://railway.app)
2. Click "New Project"
3. Choose "Deploy from GitHub repo"
4. Select this repository
5. Set the **Root Directory** to `n8n`

### 2. Add PostgreSQL Database
1. In your Railway project, click "New"
2. Select "Database" → "PostgreSQL"
3. Railway will automatically set the database environment variables

### 3. Set Environment Variables
Add these to your Railway project:

```bash
# N8N Configuration
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=your-secure-password
N8N_HOST=0.0.0.0
N8N_PORT=3000
N8N_PROTOCOL=https
WEBHOOK_URL=https://your-app.railway.app
N8N_ENCRYPTION_KEY=your-32-character-encryption-key

# Database (Railway will set these automatically)
DB_TYPE=postgresdb
DB_POSTGRESDB_HOST=${DATABASE_URL}
DB_POSTGRESDB_PORT=5432
DB_POSTGRESDB_DATABASE=n8n
DB_POSTGRESDB_USER=${DATABASE_USER}
DB_POSTGRESDB_PASSWORD=${DATABASE_PASSWORD}

# API Keys (copy from your current .env file)
DROPBOX_ACCESS_TOKEN=your-dropbox-access-token
GOOGLE_DRIVE_CLIENT_ID=your-google-client-id
GOOGLE_DRIVE_CLIENT_SECRET=your-google-client-secret
GOOGLE_DRIVE_REFRESH_TOKEN=your-google-refresh-token
NOTION_API_KEY=your-notion-api-key
OPENAI_API_KEY=your-openai-api-key
```

### 4. Deploy
1. Railway will automatically deploy when you push changes
2. Access your N8N dashboard at the provided URL
3. Login with admin/your-secure-password

## Option 2: Create Separate Repository

If you prefer a clean repository:

1. Create new GitHub repository: `n8n-automation`
2. Copy the `n8n/` folder contents to the new repository
3. Deploy the new repository to Railway

## Migration Steps

### 1. Export Current Credentials
```bash
# Copy your current environment variables
cp .env n8n-migration.env
```

### 2. Update Webhook URLs
Once N8N is deployed, update your webhook URLs:
- **Dropbox**: Update webhook URL to N8N endpoint
- **Google Drive**: Update webhook URL to N8N endpoint

### 3. Test Workflows
1. Create workflows in N8N dashboard
2. Upload test files
3. Monitor execution
4. Verify Notion page creation

## Advantages of This Approach

✅ **Uses existing repository** - No need for new repo
✅ **Clean separation** - N8N code in dedicated folder
✅ **Easy deployment** - Railway handles everything
✅ **Cost effective** - Same hosting cost
✅ **Easy migration** - Copy existing credentials

## Next Steps

1. **Deploy to Railway** using the guide above
2. **Access N8N dashboard** and create workflows
3. **Test with sample files** to ensure everything works
4. **Update webhook URLs** to point to N8N
5. **Monitor both systems** during transition
6. **Switch over completely** once confident

## Support

If you encounter any issues:
1. Check Railway logs for deployment errors
2. Verify environment variables are set correctly
3. Test N8N dashboard access
4. Create workflows step by step