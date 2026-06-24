
import { scraperRouter } from "../server/scraperRouter";
import { getDb } from "../server/db";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

// Mock user for context
const mockUser = {
    id: 1,
    openId: "mock-openid",
    role: "admin" as const,
    email: "test@example.com",
    name: "Test User",
    loginMethod: "mock",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
};

// Mock context
const mockCtx = {
    user: mockUser,
    req: {} as any,
    res: {} as any,
};

async function main() {
    console.log("🚀 Starting Scraper Debugger...");

    // Initialize DB (Optional for searchBusinesses)
    const db = await getDb();
    if (!db) {
        console.warn("⚠️  DB not connected (searchBusinesses should still work if API keys are set)");
    } else {
        console.log("✅ DB Connected");
    }

    // Create caller
    const caller = scraperRouter.createCaller(mockCtx);

    console.log("\n--- Testing searchBusinesses ---");
    try {
        const searchRes = await caller.searchBusinesses({
            city: "Reno",
            state: "NV",
            category: "med spa",
            limit: 3,
        });
        console.log("Search Result:", JSON.stringify(searchRes, null, 2));
    } catch (err) {
        console.error("❌ searchBusinesses failed:", err);
    }

    console.log("\n--- Testing bulkScrapeAndCreate (The Brain) ---");
    // This will actually try to create leads and call AI
    try {
        const scrapeRes = await caller.bulkScrapeAndCreate({
            city: "Reno",
            state: "NV",
            category: "med spa",
            targetKeyword: "best med spa reno",
            limit: 2, // Keep it small for testing
        });
        console.log("Bulk Scrape Result:", JSON.stringify(scrapeRes, null, 2));
    } catch (err) {
        console.error("❌ bulkScrapeAndCreate failed:", err);
    }
}

main().catch(console.error);
