# Self-Hosting N8N Guide

## Why Self-Host N8N?

✅ **Complete Control** - Your data stays on your infrastructure
✅ **Better Security** - No third-party hosting dependencies
✅ **Cost Effective** - No monthly hosting fees
✅ **Customization** - Full control over configuration
✅ **Privacy** - All data remains private

## Option 1: Docker Compose (Recommended)

### 1. Create Docker Compose File

```yaml
version: '3.8'

services:
  n8n:
    image: n8nio/n8n:latest
    container_name: n8n
    restart: unless-stopped
    ports:
      - "5678:5678"
    environment:
      # Basic Configuration
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=your-secure-password
      - N8N_HOST=0.0.0.0
      - N8N_PORT=5678
      - N8N_PROTOCOL=https
      
      # Encryption Key (IMPORTANT: Generate a secure 32-character key)
      - N8N_ENCRYPTION_KEY=your-32-character-encryption-key-here
      
      # Database (PostgreSQL)
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=postgres
      - DB_POSTGRESDB_PORT=5432
      - DB_POSTGRESDB_DATABASE=n8n
      - DB_POSTGRESDB_USER=n8n
      - DB_POSTGRESDB_PASSWORD=your-db-password
      
      # API Keys
      - DROPBOX_ACCESS_TOKEN=your-dropbox-access-token
      - GOOGLE_DRIVE_CLIENT_ID=your-google-client-id
      - GOOGLE_DRIVE_CLIENT_SECRET=your-google-client-secret
      - GOOGLE_DRIVE_REFRESH_TOKEN=your-google-refresh-token
      - NOTION_API_KEY=your-notion-api-key
      - OPENAI_API_KEY=your-openai-api-key
      
      # Webhook URL (update with your domain)
      - WEBHOOK_URL=https://your-domain.com
      
    volumes:
      - n8n_data:/home/node/.n8n
    depends_on:
      - postgres

  postgres:
    image: postgres:15
    container_name: n8n-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_DB=n8n
      - POSTGRES_USER=n8n
      - POSTGRES_PASSWORD=your-db-password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  n8n_data:
  postgres_data:
```

### 2. Generate Encryption Key

```bash
# Generate a secure 32-character encryption key
openssl rand -hex 16
```

### 3. Create Environment File

Create `n8n/.env`:

```bash
# N8N Configuration
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=your-secure-password
N8N_HOST=0.0.0.0
N8N_PORT=5678
N8N_PROTOCOL=https
N8N_ENCRYPTION_KEY=your-generated-encryption-key

# Database
DB_TYPE=postgresdb
DB_POSTGRESDB_HOST=postgres
DB_POSTGRESDB_PORT=5432
DB_POSTGRESDB_DATABASE=n8n
DB_POSTGRESDB_USER=n8n
DB_POSTGRESDB_PASSWORD=your-db-password

# API Keys
DROPBOX_ACCESS_TOKEN=your-dropbox-access-token
GOOGLE_DRIVE_CLIENT_ID=your-google-client-id
GOOGLE_DRIVE_CLIENT_SECRET=your-google-client-secret
GOOGLE_DRIVE_REFRESH_TOKEN=your-google-refresh-token
NOTION_API_KEY=your-notion-api-key
OPENAI_API_KEY=your-openai-api-key

# Webhook URL
WEBHOOK_URL=https://your-domain.com
```

### 4. Start N8N

```bash
# Navigate to n8n directory
cd n8n

# Start with Docker Compose
docker-compose up -d

# Check logs
docker-compose logs -f n8n
```

## Option 2: Direct Installation

### 1. Install Node.js (v18+)

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# macOS
brew install node@18

# Windows
# Download from https://nodejs.org/
```

### 2. Install N8N

```bash
# Install N8N globally
npm install n8n -g

# Or install locally
npm install n8n
```

### 3. Create Configuration

Create `n8n/config.json`:

```json
{
  "basicAuth": {
    "active": true,
    "user": "admin",
    "password": "your-secure-password"
  },
  "encryption": {
    "key": "your-32-character-encryption-key"
  },
  "database": {
    "type": "postgresdb",
    "postgresdb": {
      "host": "localhost",
      "port": 5432,
      "database": "n8n",
      "user": "n8n",
      "password": "your-db-password"
    }
  },
  "webhook": {
    "url": "https://your-domain.com"
  }
}
```

### 4. Start N8N

```bash
# Start N8N
n8n start

