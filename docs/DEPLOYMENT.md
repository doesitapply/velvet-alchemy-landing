# Velvet Alchemy Deployment Guide

This guide provides step-by-step instructions for deploying Velvet Alchemy to production environments.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Storage Configuration](#storage-configuration)
- [External Service Setup](#external-service-setup)
- [Build and Deploy](#build-and-deploy)
- [Post-Deployment Checklist](#post-deployment-checklist)
- [Monitoring and Maintenance](#monitoring-and-maintenance)
- [Rollback Procedures](#rollback-procedures)

---

## Prerequisites

Before deploying Velvet Alchemy, ensure you have the following:

### Required Accounts and Services

- **Supabase Account** - For MySQL database hosting
- **Cloudflare Account** - For R2 object storage
- **Manus Account** - For OAuth, image generation, and LLM services
- **Gmail Account** - For email sending via MCP
- **Domain Name** (optional) - For custom domain configuration

### Required Tools

- **Node.js 22+** - JavaScript runtime
- **pnpm 9+** - Package manager
- **Git** - Version control
- **SSH Access** - To production server (if self-hosting)

### Recommended Infrastructure

For production deployment, the following infrastructure is recommended:

- **Compute**: 2 vCPU, 4GB RAM minimum (scales with traffic)
- **Database**: Supabase Pro plan (connection pooling, backups)
- **Storage**: Cloudflare R2 (unlimited egress, low cost)
- **CDN**: Cloudflare CDN (optional, for asset delivery)

---

## Environment Configuration

### Environment Variables

Create a `.env.production` file with the following variables:

```bash
# Database
DATABASE_URL="mysql://user:password@host:port/database?ssl=true"

# Authentication
JWT_SECRET="your-secure-random-secret-here"
OAUTH_SERVER_URL="https://api.manus.im"
VITE_OAUTH_PORTAL_URL="https://portal.manus.im"
VITE_APP_ID="your-manus-app-id"
OWNER_OPEN_ID="your-manus-open-id"
OWNER_NAME="Your Name"

# Manus API
BUILT_IN_FORGE_API_URL="https://forge.manus.im"
BUILT_IN_FORGE_API_KEY="your-manus-api-key"
VITE_FRONTEND_FORGE_API_URL="https://forge.manus.im"
VITE_FRONTEND_FORGE_API_KEY="your-frontend-api-key"

# Storage (Cloudflare R2)
S3_ENDPOINT="https://your-account-id.r2.cloudflarestorage.com"
S3_REGION="auto"
S3_BUCKET="velvet-alchemy"
S3_ACCESS_KEY_ID="your-r2-access-key"
S3_SECRET_ACCESS_KEY="your-r2-secret-key"

# Application
NODE_ENV="production"
PORT="3000"
VITE_APP_TITLE="Velvet Alchemy"
VITE_APP_LOGO="/images/alchemy-symbol.jpg"

# Analytics (optional)
VITE_ANALYTICS_ENDPOINT="https://analytics.example.com"
VITE_ANALYTICS_WEBSITE_ID="your-website-id"
```

### Generating Secure Secrets

Generate secure random secrets for `JWT_SECRET`:

```bash
# Generate a 64-character random string
openssl rand -hex 32
```

### Environment-Specific Configuration

For multiple environments (staging, production), use separate `.env` files:

- `.env.development` - Local development
- `.env.staging` - Staging environment
- `.env.production` - Production environment

Load the appropriate file based on `NODE_ENV`:

```bash
# Staging
NODE_ENV=staging pnpm start

# Production
NODE_ENV=production pnpm start
```

---

## Database Setup

### Supabase Configuration

1. **Create a new Supabase project**:
   - Navigate to [supabase.com](https://supabase.com)
   - Click "New Project"
   - Choose a region close to your users
   - Set a strong database password

2. **Get connection string**:
   - Navigate to "Settings" → "Database"
   - Copy the "Connection string" (URI format)
   - Replace `[YOUR-PASSWORD]` with your database password
   - Add `?ssl=true` to the end of the connection string

3. **Configure connection pooling** (recommended for production):
   - Navigate to "Settings" → "Database"
   - Copy the "Connection pooling" string
   - Use this for `DATABASE_URL` in production

### Database Migration

Push the database schema to production:

```bash
# Set production DATABASE_URL
export DATABASE_URL="mysql://user:password@host:port/database?ssl=true"

# Push schema
pnpm db:push
```

Verify the migration:

```bash
# Connect to database
mysql -h host -u user -p database

# List tables
SHOW TABLES;

# Verify schema
DESCRIBE leads;
DESCRIBE audits;
DESCRIBE assets;
```

### Database Backups

Configure automated backups in Supabase:

1. Navigate to "Settings" → "Database"
2. Enable "Point-in-time Recovery" (Pro plan)
3. Set backup retention period (7 days recommended)

For manual backups:

```bash
# Export database
mysqldump -h host -u user -p database > backup.sql

# Import database
mysql -h host -u user -p database < backup.sql
```

---

## Storage Configuration

### Cloudflare R2 Setup

1. **Create R2 bucket**:
   - Navigate to Cloudflare dashboard
   - Click "R2" → "Create bucket"
   - Name: `velvet-alchemy`
   - Location: Automatic

2. **Generate API credentials**:
   - Click "Manage R2 API Tokens"
   - Click "Create API token"
   - Permissions: "Object Read & Write"
   - Copy Access Key ID and Secret Access Key

3. **Configure CORS** (for direct uploads):
   ```json
   [
     {
       "AllowedOrigins": ["https://your-domain.com"],
       "AllowedMethods": ["GET", "PUT", "POST"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

4. **Set public access policy**:
   - Navigate to bucket settings
   - Enable "Public access"
   - Set policy to allow public reads

### Storage Testing

Test storage configuration:

```bash
# Test upload
node -e "
const { storagePut } = require('./server/storage');
storagePut('test.txt', 'Hello World', 'text/plain')
  .then(result => console.log('Upload successful:', result.url))
  .catch(error => console.error('Upload failed:', error));
"

# Test download
curl https://your-bucket.r2.dev/test.txt
```

---

## External Service Setup

### Manus OAuth Configuration

1. **Create Manus application**:
   - Navigate to [manus.im](https://manus.im)
   - Go to "Settings" → "Applications"
   - Click "Create Application"
   - Set redirect URI: `https://your-domain.com/api/oauth/callback`

2. **Copy credentials**:
   - Copy Application ID → `VITE_APP_ID`
   - Copy API Key → `BUILT_IN_FORGE_API_KEY`

### Gmail MCP Configuration

1. **Enable Gmail MCP integration**:
   - Navigate to Manus MCP settings
   - Enable "Gmail" integration
   - Authorize with your Gmail account

2. **Test Gmail integration**:
   ```bash
   # List available tools
   manus-mcp-cli tool list --server gmail

   # Test send email
   manus-mcp-cli tool call send_email --server gmail --input '{
     "to": "test@example.com",
     "subject": "Test",
     "body": "Test email"
   }'
   ```

### Manus Image API Configuration

The Manus Image API is automatically configured via `BUILT_IN_FORGE_API_KEY`. No additional setup required.

---

## Build and Deploy

### Build Process

Build the application for production:

```bash
# Install dependencies
pnpm install --frozen-lockfile

# Build frontend and backend
pnpm build

# Output:
# - client/dist/ - Frontend static files
# - dist/ - Backend bundle
```

### Deployment Options

#### Option 1: Manus Hosting (Recommended)

Deploy directly from the Manus UI:

1. Click "Publish" in the Command Center
2. Select deployment region
3. Configure custom domain (optional)
4. Click "Deploy"

Manus hosting provides:
- Automatic SSL certificates
- Global CDN distribution
- Zero-downtime deployments
- Automatic scaling

#### Option 2: Self-Hosting (VPS)

Deploy to your own server:

1. **Upload files**:
   ```bash
   # Copy files to server
   rsync -avz --exclude node_modules . user@server:/var/www/velvet-alchemy
   ```

2. **Install dependencies**:
   ```bash
   ssh user@server
   cd /var/www/velvet-alchemy
   pnpm install --prod
   ```

3. **Start application**:
   ```bash
   # Using PM2 (recommended)
   pm2 start dist/index.js --name velvet-alchemy
   pm2 save
   pm2 startup
   ```

4. **Configure reverse proxy** (Nginx):
   ```nginx
   server {
     listen 80;
     server_name your-domain.com;

     location / {
       proxy_pass http://localhost:3000;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection 'upgrade';
       proxy_set_header Host $host;
       proxy_cache_bypass $http_upgrade;
     }
   }
   ```

5. **Enable SSL** (Let's Encrypt):
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

#### Option 3: Docker Deployment

Deploy using Docker:

1. **Create Dockerfile**:
   ```dockerfile
   FROM node:22-alpine
   WORKDIR /app
   COPY package.json pnpm-lock.yaml ./
   RUN npm install -g pnpm && pnpm install --frozen-lockfile
   COPY . .
   RUN pnpm build
   EXPOSE 3000
   CMD ["node", "dist/index.js"]
   ```

2. **Build image**:
   ```bash
   docker build -t velvet-alchemy .
   ```

3. **Run container**:
   ```bash
   docker run -d \
     --name velvet-alchemy \
     -p 3000:3000 \
     --env-file .env.production \
     velvet-alchemy
   ```

---

## Post-Deployment Checklist

After deployment, verify the following:

### Functional Testing

- [ ] Homepage loads correctly
- [ ] OAuth login works
- [ ] Command Center is accessible
- [ ] Manual lead creation works
- [ ] Screenshot capture succeeds
- [ ] Visual audit generates results
- [ ] Asset generation produces images
- [ ] Outreach draft generation works
- [ ] Email sending succeeds (test mode)

### Security Testing

- [ ] HTTPS is enabled and enforced
- [ ] Session cookies are HTTP-only and Secure
- [ ] Rate limits are enforced
- [ ] Domain reputation checks work
- [ ] Kill-switch can be activated
- [ ] Audit logs are being written

### Performance Testing

- [ ] Page load time < 3 seconds
- [ ] API response time < 500ms
- [ ] Screenshot capture < 10 seconds
- [ ] Asset generation < 90 seconds
- [ ] Database queries are indexed

### Monitoring Setup

- [ ] Error tracking is configured (Sentry, etc.)
- [ ] Uptime monitoring is active
- [ ] Database performance monitoring is enabled
- [ ] S3 usage is tracked
- [ ] Email delivery is monitored

---

## Monitoring and Maintenance

### Application Monitoring

Monitor application health using the Governor dashboard:

- **System Health**: Check kill-switch status and rate limits
- **Audit Logs**: Review recent operations for errors
- **Pipeline Jobs**: Monitor job success/failure rates

### Database Monitoring

Monitor database performance in Supabase:

- **Connection count**: Should stay below pool limit
- **Query performance**: Slow queries should be optimized
- **Storage usage**: Monitor growth and plan for scaling

### Storage Monitoring

Monitor R2 storage usage in Cloudflare:

- **Storage size**: Track total bytes stored
- **Request count**: Monitor API calls
- **Bandwidth**: Track egress (should be low with CDN)

### Log Aggregation

Centralize logs for easier debugging:

```bash
# Using PM2
pm2 logs velvet-alchemy

# Using Docker
docker logs velvet-alchemy

# Using journalctl (systemd)
journalctl -u velvet-alchemy -f
```

### Automated Health Checks

Set up automated health checks:

```bash
# Cron job to check health endpoint
*/5 * * * * curl -f https://your-domain.com/api/health || echo "Health check failed"
```

---

## Rollback Procedures

If a deployment fails, follow these rollback procedures:

### Manus Hosting Rollback

1. Navigate to Command Center
2. Click "Checkpoints" in the sidebar
3. Select the previous stable checkpoint
4. Click "Rollback"

### Self-Hosting Rollback

1. **Stop current application**:
   ```bash
   pm2 stop velvet-alchemy
   ```

2. **Restore previous version**:
   ```bash
   cd /var/www/velvet-alchemy
   git checkout <previous-commit>
   pnpm install
   pnpm build
   ```

3. **Restart application**:
   ```bash
   pm2 restart velvet-alchemy
   ```

### Database Rollback

If database migration fails:

1. **Restore from backup**:
   ```bash
   mysql -h host -u user -p database < backup.sql
   ```

2. **Verify data integrity**:
   ```bash
   # Check row counts
   SELECT COUNT(*) FROM leads;
   SELECT COUNT(*) FROM audits;
   ```

---

**For troubleshooting common deployment issues, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).**
