
import { google } from 'googleapis';
import http from 'http';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const port = 3000;
const redirectUri = `http://localhost:${port}/auth/google/callback`;

if (!clientId || !clientSecret) {
    console.error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env.local");
    process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
);

// Access scopes for Gmail send
const scopes = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/userinfo.email'
];

const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Critical for receiving a refresh token
    scope: scopes,
    prompt: 'consent' // Force consent screen to ensure refresh token is returned
});

// Create simple server to handle callback
const app = http.createServer(async (req, res) => {
    try {
        if (req.url?.startsWith('/auth/google/callback')) {
            const url = new URL(req.url, `http://localhost:${port}`);
            const code = url.searchParams.get('code');

            if (code) {
                const { tokens } = await oauth2Client.getToken(code);

                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(`
          <h1>Authorization Successful</h1>
          <p>You can close this window and return to the terminal.</p>
        `);

                console.log('\n✅ Authorization Code received.');
                console.log('\n--- ADD THIS TO .env.local ---');
                console.log(`GOOGLE_REFRESH_TOKEN="${tokens.refresh_token}"`);
                console.log('------------------------------\n');

                if (!tokens.refresh_token) {
                    console.warn('⚠️ No refresh token received! You might have already authorized this app.');
                    console.warn('   Visit https://myaccount.google.com/permissions to revoke access and try again.');
                }

                server.close(() => process.exit(0));
            }
        }
    } catch (error) {
        console.error('Error handling callback:', error);
        res.writeHead(500);
        res.end('Authentication failed');
    }
});

const server = app.listen(port, () => {
    console.log("\n🚀 Velvet Alchemy Google Auth Helper");
    console.log("=====================================");
    console.log(`\n1. Ensure 'http://localhost:${port}/auth/google/callback' is configured in Google Cloud Console.`);
    console.log("\n2. Visit this URL in your browser to authorize (use account: madeinreno775@gmail.com):");
    console.log(`\n${authUrl}\n`);
    console.log(`Listening for callback on http://localhost:${port}/auth/google/callback ...`);
});