# Or with custom config
n8n start --config config.json
```

## Option 3: Docker (Simple)

### 1. Create Docker Run Command

```bash
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  -e N8N_BASIC_AUTH_ACTIVE=true \
  -e N8N_BASIC_AUTH_USER=admin \
  -e N8N_BASIC_AUTH_PASSWORD=your-secure-password \
  -e N8N_ENCRYPTION_KEY=your-32-character-encryption-key \
  -e DB_TYPE=postgresdb \
  -e DB_POSTGRESDB_HOST=your-postgres-host \
  -e DB_POSTGRESDB_PORT=5432 \
  -e DB_POSTGRESDB_DATABASE=n8n \
  -e DB_POSTGRESDB_USER=n8n \
  -e DB_POSTGRESDB_PASSWORD=your-db-password \
  -e DROPBOX_ACCESS_TOKEN=your-dropbox-access-token \
  -e GOOGLE_DRIVE_CLIENT_ID=your-google-client-id \
  -e GOOGLE_DRIVE_CLIENT_SECRET=your-google-client-secret \
  -e GOOGLE_DRIVE_REFRESH_TOKEN=your-google-refresh-token \
  -e NOTION_API_KEY=your-notion-api-key \
  -e OPENAI_API_KEY=your-openai-api-key \
  -e WEBHOOK_URL=https://your-domain.com \
  n8nio/n8n:latest
```

## Security Best Practices

### 1. Generate Strong Encryption Key

```bash
# Method 1: OpenSSL
openssl rand -hex 16

# Method 2: Node.js
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"

# Method 3: Online generator (less secure)
# Use https://generate-secret.vercel.app/32
```

### 2. Use Strong Passwords

```bash
# Generate strong password
openssl rand -base64 32
```

### 3. Secure Your Installation

```bash
# Create dedicated user
sudo useradd -r -s /bin/false n8n

# Set proper permissions
sudo chown -R n8n:n8n /path/to/n8n
sudo chmod 750 /path/to/n8n
```

### 4. Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:5678;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Environment Variables Reference

### Required Variables

```bash
# Authentication
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=your-secure-password

# Encryption (32 characters)
N8N_ENCRYPTION_KEY=your-32-character-encryption-key

# Database
DB_TYPE=postgresdb
DB_POSTGRESDB_HOST=localhost
DB_POSTGRESDB_PORT=5432
DB_POSTGRESDB_DATABASE=n8n
DB_POSTGRESDB_USER=n8n
DB_POSTGRESDB_PASSWORD=your-db-password

# API Keys
DROPBOX_ACCESS_TOKEN=your-dropbox-access-token
GOOGLE_DRIVE_CLIENT_ID=your-google-client-id
GOOGLE_DRIVE_CLIENT_SECRET=your-google-client-secret
GOOGLE_DRIVE_REFRESH_TOKEN=your-google-refresh-token
NOTION_API_KEY=your-notion-api-key
OPENAI_API_KEY=your-openai-api-key

# Webhook URL
WEBHOOK_URL=https://your-domain.com
```

### Optional Variables

```bash
# Performance
N8N_METRICS=true
N8N_LOG_LEVEL=info

# Security
N8N_SECURE_COOKIE=true
N8N_SESSION_SECRET=your-session-secret

# Customization
N8N_THEME=dark
N8N_TIMEZONE=UTC
```

## Deployment Steps

### 1. Choose Your Method
- **Docker Compose**: Easiest, recommended
- **Direct Installation**: More control
- **Docker Run**: Simple but less manageable

### 2. Set Up Domain
- Point domain to your server
- Set up SSL certificate
- Configure reverse proxy

### 3. Configure Environment
- Generate encryption key
- Set strong passwords
- Add API keys

### 4. Start N8N
- Start the service
- Check logs for errors
- Access dashboard

### 5. Create Workflows
- Import your API credentials
- Create Dropbox workflow
- Create Google Drive workflow
- Test with sample files

## Troubleshooting

### Common Issues

1. **Encryption Key Error**
   ```bash
   # Must be exactly 32 characters
   echo -n "your-key" | wc -c
   ```

2. **Database Connection**
   ```bash
   # Test PostgreSQL connection
   psql -h localhost -U n8n -d n8n
   ```

3. **Port Already in Use**
   ```bash
   # Check what's using port 5678
   sudo netstat -tulpn | grep 5678
   ```

4. **Permission Issues**
   ```bash
   # Fix permissions
   sudo chown -R $USER:$USER ~/.n8n
   ```

## Next Steps

1. **Choose deployment method** (Docker Compose recommended)
2. **Set up your server** with proper security
3. **Generate encryption key** and strong passwords
4. **Configure environment variables**
5. **Start N8N** and access dashboard
6. **Create workflows** for your automation
7. **Test thoroughly** before switching from Railway

Would you like me to help you with any specific part of the self-hosting setup?