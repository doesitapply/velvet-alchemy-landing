import { callDataApi } from "./_core/dataApi";

interface TrafficData {
  monthlyVisits: number | null;
  globalRank: number | null;
  bounceRate: number | null;
}

/**
 * Fetch traffic data from SimilarWeb API
 * Returns estimated monthly visitors, global rank, and bounce rate
 */
export async function fetchTrafficData(domain: string): Promise<TrafficData> {
  const result: TrafficData = {
    monthlyVisits: null,
    globalRank: null,
    bounceRate: null,
  };

  try {
    // Extract domain from URL if full URL is provided
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

    // Fetch monthly visits
    try {
      const visitsData = await callDataApi("Similarweb/get_visits_total", {
        pathParams: { domain: cleanDomain },
        query: {
          country: "world",
          granularity: "monthly",
          main_domain_only: false,
        },
      });

      if (visitsData && (visitsData as any).visits && (visitsData as any).visits.length > 0) {
        // Get most recent month's data
        const latestMonth = (visitsData as any).visits[(visitsData as any).visits.length - 1];
        result.monthlyVisits = latestMonth.visits || null;
      }
    } catch (error) {
      console.warn(`[TrafficService] Failed to fetch visits for ${cleanDomain}:`, error);
    }

    // Fetch global rank
    try {
      const rankData = await callDataApi("Similarweb/get_global_rank", {
        pathParams: { domain: cleanDomain },
        query: {
          main_domain_only: false,
        },
      });

      if (rankData && (rankData as any).global_rank && (rankData as any).global_rank.length > 0) {
        // Get most recent month's rank
        const latestRank = (rankData as any).global_rank[(rankData as any).global_rank.length - 1];
        result.globalRank = latestRank.rank || null;
      }
    } catch (error) {
      console.warn(`[TrafficService] Failed to fetch rank for ${cleanDomain}:`, error);
    }

    // Fetch bounce rate
    try {
      const bounceData = await callDataApi("Similarweb/get_bounce_rate", {
        pathParams: { domain: cleanDomain },
        query: {
          country: "world",
          granularity: "monthly",
          main_domain_only: false,
        },
      });

      if (bounceData && (bounceData as any).bounce_rate && (bounceData as any).bounce_rate.length > 0) {
        // Get most recent month's bounce rate
        const latestBounce = (bounceData as any).bounce_rate[(bounceData as any).bounce_rate.length - 1];
        result.bounceRate = latestBounce.bounce_rate ? parseFloat((latestBounce.bounce_rate * 100).toFixed(2)) : null;
      }
    } catch (error) {
      console.warn(`[TrafficService] Failed to fetch bounce rate for ${cleanDomain}:`, error);
    }

    return result;
  } catch (error) {
    console.error(`[TrafficService] Error fetching traffic data for ${domain}:`, error);
    return result;
  }
}

/**
 * Calculate priority score based on traffic and website quality
 * High traffic + bad website = HIGH priority (easy sale)
 * Low traffic + bad website = LOW priority (not worth effort)
 * 
 * Formula: (traffic_score * 0.6) + (prestige_score * 0.4)
 * - Traffic score: Based on monthly visits and global rank
 * - Prestige score: Existing audit score (0-100, higher = worse site)
 */
export function calculatePriorityScore(
  monthlyVisits: number | null,
  globalRank: number | null,
  prestigeScore: number | null
): number {
  let trafficScore = 0;
  
  // Score based on monthly visits (0-50 points)
  if (monthlyVisits !== null) {
    if (monthlyVisits > 1000000) trafficScore += 50; // 1M+ visits
    else if (monthlyVisits > 500000) trafficScore += 40; // 500k+ visits
    else if (monthlyVisits > 100000) trafficScore += 30; // 100k+ visits
    else if (monthlyVisits > 50000) trafficScore += 20; // 50k+ visits
    else if (monthlyVisits > 10000) trafficScore += 10; // 10k+ visits
  }

  // Score based on global rank (0-50 points, lower rank = better)
  if (globalRank !== null) {
    if (globalRank < 10000) trafficScore += 50; // Top 10k sites
    else if (globalRank < 50000) trafficScore += 40; // Top 50k sites
    else if (globalRank < 100000) trafficScore += 30; // Top 100k sites
    else if (globalRank < 500000) trafficScore += 20; // Top 500k sites
    else if (globalRank < 1000000) trafficScore += 10; // Top 1M sites
  }

  // Normalize traffic score to 0-100
  trafficScore = Math.min(100, trafficScore);

  // Combine with prestige score (weighted average)
  if (prestigeScore !== null) {
    return Math.round((trafficScore * 0.6) + (prestigeScore * 0.4));
  }

  return Math.round(trafficScore);
}
