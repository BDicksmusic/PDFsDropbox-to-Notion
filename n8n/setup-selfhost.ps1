# N8N Self-Hosting Setup Script for Windows
Write-Host "🚀 Setting up N8N for self-hosting..." -ForegroundColor Green

# Check if Docker is installed
try {
    docker --version | Out-Null
    Write-Host "✅ Docker is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not installed. Please install Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Check if Docker Compose is installed
try {
    docker-compose --version | Out-Null
    Write-Host "✅ Docker Compose is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker Compose is not installed. Please install Docker Compose first." -ForegroundColor Red
    exit 1
}

# Generate encryption key
Write-Host "🔐 Generating encryption key..." -ForegroundColor Yellow
$ENCRYPTION_KEY = -join ((48..57) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
Write-Host "Generated encryption key: $ENCRYPTION_KEY" -ForegroundColor Cyan

# Generate database password
Write-Host "🗄️ Generating database password..." -ForegroundColor Yellow
$DB_PASSWORD = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
Write-Host "Generated database password: $DB_PASSWORD" -ForegroundColor Cyan

# Generate admin password
Write-Host "👤 Generating admin password..." -ForegroundColor Yellow
$ADMIN_PASSWORD = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
Write-Host "Generated admin password: $ADMIN_PASSWORD" -ForegroundColor Cyan

# Generate session secret
Write-Host "🔒 Generating session secret..." -ForegroundColor Yellow
$SESSION_SECRET = -join ((48..57) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
Write-Host "Generated session secret: $SESSION_SECRET" -ForegroundColor Cyan

# Create .env file
Write-Host "📝 Creating .env file..." -ForegroundColor Yellow
$envContent = @"
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
"@

$envContent | Out-File -FilePath ".env" -Encoding UTF8
Write-Host "✅ .env file created successfully!" -ForegroundColor Green

# Update docker-compose file with generated values
Write-Host "🔧 Updating docker-compose file..." -ForegroundColor Yellow
$dockerComposeContent = Get-Content "docker-compose-selfhost.yml" -Raw
$dockerComposeContent = $dockerComposeContent -replace "your-secure-password", $ADMIN_PASSWORD
$dockerComposeContent = $dockerComposeContent -replace "your-32-character-encryption-key-here", $ENCRYPTION_KEY
$dockerComposeContent = $dockerComposeContent -replace "your-db-password", $DB_PASSWORD
$dockerComposeContent = $dockerComposeContent -replace "your-session-secret", $SESSION_SECRET
$dockerComposeContent | Out-File -FilePath "docker-compose-selfhost.yml" -Encoding UTF8

Write-Host "✅ Docker Compose file updated!" -ForegroundColor Green

Write-Host ""
Write-Host "🎉 Setup complete! Next steps:" -ForegroundColor Green
Write-Host ""
Write-Host "1. Update your API keys in .env file:" -ForegroundColor Yellow
Write-Host "   - DROPBOX_ACCESS_TOKEN" -ForegroundColor White
Write-Host "   - GOOGLE_DRIVE_CLIENT_ID" -ForegroundColor White
Write-Host "   - GOOGLE_DRIVE_CLIENT_SECRET" -ForegroundColor White
Write-Host "   - GOOGLE_DRIVE_REFRESH_TOKEN" -ForegroundColor White
Write-Host "   - NOTION_API_KEY" -ForegroundColor White
Write-Host "   - OPENAI_API_KEY" -ForegroundColor White
Write-Host ""
Write-Host "2. Update WEBHOOK_URL with your domain" -ForegroundColor Yellow
Write-Host ""
Write-Host "3. Start N8N:" -ForegroundColor Yellow
Write-Host "   docker-compose -f docker-compose-selfhost.yml up -d" -ForegroundColor White
Write-Host ""
Write-Host "4. Access N8N at: http://localhost:5678" -ForegroundColor Yellow
Write-Host "   Username: admin" -ForegroundColor White
Write-Host "   Password: $ADMIN_PASSWORD" -ForegroundColor White
Write-Host ""
Write-Host "5. Check logs:" -ForegroundColor Yellow
Write-Host "   docker-compose -f docker-compose-selfhost.yml logs -f n8n" -ForegroundColor White