#!/bin/bash

# N8N Self-Hosting Setup Script
echo "🚀 Setting up N8N for self-hosting..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Generate encryption key
echo "🔐 Generating encryption key..."
ENCRYPTION_KEY=$(openssl rand -hex 16)
echo "Generated encryption key: $ENCRYPTION_KEY"

# Generate database password
echo "🗄️ Generating database password..."
DB_PASSWORD=$(openssl rand -base64 32)
echo "Generated database password: $DB_PASSWORD"

# Generate admin password
echo "👤 Generating admin password..."
ADMIN_PASSWORD=$(openssl rand -base64 32)
echo "Generated admin password: $ADMIN_PASSWORD"

# Generate session secret
echo "🔒 Generating session secret..."
SESSION_SECRET=$(openssl rand -hex 32)
echo "Generated session secret: $SESSION_SECRET"

# Create .env file
echo "📝 Creating .env file..."
cat > .env << EOF
# N8N Configuration
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=$ADMIN_PASSWORD
N8N_HOST=0.0.0.0
N8N_PORT=5678
N8N_PROTOCOL=https
N8N_ENCRYPTION_KEY=$ENCRYPTION_KEY

# Database
DB_TYPE=postgresdb
DB_POSTGRESDB_HOST=postgres
DB_POSTGRESDB_PORT=5432
DB_POSTGRESDB_DATABASE=n8n
DB_POSTGRESDB_USER=n8n
DB_POSTGRESDB_PASSWORD=$DB_PASSWORD

# Security
N8N_SECURE_COOKIE=true
N8N_SESSION_SECRET=$SESSION_SECRET

# Performance
N8N_METRICS=true
N8N_LOG_LEVEL=info

# API Keys (UPDATE THESE WITH YOUR ACTUAL KEYS)
DROPBOX_ACCESS_TOKEN=your-dropbox-access-token
GOOGLE_DRIVE_CLIENT_ID=your-google-client-id
GOOGLE_DRIVE_CLIENT_SECRET=your-google-client-secret
GOOGLE_DRIVE_REFRESH_TOKEN=your-google-refresh-token
NOTION_API_KEY=your-notion-api-key
OPENAI_API_KEY=your-openai-api-key

# Webhook URL (UPDATE WITH YOUR DOMAIN)
WEBHOOK_URL=https://your-domain.com
EOF

echo "✅ .env file created successfully!"

# Update docker-compose file with generated values
echo "🔧 Updating docker-compose file..."
sed -i "s/your-secure-password/$ADMIN_PASSWORD/g" docker-compose-selfhost.yml
sed -i "s/your-32-character-encryption-key-here/$ENCRYPTION_KEY/g" docker-compose-selfhost.yml
sed -i "s/your-db-password/$DB_PASSWORD/g" docker-compose-selfhost.yml
sed -i "s/your-session-secret/$SESSION_SECRET/g" docker-compose-selfhost.yml

echo "✅ Docker Compose file updated!"

echo ""
echo "🎉 Setup complete! Next steps:"
echo ""
echo "1. Update your API keys in .env file:"
echo "   - DROPBOX_ACCESS_TOKEN"
echo "   - GOOGLE_DRIVE_CLIENT_ID"
echo "   - GOOGLE_DRIVE_CLIENT_SECRET"
echo "   - GOOGLE_DRIVE_REFRESH_TOKEN"
echo "   - NOTION_API_KEY"
echo "   - OPENAI_API_KEY"
echo ""
echo "2. Update WEBHOOK_URL with your domain"
echo ""
echo "3. Start N8N:"
echo "   docker-compose -f docker-compose-selfhost.yml up -d"
echo ""
echo "4. Access N8N at: http://localhost:5678"
echo "   Username: admin"
echo "   Password: $ADMIN_PASSWORD"
echo ""
echo "5. Check logs:"
echo "   docker-compose -f docker-compose-selfhost.yml logs -f n8n"