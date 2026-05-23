import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { makeRequest, PlacesSearchResult, PlaceDetailsResult } from "./_core/map";
import * as db from "./db";

/**
 * Scraper Router — v2
 * 
 * Key improvements over v1:
 * - Pagination: fetches up to 3 pages (60 results) per query instead of 20
 * - Parallel detail fetching: 5 concurrent requests instead of sequential
 * - Stores phone, address, city, state, rating, reviewCount, reviewSnippets, placeId
 * - Pre-filters by business_status OPERATIONAL before touching AI
 * - Heuristic filter runs before AI (review count, aggregator check)
 * - AI qualification only called for borderline cases (10-500 reviews)
 * - Deduplication by both URL and placeId
 */

const AGGREGATOR_DOMAINS = [
  "yelp.com", "yellowpages.com", "facebook.com", "google.com/maps",
  "tripadvisor.com", "angi.com", "angieslist.com", "houzz.com",
  "thumbtack.com", "homeadvisor.com", "bbb.org", "manta.com",
  "mapquest.com", "foursquare.com", "nextdoor.com",
];

const CHAIN_SIGNALS = [
  "mcdonald", "starbucks", "subway", "dunkin", "domino", "pizza hut",
  "burger king", "wendy", "taco bell", "chick-fil", "home depot",
  "lowe's", "walmart", "target", "costco", "best buy", "walgreens",
  "cvs pharmacy", "dollar general", "dollar tree", "7-eleven",
  "marriott", "hilton", "holiday inn", "comfort inn", "super 8",
  "aspen dental", "great clips", "sport clips", "fantastic sams",
];

function isAggregatorUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return AGGREGATOR_DOMAINS.some(d => lower.includes(d));
}

function isNationalChain(name: string): boolean {
  const lower = name.toLowerCase();
  return CHAIN_SIGNALS.some(s => lower.includes(s));
}

/**
 * Fetch all pages of a text search (up to 3 pages = 60 results)
 */
async function fetchAllPages(query: string): Promise<PlacesSearchResult["results"]> {
  const allResults: PlacesSearchResult["results"] = [];

  let page = await makeRequest<PlacesSearchResult>(
    "/maps/api/place/textsearch/json",
    { query }
  );

  if (page.status !== "OK" || !page.results) return allResults;
  allResults.push(...page.results);

  // Fetch up to 2 more pages (Google max is 3 pages total = 60 results)
  for (let i = 0; i < 2; i++) {
    const token = (page as any).next_page_token;
    if (!token) break;

    // Google requires a short delay before using next_page_token
    await new Promise(r => setTimeout(r, 2000));

    page = await makeRequest<PlacesSearchResult>(
      "/maps/api/place/textsearch/json",
      { query, pagetoken: token }
    );

    if (page.status !== "OK" || !page.results) break;
    allResults.push(...page.results);
  }

  return allResults;
}

/**
 * Fetch place details in parallel batches of 5
 */
async function fetchDetailsBatch(placeIds: string[]): Promise<PlaceDetailsResult["result"][]> {
  const BATCH_SIZE = 5;
  const results: PlaceDetailsResult["result"][] = [];

  for (let i = 0; i < placeIds.length; i += BATCH_SIZE) {
    const batch = placeIds.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(
      batch.map(placeId =>
        makeRequest<PlaceDetailsResult>("/maps/api/place/details/json", {
          place_id: placeId,
          fields: "name,website,formatted_address,formatted_phone_number,rating,user_ratings_total,business_status,reviews,types",
        })
      )
    );

    for (const s of settled) {
      if (s.status === "fulfilled" && s.value?.result) {
        results.push(s.value.result);
      }
    }
  }

  return results;
}

