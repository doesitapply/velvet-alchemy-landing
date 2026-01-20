import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
// Note: Using Manus search API via fetch since SDK doesn't export search function
import * as db from "./db";

/**
 * Scraper Router
 * Handles Google Maps scraping, ranking checks, and bulk business discovery
 */

export const scraperRouter = router({
  /**
   * Search for local businesses using Google Search
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
        // Use Manus search API to find businesses
        // Use Manus search API to find businesses
        // For now, return empty array - will implement proper search integration
        const searchResults: any[] = [];
        
        // TODO: Implement search API call

        // Extract business info from search results
        const businesses = [];
        for (const result of searchResults.slice(0, limit)) {
          // Extract domain from URL
          const url = result.url || result.link;
          if (!url) continue;

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
            name: result.title || "Unknown Business",
            url: url,
            snippet: result.snippet || result.description || "",
            category: category,
            city: city,
            state: state || "",
          });
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
   * Check Google ranking for a specific business/keyword
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
        // Search Google for the keyword + location
        const searchQuery = `${keyword} ${location}`;
        // Use Manus search API to find businesses
        // For now, return empty array - will implement proper search integration
        const searchResults: any[] = [];
        
        // TODO: Implement search API call

        // Find the business in search results
        let position = null;
        for (let i = 0; i < searchResults.length; i++) {
          const result = searchResults[i];
          const title = result.title || "";
          const url = result.url || result.link || "";

          // Check if this result matches the business
          if (
            title.toLowerCase().includes(businessName.toLowerCase()) ||
            url.toLowerCase().includes(businessName.toLowerCase().replace(/\s+/g, ""))
          ) {
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

      try {
        // Step 1: Search for businesses
        const location = state ? `${city}, ${state}` : city;
        const searchQuery = `${category} in ${location}`;

        // Use Manus search API to find businesses
        // For now, return empty array - will implement proper search integration
        const searchResults: any[] = [];
        
        // TODO: Implement search API call

        // Step 2: Filter and process businesses
        const createdLeads = [];
        const errors = [];

        for (const result of searchResults.slice(0, limit)) {
          const url = result.url || result.link;
          if (!url) continue;

          // Skip aggregator sites
          if (
            url.includes("yelp.com") ||
            url.includes("yellowpages.com") ||
            url.includes("facebook.com") ||
            url.includes("google.com/maps")
          ) {
            continue;
          }

          const businessName = result.title || "Unknown Business";

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
          totalFound: searchResults.length,
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
});
