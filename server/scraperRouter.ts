import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { makeRequest, PlacesSearchResult, PlaceDetailsResult } from "./_core/map";
import * as db from "./db";

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

        for (const place of placesResult.results.slice(0, limit)) {
          let url: string | undefined;
          let businessName: string;

          try {
            // Fetch place details to get website URL
            const details = await makeRequest<PlaceDetailsResult>(
              "/maps/api/place/details/json",
              {
                place_id: place.place_id,
                fields: "name,website,formatted_address"
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
              url.includes("google.com/maps")
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
                    content: \`You are "The Gatekeeper" for an elite agency selling $5,000 - $10,000 website overhauls. Your ONLY job is to find businesses with MONEY and POOR DIGITAL MANNERS.

                            CRITICAL QUALIFICATION RULES (Pass = TRUE):
                            1. **High Customer Value**: One new customer must be worth $500+ to them (e.g., Med Spas, Lawyers, HVAC, Luxury Builders).
                            2. **Owner-Operated Vibe**: Looks like a business where I can talk to the owner, not a corporate board (e.g., "Dr. Smith's Clinic" > "Aspen Dental").
                            3. **Established but Not Corporate**: 10-200 reviews is the sweet spot. <10 is reckless, >500 is usually corporate/unchangeable.
                            4. **High-End Signals**: Names containing "Institute", "Center", "Group", "Associates", "Luxury", "Boutique", "Custom", "Design".

                            IMMEDIATE DISQUALIFICATION (Pass = FALSE):
                            1. **Low Ticket / Volume**: Fast food, coffee shops, convenience stores, cheap retail, dollar stores.
                            2. **National Chains**: Starbucks, McDonald's, Home Depot, Walmart, large hotel chains.
                            3. **Public/Government**: Schools, libraries, post offices, DMVs, city halls.
                            4. **No Revenue**: Hobby shops, non-profits (unless large), ATMs, kiosks.

                            Your analysis must be ruthless. If they sell $5 lattes, REJECT. If they sell $10,000 facelifts, ACCEPT.
                            
                            Return a JSON object.\`
                  },
                  {
                    role: "user",
                    content: \`Qualify this business:
                            Name: \${businessName}
                            Category: \${category}
                            Address: \${details.result.formatted_address}
                            Reviews: \${reviewCount}
                            
                            Is this a valid high-ticket prospect?\`
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
                console.log(\`[Smart Filter] Skipped \${businessName}: \${result.reason}\`);
                continue;
              }
            } catch (aiError) {
              console.warn(\`[Smart Filter] AI failed for \${businessName}, proceeding cautiously.\`, aiError);
            }

            // === END SMART FILTERING ===

          } catch (error) {
            console.error(`Failed to fetch details for ${ place.name }: `, error);
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
              console.log(`Lead already exists: ${ businessName }`);
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
                  console.error(`Auto - audit failed for lead ${ lead.id }: `, err);
                });
              } catch (auditError) {
                console.error(`Failed to trigger auto - audit for ${ businessName }: `, auditError);
              }
            }
          } catch (error) {
            console.error(`Error creating lead for ${ businessName }: `, error);
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
        // Medical Aesthetics (High Ticket)
        { value: "med_spa", label: "Med Spas", keywords: ["med spa", "medical spa", "botox clinic", "coolsculpting"] },
        { value: "plastic_surgeon", label: "Plastic Surgeons", keywords: ["plastic surgeon", "cosmetic surgery", "breast augmentation"] },
        { value: "dermatologist", label: "Dermatologists", keywords: ["dermatologist", "skin clinic", "laser treatment"] },
        { value: "cosmetic_dentist", label: "Cosmetic Dentists", keywords: ["cosmetic dentist", "veneers", "dental implants", "invisalign"] },

        // Legal (High Ticket)
        { value: "injury_lawyer", label: "Personal Injury Lawyers", keywords: ["personal injury lawyer", "accident attorney", "injury law firm"] },
        { value: "criminal_lawyer", label: "Criminal Defense", keywords: ["criminal defense attorney", "DUI lawyer", "defense firm"] },
        { value: "divorce_lawyer", label: "Family Law", keywords: ["divorce lawyer", "family law attorney", "custody lawyer"] },
        
        // Home Services (Big Ticket)
        { value: "hvac", label: "HVAC Services", keywords: ["hvac replacement", "ac installation", "furnace repair"] },
        { value: "solar", label: "Solar Installers", keywords: ["solar panel installer", "solar energy company", "commercial solar"] },
        { value: "pool_builder", label: "Pool Builders", keywords: ["custom pool builder", "swimming pool installation", "pool contractor"] },
        { value: "custom_home", label: "Custom Home Builders", keywords: ["custom home builder", "luxury home builder", "general contractor"] },
        { value: "landscaper", label: "Landscape Design", keywords: ["landscape architect", "luxury landscaping", "hardscape design"] },
        { value: "kitchen_remodel", label: "Kitchen Remodelers", keywords: ["kitchen remodeling", "bathroom remodeling", "cabinet maker"] },

        // Luxury & Events
        { value: "wedding_venue", label: "Wedding Venues", keywords: ["wedding venue", "event center", "luxury reception", "banquet hall"] },
        { value: "jeweler", label: "Luxury Jewelers", keywords: ["custom jeweler", "diamond store", "engagement rings", "fine jewelry"] },
        { value: "boutique_hotel", label: "Boutique Hotels", keywords: ["boutique hotel", "luxury inn", "bed and breakfast"] },
        
        // Classic Staples (Still good)
        { value: "restaurant", label: "Fine Dining", keywords: ["fine dining", "steakhouse", "seafood restaurant", "upscale dining"] },
        { value: "roofing", label: "Roofing Companies", keywords: ["roofer", "roof replacement", "commercial roofing"] },
        { value: "real_estate", label: "Real Estate Brokers", keywords: ["luxury real estate", "commercial real estate", "real estate broker"] },
      ],
    };
  }),

  /**
   * Sync leads from External Hunter (Supabase)
   */
  syncFromHunter: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      const { syncHunterLeads } = await import("./lib/hunterSync");
      return await syncHunterLeads(ctx.user.id);
    } catch (error: any) {
      // Wrap error for tRPC
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message
      });
    }
  }),
});