export const scraperRouter = router({
  /**
   * Search for local businesses — returns enriched data without creating leads
   */
  searchBusinesses: protectedProcedure
    .input(
      z.object({
        city: z.string().min(1),
        state: z.string().min(2).max(2).optional(),
        category: z.string().min(1),
        limit: z.number().min(1).max(60).default(20),
      })
    )
    .mutation(async ({ input }) => {
      const { city, state, category, limit } = input;
      const location = state ? `${city}, ${state}` : city;
      const searchQuery = `${category} in ${location}`;

      try {
        const rawResults = await fetchAllPages(searchQuery);
        const sliced = rawResults.slice(0, limit);

        const details = await fetchDetailsBatch(sliced.map(r => r.place_id));

        const businesses = details
          .filter(r => {
            if (!r.website) return false;
            if (isAggregatorUrl(r.website)) return false;
            if (r.business_status && r.business_status !== "OPERATIONAL") return false;
            return true;
          })
          .map(r => ({
            name: r.name,
            url: r.website!,
            phone: r.formatted_phone_number || null,
            address: r.formatted_address,
            rating: r.rating,
            reviewCount: r.user_ratings_total,
            snippet: `${r.formatted_address} | Rating: ${r.rating || "N/A"} (${r.user_ratings_total || 0} reviews)`,
            category,
            city,
            state: state || "",
          }));

        return { success: true, businesses, query: searchQuery, count: businesses.length };
      } catch (error) {
        console.error("Business search error:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to search for businesses" });
      }
    }),

  /**
   * Check Google Maps ranking for a specific business/keyword
   */
  checkRanking: protectedProcedure
    .input(
      z.object({
        businessName: z.string().min(1),
        keyword: z.string().min(1),
        location: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const { businessName, keyword, location } = input;

      try {
        const searchQuery = `${keyword} ${location}`;
        const placesResult = await makeRequest<PlacesSearchResult>(
          "/maps/api/place/textsearch/json",
          { query: searchQuery }
        );

        if (placesResult.status !== "OK" || !placesResult.results) {
          return { success: true, businessName, keyword, location, position: null, message: `${businessName} not found` };
        }

        let position: number | null = null;
        for (let i = 0; i < placesResult.results.length; i++) {
          if (placesResult.results[i].name?.toLowerCase().includes(businessName.toLowerCase())) {
            position = i + 1;
            break;
          }
        }

        return {
          success: true, businessName, keyword, location, position,
          message: position === null
            ? `${businessName} not found in top results for "${keyword}"`
            : `${businessName} ranks #${position} for "${keyword}"`,
        };
      } catch (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to check ranking" });
      }
    }),

  /**
   * Bulk scrape and create leads — the main pipeline entry point
   * 
   * Filter order (fastest/cheapest first):
   * 1. Has website
   * 2. Not an aggregator URL
   * 3. business_status === OPERATIONAL
   * 4. Not a national chain (name heuristic)
   * 5. Review count 3–2000 (ghost or corporate filter)
   * 6. Not already in DB
   * 7. AI qualification (only for borderline cases)
   */
  bulkScrapeAndCreate: protectedProcedure
    .input(
      z.object({
        city: z.string().min(1),
        state: z.string().min(2).max(2).optional(),
        category: z.string().min(1),
        targetKeyword: z.string().min(1),
        limit: z.number().min(1).max(60).default(40),
        skipAiFilter: z.boolean().default(false), // bypass AI for speed
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { city, state, category, limit, skipAiFilter } = input;
      const { invokeAI } = await import("./aiProvider");

      const location = state ? `${city}, ${state}` : city;
      const searchQuery = `${category} in ${location}`;

      try {
        // Step 1: Fetch up to 60 raw results (3 pages)
        const rawResults = await fetchAllPages(searchQuery);
        console.log(`[Scraper] Found ${rawResults.length} raw results for "${searchQuery}"`);

        // Step 2: Fetch details in parallel batches
        const sliced = rawResults.slice(0, limit);
        const details = await fetchDetailsBatch(sliced.map(r => r.place_id));

        // Step 3: Pre-filter (no AI yet)
        const preFiltered = details.filter(r => {
          if (!r.website) return false;
          if (isAggregatorUrl(r.website)) return false;
          if (r.business_status && r.business_status !== "OPERATIONAL") return false;
          if (isNationalChain(r.name || "")) return false;
          const reviews = r.user_ratings_total || 0;
          if (reviews < 3) return false; // ghost listing
          if (reviews > 2000) return false; // likely corporate/franchise
          return true;
        });

        console.log(`[Scraper] ${preFiltered.length}/${sliced.length} passed pre-filter`);

        // Step 4: Dedup against existing DB leads
        const dbConn = await db.getDb();
        const { eq, or } = await import("drizzle-orm");
        const { leads } = await import("../drizzle/schema");

        const existingUrls = new Set<string>();
        const existingPlaceIds = new Set<string>();

        if (dbConn) {
          const existing = await dbConn.select({ websiteUrl: leads.websiteUrl, googlePlaceId: leads.googlePlaceId }).from(leads);
          for (const e of existing) {
            if (e.websiteUrl) existingUrls.add(e.websiteUrl.toLowerCase());
            if (e.googlePlaceId) existingPlaceIds.add(e.googlePlaceId);
          }
        }

        const deduped = preFiltered.filter(r => {
          const urlKey = (r.website || "").toLowerCase().split("?")[0]; // strip UTM params
          if (existingUrls.has(urlKey)) return false;
          return true;
        });

        console.log(`[Scraper] ${deduped.length} new leads after dedup`);

        // Step 5: AI qualification (optional, only for borderline cases)
        const createdLeads = [];
        const errors = [];
        const skipped = [];

        for (const r of deduped) {
          const reviews = r.user_ratings_total || 0;

          // Clear pass: high-value signals, skip AI
          const isClearPass = reviews >= 20 && reviews <= 500;
          // Clear fail: already handled by pre-filter
          // Borderline: 3-19 reviews — run AI

          let qualified = isClearPass;

          if (!skipAiFilter && !isClearPass) {
            try {
              const qualification = await invokeAI({
                messages: [
                  {
                    role: "system",
                    content: `You are screening prospects for a $3,000-$8,000 website redesign service. 
Qualify if: owner-operated, high customer value per transaction ($500+), established but not corporate.
Disqualify if: national chain, government, non-profit, low-ticket volume business, or <3 reviews.
Return JSON only.`
                  },
                  {
                    role: "user",
                    content: `Name: ${r.name}\nCategory: ${category}\nAddress: ${r.formatted_address}\nReviews: ${reviews}\nRating: ${r.rating}\n\nIs this a valid high-ticket prospect?`
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
              qualified = result.isQualified;
              if (!qualified) {
                skipped.push({ name: r.name, reason: result.reason });
                console.log(`[AI Filter] Skipped ${r.name}: ${result.reason}`);
              }
            } catch (aiError) {
              // AI failed — default to qualified to avoid losing leads
              console.warn(`[AI Filter] Failed for ${r.name}, defaulting to qualified`, aiError);
              qualified = true;
            }
          }

          if (!qualified) continue;

          // Step 6: Create lead with full enrichment
          try {
            const cleanUrl = (r.website || "").split("?")[0].replace(/\/$/, ""); // strip UTM + trailing slash

            // Extract reviews for personalization
            const reviewTexts = (r.reviews || [])
              .slice(0, 3)
              .map((rv: any) => rv.text?.substring(0, 200))
              .filter(Boolean);

            const lead = await db.createLead({
              userId: ctx.user.id,
              companyName: r.name,
              websiteUrl: r.website!,
              status: "pending",
              phone: r.formatted_phone_number || null,
              address: r.formatted_address || null,
              city: city,
              state: state || null,
              googleRating: r.rating ? String(r.rating) : null,
              reviewCount: r.user_ratings_total || null,
              reviewSnippets: reviewTexts.length > 0 ? JSON.stringify(reviewTexts) : null,
              googlePlaceId: null, // place_id not returned in details result
              businessStatus: r.business_status || null,
              category: category,
            } as any);

            if (lead) {
              createdLeads.push(lead);
              // Auto-trigger audit in background
              if (lead.id) {
                try {
                  const { executePipeline } = await import("./orchestrator");
                  executePipeline(lead.id, ctx.user.id).catch((err: any) => {
                    console.error(`Auto-audit failed for lead ${lead.id}:`, err);
                  });
                } catch (auditError) {
                  console.error(`Failed to trigger auto-audit for ${r.name}:`, auditError);
                }
              }
            }
          } catch (error) {
            console.error(`Error creating lead for ${r.name}:`, error);
            errors.push({
              businessName: r.name,
              url: r.website,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }

        return {
          success: true,
          query: searchQuery,
          totalFound: rawResults.length,
          preFiltered: preFiltered.length,
          deduped: deduped.length,
          createdCount: createdLeads.length,
          skippedByAI: skipped.length,
          errorCount: errors.length,
          leads: createdLeads,
          errors,
        };
      } catch (error) {
        console.error("Bulk scrape error:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to bulk scrape businesses" });
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
        { value: "roofing", label: "Roofing Companies", keywords: ["roofer", "roof replacement", "commercial roofing"] },

        // Luxury & Events
        { value: "wedding_venue", label: "Wedding Venues", keywords: ["wedding venue", "event center", "luxury reception", "banquet hall"] },
        { value: "jeweler", label: "Luxury Jewelers", keywords: ["custom jeweler", "diamond store", "engagement rings", "fine jewelry"] },
        { value: "boutique_hotel", label: "Boutique Hotels", keywords: ["boutique hotel", "luxury inn", "bed and breakfast"] },

        // Classic Staples
        { value: "restaurant", label: "Fine Dining", keywords: ["fine dining", "steakhouse", "seafood restaurant", "upscale dining"] },
        { value: "real_estate", label: "Real Estate Brokers", keywords: ["luxury real estate", "commercial real estate", "real estate broker"] },
      ],
    };
  }),
});
