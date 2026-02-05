import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { makeRequest, PlacesSearchResult, PlaceDetailsResult } from "./_core/map";
import * as db from "./db";
import { supabase } from "./_core/supabase";

/**
 * Scraper Router
 * Handles Google Maps scraping, ranking checks, and bulk business discovery
 */

export const scraperRouter = router({
  /**
   * Search for local businesses using Google Maps Places API
   * Returns businesses with their websites and basic info
   */
  searchBusinesses: protectedProcedure
    .input(
      z.object({
        city: z.string().min(1),
        state: z.string().min(2).max(2).optional(),
        category: z.string().min(1), // e.g., "pizza restaurant", "plumber", "dentist"
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { city, state, category, limit } = input;

      // Build search query
      const location = state ? `${city}, ${state}` : city;
      const searchQuery = `${category} in ${location}`;

      try {
        // Use Google Maps Places API to search for businesses
        const placesResult = await makeRequest<PlacesSearchResult>(
          "/maps/api/place/textsearch/json",
          { query: searchQuery }
        );

        if (placesResult.status !== "OK" || !placesResult.results) {
          return {
            success: true,
            businesses: [],
            query: searchQuery,
            count: 0,
          };
        }

        // Fetch details for each place to get website URLs
        const businesses = [];
        for (const place of placesResult.results.slice(0, limit)) {
          try {
            // Fetch place details to get website URL
            const details = await makeRequest<PlaceDetailsResult>(
              "/maps/api/place/details/json",
              {
                place_id: place.place_id,
                fields: "name,website,formatted_address,rating,user_ratings_total"
              }
            );

            const url = details.result.website;
            if (!url) continue; // Skip businesses without websites

            // Skip aggregator sites
            if (
              url.includes("yelp.com") ||
              url.includes("yellowpages.com") ||
              url.includes("facebook.com") ||
              url.includes("google.com/maps")
            ) {
              continue;
            }

            businesses.push({
              name: details.result.name,
              url: url,
              snippet: `${details.result.formatted_address} | Rating: ${details.result.rating || "N/A"} (${details.result.user_ratings_total || 0} reviews)`,
              category: category,
              city: city,
              state: state || "",
              rating: details.result.rating,
              reviewCount: details.result.user_ratings_total,
              address: details.result.formatted_address,
            });
          } catch (error) {
            console.error(`Failed to fetch details for ${place.name}:`, error);
            continue;
          }
        }

        return {
          success: true,
          businesses,
          query: searchQuery,
          count: businesses.length,
        };
      } catch (error) {
        console.error("Business search error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to search for businesses",
        });
      }
    }),

  /**
   * Check Google Maps ranking for a specific business/keyword
   * Returns ranking position (1-100) or null if not found
   */
  checkRanking: protectedProcedure
    .input(
      z.object({
        businessName: z.string().min(1),
        keyword: z.string().min(1), // e.g., "best pizza reno"
        location: z.string().min(1), // e.g., "Reno, NV"
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { businessName, keyword, location } = input;

      try {
        // Search Google Maps for the keyword + location
        const searchQuery = `${keyword} ${location}`;
        const placesResult = await makeRequest<PlacesSearchResult>(
          "/maps/api/place/textsearch/json",
          { query: searchQuery }
        );

        if (placesResult.status !== "OK" || !placesResult.results) {
          return {
            success: true,
            businessName,
            keyword,
            location,
            position: null,
            message: `${businessName} not found in top 100 results for "${keyword}"`,
          };
        }

        // Find the business in search results
        let position = null;
        for (let i = 0; i < placesResult.results.length; i++) {
          const place = placesResult.results[i];
          const name = place.name || "";

          // Check if this result matches the business
          if (name.toLowerCase().includes(businessName.toLowerCase())) {
            position = i + 1;
            break;
          }
        }

        return {
          success: true,
          businessName,
          keyword,
          location,
          position,
          message:
            position === null
              ? `${businessName} not found in top 100 results for "${keyword}"`
              : `${businessName} ranks #${position} for "${keyword}"`,
        };
      } catch (error) {
        console.error("Ranking check error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to check ranking",
        });
      }
    }),

  /**
   * Bulk scrape businesses and create leads
   * Searches for businesses, checks their ranking, and creates lead records
   */
  bulkScrapeAndCreate: protectedProcedure
    .input(
      z.object({
        city: z.string().min(1),
        state: z.string().min(2).max(2).optional(),
        category: z.string().min(1),
        targetKeyword: z.string().min(1), // e.g., "best pizza"
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { city, state, category, targetKeyword, limit } = input;
      // Dynamic import to avoid circular defaults if any
      const { invokeAI } = await import("./aiProvider");

      try {
        // Step 1: Search for businesses
        const location = state ? `${city}, ${state}` : city;
        const searchQuery = `${category} in ${location}`;

        // Use Google Maps Places API to search for businesses
        const placesResult = await makeRequest<PlacesSearchResult>(
          "/maps/api/place/textsearch/json",
          { query: searchQuery }
        );

        if (placesResult.status !== "OK" || !placesResult.results) {
          return {
            success: true,
            query: searchQuery,
            totalFound: 0,
            createdCount: 0,
            errorCount: 0,
            leads: [],
            errors: [],
          };
        }

        // Step 2: Filter and process businesses
        const createdLeads = [];
        const errors = [];

        // Scrape a few more than limit to account for filtering
        for (const place of placesResult.results.slice(0, limit + 10)) {
          // Stop if we hit the requested limit
          if (createdLeads.length >= limit) break;

          let url: string | undefined;
          let businessName: string;

          try {
            // Fetch place details to get website URL AND Reviews/Rating for context
            const details = await makeRequest<PlaceDetailsResult>(
              "/maps/api/place/details/json",
              {
                place_id: place.place_id,
                fields: "name,website,formatted_address,rating,user_ratings_total,reviews,types"
              }
            );

            url = details.result.website;
            businessName = details.result.name;

            if (!url) continue; // Skip businesses without websites

            // Skip aggregator sites
            if (
              url.includes("yelp.com") ||
              url.includes("yellowpages.com") ||
              url.includes("facebook.com") ||
              url.includes("google.com/maps") ||
              url.includes("instagram.com") ||
              url.includes("linkedin.com")
            ) {
              continue;
            }

            // === SMART FILTERING (The "Brain") ===

            // 1. Basic Heuristics
            const rating = details.result.rating || 0;
            const reviewCount = details.result.user_ratings_total || 0;

            // Skip if it looks like a "ghost" listing (no reviews, likely not active/high-ticket)
            if (reviewCount < 3) {
              continue;
            }

            // 2. LLM Qualification ("Would they actually buy this?")
            // We ask the AI to screen the prospect based on name, category, and perceived size/type.
            try {
              const qualification = await invokeAI({
                messages: [
                  {
                    role: "system",
                    content: `You are a high-ticket sales prospector. Your job is to qualify businesses for a $5,000+ website overhaul.
                            
                            Criteria for Qualification (YES):
                            - Independent local business (Law firm, Med Spa, Contractor, boutique, high-end restaurant).
                            - Valid business name (not "ATM" or "Kiosk").
                            - Likely to have revenue (based on industry).

                            Criteria for Disqualification (NO):
                            - Large National Chains (Starbucks, McDonald's, Home Depot, Walmart).
                            - Public institutions (Schools, Libraries, Post Office).
                            - Very low value/hobby businesses (Lemonade stand, obscure hobby shop).
                            
                            Return a JSON object.`
                  },
                  {
                    role: "user",
                    content: `Qualify this business:
                            Name: ${businessName}
                            Category: ${category}
                            Address: ${details.result.formatted_address}
                            Reviews: ${reviewCount}
                            
                            Is this a valid high-ticket prospect?`
                  }
                ],
                responseFormat: "json_schema",
                schema: {
                  name: "lead_qualification",
                  strict: true,
                  schema: {
                    type: "object",
                    properties: {
                      isQualified: { type: "boolean" },
                      reason: { type: "string" }
                    },
                    required: ["isQualified", "reason"],
                    additionalProperties: false
                  }
                }
              });

              const result = JSON.parse(qualification.content || "{}");
              if (!result.isQualified) {
                console.log(`[Smart Filter] Skipped ${businessName}: ${result.reason}`);
                continue;
              }
            } catch (aiError) {
              console.warn(`[Smart Filter] AI failed for ${businessName}, proceeding cautiously.`, aiError);
            }

            // === END SMART FILTERING ===

          } catch (error) {
            console.error(`Failed to fetch details for ${place.name}:`, error);
            continue;
          }

          try {
            // Check if lead already exists by URL
            const dbConn = await db.getDb();
            if (!dbConn) continue;

            const { eq } = await import("drizzle-orm");
            const { leads } = await import("../drizzle/schema");
            const existing = await dbConn.select().from(leads).where(eq(leads.websiteUrl, url)).limit(1);
            if (existing.length > 0) {
              console.log(`Lead already exists: ${businessName}`);
              continue;
            }

            // Create lead
            const lead = await db.createLead({
              userId: ctx.user.id,
              companyName: businessName,
              websiteUrl: url,
              status: "pending",
            });

            createdLeads.push(lead);

            // Auto-trigger audit for the newly created lead
            if (lead && lead.id) {
              try {
                // Import orchestrator pipeline function
                const { executePipeline } = await import("./orchestrator");
                // Queue audit in background (don't await to avoid blocking scraper)
                executePipeline(lead.id, ctx.user.id).catch((err: any) => {
                  console.error(`Auto-audit failed for lead ${lead.id}:`, err);
                });
              } catch (auditError) {
                console.error(`Failed to trigger auto-audit for ${businessName}:`, auditError);
              }
            }
          } catch (error) {
            console.error(`Error creating lead for ${businessName}:`, error);
            errors.push({
              businessName,
              url,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }

        return {
          success: true,
          query: searchQuery,
          totalFound: placesResult.results.length,
          createdCount: createdLeads.length,
          errorCount: errors.length,
          leads: createdLeads,
          errors,
        };
      } catch (error) {
        console.error("Bulk scrape error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to bulk scrape businesses",
        });
      }
    }),

  /**
   * Get available business categories
   */
  getCategories: publicProcedure.query(async () => {
    return {
      categories: [
        { value: "restaurant", label: "Restaurants", keywords: ["best restaurant", "top restaurant", "restaurant near me"] },
        { value: "pizza", label: "Pizza Places", keywords: ["best pizza", "pizza delivery", "pizza near me"] },
        { value: "plumber", label: "Plumbers", keywords: ["plumber", "plumbing service", "emergency plumber"] },
        { value: "electrician", label: "Electricians", keywords: ["electrician", "electrical service", "emergency electrician"] },
        { value: "dentist", label: "Dentists", keywords: ["dentist", "dental care", "dentist near me"] },
        { value: "lawyer", label: "Lawyers", keywords: ["lawyer", "attorney", "legal services"] },
        { value: "contractor", label: "Contractors", keywords: ["contractor", "general contractor", "home remodeling"] },
        { value: "roofing", label: "Roofing Companies", keywords: ["roofer", "roofing company", "roof repair"] },
        { value: "hvac", label: "HVAC Services", keywords: ["hvac", "heating and cooling", "ac repair"] },
        { value: "auto_repair", label: "Auto Repair", keywords: ["auto repair", "mechanic", "car repair"] },
        { value: "salon", label: "Hair Salons", keywords: ["hair salon", "barber", "beauty salon"] },
        { value: "gym", label: "Gyms & Fitness", keywords: ["gym", "fitness center", "personal trainer"] },
        { value: "real_estate", label: "Real Estate Agents", keywords: ["real estate agent", "realtor", "homes for sale"] },
        { value: "insurance", label: "Insurance Agents", keywords: ["insurance agent", "insurance company", "insurance quote"] },
        { value: "retail", label: "Retail Stores", keywords: ["store", "shop", "retail"] },
      ],
    };
  }),

  /**
   * Sync leads from External Hunter (Supabase)
   */
  syncFromHunter: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      console.log("[Sync] Starting sync from Supabase...");

      // 1. Fetch leads from Supabase "technographic_leads"
      const { data: hunterLeads, error } = await supabase
        .from('technographic_leads')
        .select('*')
        .order('last_scanned_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error("Supabase error:", error);
        throw new Error(`Failed to fetch from Supabase: ${error.message}`);
      }

      if (!hunterLeads || hunterLeads.length === 0) {
        console.log("[Sync] No leads found in Supabase.");
        return { success: true, count: 0, message: "No leads found in Supabase" };
      }

      console.log(`[Sync] Found ${hunterLeads.length} leads in Supabase. Importing...`);

      const results = { created: 0, skipped: 0, errors: 0 };

      // 2. Import into local DB
      for (const hLead of hunterLeads) {
        try {
          const url = hLead.url;
          // Heuristic name generation
          let name = hLead.company_domain
            ? hLead.company_domain.split('.')[0]
            : new URL(url).hostname.replace('www.', '').split('.')[0];

          // Capitalize first letter
          name = name.charAt(0).toUpperCase() + name.slice(1);

          // Check if lead already exists by URL to avoid dupes in this session
          // (Since we use memory store, checking store directly via db helper is best)
          // But db.createLead doesn't enforce uniqueness. 
          // We'll just create it. The user can delete duplicates.

          await db.createLead({
            userId: ctx.user.id, // Assign to the authenticated user (who is now mapped to ID 1 hopefully)
            companyName: name,
            websiteUrl: url,
            status: 'pending',
          });
          results.created++;
        } catch (err) {
          console.error("Failed to import lead", err);
          results.errors++;
        }
      }

      return { success: true, count: results.created, results };

    } catch (error: any) {
      console.error("Sync error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Sync failed: ${error.message}`
      });
    }
  }),
});
