
import { router, publicProcedure } from "../_core/trpc";
import { makeRequest, PlacesSearchResult, PlaceDetailsResult } from "../_core/map";
import { createLead, createAudit, updateLead } from "../db";
import { analyzeVisualDebt } from "../visualAudit";
import { generateOutreachCopy } from "../charmer";
import { z } from "zod";

export const testRouter = router({
    runRealWorkflow: publicProcedure
        .input(z.object({
            query: z.string().default("coffee shops in Reno, NV")
        }))
        .mutation(async ({ input }) => {
            console.log("🚀 STARTING REAL WORLD ALCHEMY CYCLE (Server Side)");
            console.log(`🔍 Searching Google Maps for: "${input.query}"...`);

            try {
                const searchPlaces = await makeRequest<PlacesSearchResult>(
                    "/maps/api/place/textsearch/json",
                    { query: input.query }
                );

                if (searchPlaces.status !== "OK" || !searchPlaces.results || searchPlaces.results.length === 0) {
                    throw new Error(`Google Maps search failed: ${searchPlaces.status}`);
                }

                console.log(`✅ Found ${searchPlaces.results.length} results.`);

                // Pick the first result that has a website
                let targetPlace = null;
                let targetUrl = "";

                for (const place of searchPlaces.results.slice(0, 5)) {
                    const details = await makeRequest<PlaceDetailsResult>(
                        "/maps/api/place/details/json",
                        {
                            place_id: place.place_id,
                            fields: "name,website,formatted_address"
                        }
                    );

                    if (details.result.website) {
                        targetPlace = details.result;
                        targetUrl = details.result.website;
                        console.log(`🎯 Targeted: ${targetPlace.name} (${targetUrl})`);
                        break;
                    }
                }

                if (!targetPlace || !targetUrl) {
                    throw new Error("No suitable leads with websites found.");
                }

                // STEP 2: CREATE LEAD
                console.log("\n📝 Creating Lead record...");
                const lead = await createLead({
                    userId: 1,
                    companyName: targetPlace.name,
                    websiteUrl: targetUrl,
                    status: 'pending'
                });

                if (!lead) throw new Error("Failed to create lead.");
                console.log(`✅ Lead created! ID: ${lead.id}`);

                // STEP 3: RUN AI AUDIT
                console.log("\n🤖 Running Visual Debt Analysis (GPT-4o Vision)...");

                // Use a placeholder screenshot for now as per the original script logic
                const realCoffeeShopImage = "https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=1000&auto=format&fit=crop";

                const auditResult = await analyzeVisualDebt(
                    realCoffeeShopImage,
                    lead.websiteUrl,
                    lead.companyName
                );

                console.log(`\n✅ Audit Complete! Scored: ${auditResult.prestigeScore}/100`);

                const savedAudit = await createAudit({
                    leadId: lead.id,
                    summary: auditResult.summary,
                    prestigeScore: auditResult.prestigeScore,
                    visualDebtData: JSON.stringify(auditResult)
                });

                await updateLead(lead.id, {
                    prestigeScore: auditResult.prestigeScore,
                    status: 'audited'
                });

                // STEP 4: GENERATE OUTREACH
                console.log("\n💌 Generating The Charmer Outreach Email...");
                const emailData = await generateOutreachCopy(lead, savedAudit, []);

                return {
                    success: true,
                    lead,
                    audit: savedAudit,
                    email: emailData
                };

            } catch (error: any) {
                console.error("\n❌ Workflow Failed:", error);
                throw new Error(`Workflow failed: ${error.message}`);
            }
        })
});
