
import { google } from "googleapis";
import express from "express";
import "dotenv/config";

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const port = 3000;
const redirectUri = `http://localhost:${port}/auth/google/callback`;

if (!clientId || !clientSecret) {
    console.error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env");
    process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

const scopes = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly"
];

const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent"
});

const app = express();

app.get("/auth/google/callback", async (req, res) => {
    const code = req.query.code as string;
    if (code) {
        try {
            const { tokens } = await oauth2Client.getToken(code);
            console.log("\n✅ SUCCESS! Copy this Refresh Token to your .env file:");
            console.log(`\nGOOGLE_REFRESH_TOKEN="${tokens.refresh_token}"\n`);
            res.send("<h1>Success!</h1><p>Check your terminal for the Refresh Token.</p>");
            process.exit(0);
        } catch (error) {
            console.error("Error exchanging code for token:", error);
            res.status(500).send("Error exchanging code for token");
        }
    } else {
        res.status(400).send("No code found in request");
    }
});

console.log("\n🚀 Velvet Alchemy Google Auth Helper");
console.log("=====================================");
console.log(`\n1. Ensure 'http://localhost:3000/auth/google/callback' is added to 'Authorized redirect URIs' in your Google Cloud Console.`);
console.log("\n2. Visit this URL in your browser to authorize:");
console.log(`\n${authUrl}\n`);
console.log(`Listening for callback on http://localhost:${port}/auth/google/callback ...`);

app.listen(port);
