# Velvet Alchemy Troubleshooting Guide

This guide provides solutions to common issues encountered when using or deploying Velvet Alchemy.

---

## Table of Contents

- [Authentication Issues](#authentication-issues)
- [Lead Creation Errors](#lead-creation-errors)
- [Screenshot Capture Failures](#screenshot-capture-failures)
- [Visual Audit Problems](#visual-audit-problems)
- [Asset Generation Failures](#asset-generation-failures)
- [Outreach Draft Issues](#outreach-draft-issues)
- [Email Sending Errors](#email-sending-errors)
- [Pipeline Job Failures](#pipeline-job-failures)
- [Database Connection Issues](#database-connection-issues)
- [Storage Upload Failures](#storage-upload-failures)
- [Performance Issues](#performance-issues)
- [Governor and Rate Limiting](#governor-and-rate-limiting)

---

## Authentication Issues

### Problem: "Please login" error on protected pages

**Symptoms**: User is redirected to login page when accessing protected routes

**Causes**:
- Session cookie expired
- Invalid JWT token
- OAuth configuration error

**Solutions**:

1. **Clear browser cookies and re-login**:
   - Open browser DevTools (F12)
   - Navigate to Application → Cookies
   - Delete `manus_session` cookie
   - Refresh page and login again

2. **Verify OAuth configuration**:
   ```bash
   # Check environment variables
   echo $OAUTH_SERVER_URL
   echo $VITE_OAUTH_PORTAL_URL
   echo $VITE_APP_ID
   ```

3. **Check JWT_SECRET**:
   - Ensure `JWT_SECRET` is set and consistent across deployments
   - Changing `JWT_SECRET` invalidates all existing sessions

4. **Verify redirect URI**:
   - In Manus application settings, ensure redirect URI matches:
   - `https://your-domain.com/api/oauth/callback`

---

### Problem: "Forbidden" error when accessing admin features

**Symptoms**: User can login but cannot access Governor or system settings

**Causes**:
- User role is "user" instead of "admin"

**Solutions**:

1. **Check user role in database**:
   ```sql
   SELECT id, email, role FROM users WHERE email = 'your-email@example.com';
   ```

2. **Update user role to admin**:
   ```sql
   UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
   ```

3. **Logout and login again** to refresh session

---

## Lead Creation Errors

### Problem: "Rate limit exceeded"

**Symptoms**: Lead creation fails with rate limit error

**Causes**:
- User has created more than 10 leads in the past hour

**Solutions**:

1. **Wait for rate limit window to reset**:
   - Rate limits reset after 1 hour
   - Check Governor dashboard for exact reset time

2. **Increase rate limit (admin only)**:
   ```sql
   -- Check current rate limit
   SELECT * FROM rate_limits WHERE userId = YOUR_USER_ID AND action = 'lead_create';

   -- Delete rate limit record to reset
   DELETE FROM rate_limits WHERE userId = YOUR_USER_ID AND action = 'lead_create';
   ```

3. **Disable rate limiting temporarily (admin only)**:
   - Navigate to Governor dashboard
   - Adjust rate limit settings
   - Re-enable after testing

---

### Problem: "Domain flagged as unsafe"

**Symptoms**: Lead creation fails with domain reputation error

**Causes**:
- Domain is on a blacklist
- Domain has poor reputation
- Domain does not resolve (DNS error)

**Solutions**:

1. **Verify domain is valid**:
   ```bash
   # Check DNS resolution
   nslookup example.com

   # Check SSL certificate
   curl -I https://example.com
   ```

2. **Check domain blacklist status**:
   - Use online tools like [VirusTotal](https://www.virustotal.com)
   - Verify domain is not flagged as malicious

3. **Bypass reputation check (admin only)**:
   - Temporarily disable domain reputation checks in Governor
   - Only use for testing or trusted domains

---

## Screenshot Capture Failures

### Problem: "Failed to capture screenshot"

**Symptoms**: Lead creation fails during screenshot capture

**Causes**:
- Website blocks automated browsers (Playwright)
- Website is down or unreachable
- Timeout (website loads too slowly)
- JavaScript errors on target website

**Solutions**:

1. **Verify website is accessible**:
   ```bash
   # Test with curl
   curl -I https://example.com

   # Test with browser
   # Open the URL in your browser and verify it loads
   ```

2. **Increase screenshot timeout**:
   - Edit `server/screenshot.ts`
   - Increase `timeout` value from 30000 to 60000 (60 seconds)

3. **Disable JavaScript on target website**:
   - Some websites have JavaScript that blocks automation
   - Edit `server/screenshot.ts` to disable JavaScript:
   ```typescript
   await page.setJavaScriptEnabled(false);
   ```

4. **Use alternative screenshot service**:
   - If Playwright consistently fails, consider using a third-party screenshot API
   - Examples: ScreenshotAPI, ApiFlash, ScreenshotMachine

---

### Problem: Screenshot is blank or incomplete

**Symptoms**: Screenshot is captured but shows a blank page or missing content

**Causes**:
- Website uses lazy loading
- Content loads after initial page load
- JavaScript-heavy website

**Solutions**:

1. **Increase wait time before capture**:
   - Edit `server/screenshot.ts`
   - Add delay before screenshot:
   ```typescript
   await page.waitForTimeout(5000); // Wait 5 seconds
   await page.screenshot({ fullPage: true });
   ```

2. **Wait for specific elements**:
   ```typescript
   // Wait for main content to load
   await page.waitForSelector('main', { timeout: 10000 });
   ```

3. **Scroll page to trigger lazy loading**:
   ```typescript
   // Scroll to bottom to trigger lazy load
   await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
   await page.waitForTimeout(2000);
   ```

---

## Visual Audit Problems

### Problem: "No audit data available"

**Symptoms**: Lead is created but audit is missing or incomplete

**Causes**:
- GPT-4o Vision API error
- Screenshot URL is invalid
- LLM response is malformed

**Solutions**:

1. **Verify screenshot URL is accessible**:
   ```bash
   curl -I https://your-bucket.r2.dev/leads/123/screenshot.png
   ```

2. **Check audit logs**:
   ```sql
   SELECT * FROM audit_log WHERE action = 'visual_audit' ORDER BY createdAt DESC LIMIT 10;
   ```

3. **Manually trigger audit**:
   - Navigate to lead detail page
   - Click "Re-run Audit" button (if available)
   - Or use tRPC procedure directly

4. **Check LLM API status**:
   - Verify `BUILT_IN_FORGE_API_KEY` is valid
   - Check Manus API status page

---

### Problem: Prestige score is always 0 or null

**Symptoms**: Visual audit completes but prestige score is missing

**Causes**:
- LLM response does not include prestige score
- Prestige score calculation logic error

**Solutions**:

1. **Check audit data structure**:
   ```sql
   SELECT visualDebtData FROM audits WHERE leadId = YOUR_LEAD_ID;
   ```

2. **Verify LLM prompt includes prestige score**:
   - Edit `server/visualAudit.ts`
   - Ensure prompt explicitly requests prestige score

3. **Recalculate prestige score**:
   ```sql
   -- Manually set prestige score based on visual debt scores
   UPDATE audits SET prestigeScore = 75 WHERE leadId = YOUR_LEAD_ID;
   ```

---

## Asset Generation Failures

### Problem: "Asset generation failed"

**Symptoms**: Asset generation workflow fails with generic error

**Causes**:
- Manus Image API error
- Invalid prompt
- API rate limit exceeded

**Solutions**:

1. **Check Manus API status**:
   - Verify `BUILT_IN_FORGE_API_KEY` is valid
   - Check Manus API rate limits

2. **Review error logs**:
   ```sql
   SELECT * FROM audit_log WHERE action = 'asset_generate' AND status = 'failure' ORDER BY createdAt DESC LIMIT 10;
   ```

3. **Manually retry asset generation**:
   - Navigate to lead detail page
   - Click "Generate Assets" button
   - Monitor progress in real-time

4. **Simplify prompt**:
   - Edit `server/visionary.ts`
   - Reduce prompt complexity
   - Remove special characters or formatting

---

### Problem: Generated assets are low quality

**Symptoms**: Assets are generated but quality is poor (blurry, incorrect colors, etc.)

**Causes**:
- Business DNA extraction is inaccurate
- Prompt engineering needs improvement
- Image API limitations

**Solutions**:

1. **Review Business DNA**:
   - Check visual audit data for accuracy
   - Verify colors, typography, and style are correct

2. **Improve prompt engineering**:
   - Edit `server/visionary.ts`
   - Add more specific details to prompts
   - Include reference images (if supported by API)

3. **Regenerate assets**:
   - Delete existing assets from database
   - Trigger asset generation again

4. **Manual editing**:
   - Download generated assets
   - Edit in Photoshop/Figma
   - Re-upload to S3

---

## Outreach Draft Issues

### Problem: "No audit data available" when generating draft

**Symptoms**: Outreach draft generation fails with missing audit error

**Causes**:
- Lead does not have a completed visual audit
- Audit data is corrupted

**Solutions**:

1. **Verify audit exists**:
   ```sql
   SELECT * FROM audits WHERE leadId = YOUR_LEAD_ID;
   ```

2. **Re-run visual audit**:
   - Navigate to lead detail page
   - Click "Re-run Audit" button
   - Wait for completion

3. **Check audit data structure**:
   ```sql
   SELECT visualDebtData FROM audits WHERE leadId = YOUR_LEAD_ID;
   ```

---

### Problem: Draft quality is poor

**Symptoms**: Email copy is generic, unpersonalized, or low quality

**Causes**:
- Visual audit lacks detail
- LLM prompt needs improvement
- Recipient information is incomplete

**Solutions**:

1. **Improve visual audit quality**:
   - Ensure screenshot is high resolution
   - Re-run audit with more detailed prompt

2. **Provide complete recipient information**:
   - Include recipient name (not just email)
   - Add company role or title (if available)

3. **Edit draft manually**:
   - Navigate to Charmer dashboard
   - Edit subject and body before approving
   - Use draft as a starting point, not final version

4. **Improve prompt engineering**:
   - Edit `server/charmer.ts`
   - Add more context to LLM prompt
   - Include examples of high-quality emails

---

## Email Sending Errors

### Problem: "Gmail MCP error"

**Symptoms**: Email sending fails with Gmail integration error

**Causes**:
- Gmail MCP not configured
- OAuth token expired
- Gmail API rate limit exceeded

**Solutions**:

1. **Verify Gmail MCP is enabled**:
   ```bash
   manus-mcp-cli tool list --server gmail
   ```

2. **Re-authorize Gmail**:
   - Navigate to Manus MCP settings
   - Re-authorize Gmail integration
   - Grant necessary permissions

3. **Check Gmail API quotas**:
   - Navigate to Google Cloud Console
   - Check Gmail API usage
   - Request quota increase if needed

4. **Test Gmail integration**:
   ```bash
   manus-mcp-cli tool call send_email --server gmail --input '{
     "to": "test@example.com",
     "subject": "Test",
     "body": "Test email"
   }'
   ```

---

### Problem: Emails are not being delivered

**Symptoms**: Email sending succeeds but recipient does not receive email

**Causes**:
- Email is in spam folder
- Recipient email is invalid
- SPF/DKIM/DMARC not configured

**Solutions**:

1. **Check spam folder**:
   - Ask recipient to check spam/junk folder
   - Mark email as "Not Spam"

2. **Verify recipient email**:
   ```bash
   # Test email deliverability
   echo "Test" | mail -s "Test" recipient@example.com
   ```

3. **Configure email authentication**:
   - Set up SPF record in DNS
   - Enable DKIM signing in Gmail
   - Configure DMARC policy

4. **Use custom domain**:
   - Send emails from your own domain (not Gmail)
   - Configure SPF/DKIM/DMARC for your domain

---

## Pipeline Job Failures

### Problem: Pipeline job stuck in "running" state

**Symptoms**: Job status shows "running" but no progress for extended period

**Causes**:
- Background job process crashed
- Database connection lost
- Infinite loop in agent code

**Solutions**:

1. **Check job details**:
   ```sql
   SELECT * FROM pipeline_jobs WHERE status = 'running' ORDER BY updatedAt DESC;
   ```

2. **Manually mark job as failed**:
   ```sql
   UPDATE pipeline_jobs SET status = 'failed', errorMessage = 'Timeout' WHERE id = YOUR_JOB_ID;
   ```

3. **Restart background job process**:
   ```bash
   # Using PM2
   pm2 restart velvet-alchemy

   # Using Docker
   docker restart velvet-alchemy
   ```

4. **Retry job**:
   - Navigate to Orchestrator dashboard
   - Click "Retry" on failed job

---

### Problem: All pipeline jobs are failing

**Symptoms**: Every pipeline execution fails at the same stage

**Causes**:
- External service is down (S3, LLM API, etc.)
- Configuration error
- Database migration issue

**Solutions**:

1. **Check external service status**:
   - Verify S3 is accessible
   - Check Manus API status
   - Test Gmail MCP integration

2. **Review error logs**:
   ```sql
   SELECT errorMessage FROM pipeline_jobs WHERE status = 'failed' ORDER BY createdAt DESC LIMIT 10;
   ```

3. **Test each agent individually**:
   - Create lead manually (Curator)
   - Generate assets manually (Visionary)
   - Create draft manually (Charmer)

4. **Check database schema**:
   ```bash
   pnpm db:push
   ```

---

## Database Connection Issues

### Problem: "Connection refused" or "Connection timeout"

**Symptoms**: Application cannot connect to database

**Causes**:
- Database is down
- Incorrect connection string
- Firewall blocking connection
- SSL configuration error

**Solutions**:

1. **Verify database is running**:
   - Check Supabase dashboard
   - Verify database status is "Healthy"

2. **Test connection string**:
   ```bash
   mysql -h host -u user -p database
   ```

3. **Check SSL configuration**:
   - Ensure connection string includes `?ssl=true`
   - Verify SSL certificate is valid

4. **Whitelist IP address**:
   - In Supabase, add your server's IP to allowed list
   - Or disable IP restrictions (not recommended for production)

---

### Problem: "Too many connections"

**Symptoms**: Database queries fail with connection pool exhausted error

**Causes**:
- Connection pool is too small
- Connections are not being released
- High traffic

**Solutions**:

1. **Increase connection pool size**:
   - Edit `DATABASE_URL` to include `?pool=20`
   - Or configure in Drizzle ORM settings

2. **Use connection pooling**:
   - Switch to Supabase connection pooling URL
   - Navigate to "Settings" → "Database" → "Connection pooling"

3. **Fix connection leaks**:
   - Review code for unclosed connections
   - Ensure all queries use `await`

4. **Scale database**:
   - Upgrade Supabase plan
   - Increase connection limit

---

## Storage Upload Failures

### Problem: "Failed to upload to S3"

**Symptoms**: Screenshot or asset upload fails

**Causes**:
- Invalid S3 credentials
- Bucket does not exist
- CORS configuration error
- Network timeout

**Solutions**:

1. **Verify S3 credentials**:
   ```bash
   echo $S3_ACCESS_KEY_ID
   echo $S3_SECRET_ACCESS_KEY
   echo $S3_BUCKET
   ```

2. **Test S3 connection**:
   ```bash
   # Using AWS CLI
   aws s3 ls s3://your-bucket --endpoint-url https://your-account-id.r2.cloudflarestorage.com
   ```

3. **Check bucket permissions**:
   - Verify bucket exists in Cloudflare R2
   - Ensure API token has "Object Read & Write" permissions

4. **Configure CORS**:
   - Add CORS policy to bucket
   - Allow `PUT` and `POST` methods

---

### Problem: Uploaded files are not accessible

**Symptoms**: Files upload successfully but URLs return 403 Forbidden

**Causes**:
- Bucket is not public
- File ACL is incorrect
- CORS policy blocks access

**Solutions**:

1. **Make bucket public**:
   - Navigate to Cloudflare R2 dashboard
   - Enable "Public access" for bucket

2. **Set file ACL to public-read**:
   - Edit `server/storage.ts`
   - Add `ACL: 'public-read'` to upload parameters

3. **Test file access**:
   ```bash
   curl -I https://your-bucket.r2.dev/test.txt
   ```

---

## Performance Issues

### Problem: Slow page load times

**Symptoms**: Pages take more than 3 seconds to load

**Causes**:
- Large bundle size
- Unoptimized images
- Slow database queries
- No caching

**Solutions**:

1. **Optimize bundle size**:
   ```bash
   # Analyze bundle
   pnpm build --analyze

   # Remove unused dependencies
   pnpm prune
   ```

2. **Optimize images**:
   - Compress images before upload
   - Use WebP format
   - Implement lazy loading

3. **Add database indexes**:
   ```sql
   CREATE INDEX idx_leads_userId ON leads(userId);
   CREATE INDEX idx_audits_leadId ON audits(leadId);
   ```

4. **Enable caching**:
   - Add `Cache-Control` headers to static assets
   - Use CDN for asset delivery

---

### Problem: High memory usage

**Symptoms**: Application crashes with "Out of memory" error

**Causes**:
- Memory leak in code
- Large file uploads
- Too many concurrent requests

**Solutions**:

1. **Increase memory limit**:
   ```bash
   # Using Node.js flag
   node --max-old-space-size=4096 dist/index.js
   ```

2. **Profile memory usage**:
   ```bash
   # Using Node.js inspector
   node --inspect dist/index.js
   ```

3. **Fix memory leaks**:
   - Review code for unclosed connections
   - Ensure event listeners are removed
   - Use weak references for caches

4. **Limit concurrent requests**:
   - Implement request queuing
   - Add rate limiting

---

## Governor and Rate Limiting

### Problem: Kill-switch is active

**Symptoms**: All operations are blocked with kill-switch error

**Causes**:
- Admin activated global kill-switch
- User-specific kill-switch is active
- System detected abuse

**Solutions**:

1. **Check kill-switch status**:
   ```sql
   SELECT * FROM system_config WHERE key LIKE 'kill_switch%';
   ```

2. **Disable global kill-switch** (admin only):
   ```sql
   UPDATE system_config SET value = 'false' WHERE key = 'kill_switch_global';
   ```

3. **Disable user kill-switch** (admin only):
   ```sql
   DELETE FROM system_config WHERE key = 'kill_switch_user_123';
   ```

4. **Review audit logs**:
   ```sql
   SELECT * FROM audit_log WHERE status = 'blocked' ORDER BY createdAt DESC LIMIT 20;
   ```

---

### Problem: Rate limits are too restrictive

**Symptoms**: Users frequently hit rate limits during normal usage

**Causes**:
- Rate limits are set too low
- High traffic periods
- Automated testing

**Solutions**:

1. **Adjust rate limits** (admin only):
   - Edit `server/governor.ts`
   - Increase rate limit values
   - Restart application

2. **Reset rate limit windows**:
   ```sql
   DELETE FROM rate_limits WHERE userId = YOUR_USER_ID;
   ```

3. **Implement tiered rate limits**:
   - Different limits for different user roles
   - Higher limits for paid users

4. **Add rate limit exemptions**:
   - Whitelist specific users or IP addresses
   - Bypass rate limits for internal testing

---

**Still having issues?** Contact support at support@manus.im with detailed error logs and steps to reproduce.
