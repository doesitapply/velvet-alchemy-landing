
import fetch from 'node-fetch';

async function verifyScannerRaw() {
    console.log("1. Sending Raw HTTP request to leads.createPublic...");

    try {
        const response = await fetch('http://localhost:3000/api/trpc/leads.createPublic', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                json: {
                    companyName: "Verification Systems Inc",
                    websiteUrl: "https://example.com"
                }
            })
        });

        console.log("   Status:", response.status);
        const text = await response.text();
        console.log("   Body:", text);

        if (response.ok) {
            console.log("✅ Scanner Success (HTTP 200)");
            process.exit(0);
        } else {
            console.error("❌ Scanner Failed (HTTP " + response.status + ")");
            process.exit(1);
        }

    } catch (error: any) {
        console.error("❌ Network Failed:", error);
        process.exit(1);
    }
}

verifyScannerRaw();
