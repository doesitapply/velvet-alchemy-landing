#!/usr/bin/env python3
"""
Technographic Hunter - Supabase Integration
Scrapes domains and pushes data to Supabase
"""

import os
import sys
from datetime import datetime
from hunter import TechnographicHunter

# Check for supabase library
try:
    from supabase import create_client, Client
except ImportError:
    print("❌ Error: supabase library not installed")
    print("Run: pip install supabase")
    sys.exit(1)

class ScraperPipeline:
    def __init__(self):
        # Get Supabase credentials from environment
        supabase_url = os.environ.get("SUPABASE_URL")
        supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        
        if not supabase_url or not supabase_key:
            print("❌ Error: Missing Supabase credentials")
            print("Set environment variables:")
            print("  export SUPABASE_URL='your-project-url'")
            print("  export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'")
            sys.exit(1)
        
        self.supabase: Client = create_client(supabase_url, supabase_key)
        self.hunter = TechnographicHunter()
        
        print("✅ Connected to Supabase")
    
    def scan_and_store(self, domain: str) -> bool:
        """
        Scan a domain and store results in Supabase
        Returns True if successful, False otherwise
        """
        print(f"[Scanning] {domain}...")
        
        try:
            # Run the hunter
            data = self.hunter.analyze_target(domain)
            
            if data["status"] != "active":
                print(f"  ⚠️  Skipped: {data['status']}")
                return False
            
            # Prepare payload for Supabase
            payload = {
                "url": data["url"],
                "detected_cms": "shopify" if data["signals"]["shopify"] else "other",
                "has_pixel": data["signals"]["meta_pixel"],
                "has_ga4": data["signals"]["ga4"],
                "ssl_error": data["pain_points"]["ssl_error"],
                "neglected": data["pain_points"]["neglected_site"],
                "last_scanned_at": datetime.utcnow().isoformat()
            }
            
            # Upsert to Supabase (insert if new, update if exists)
            response = self.supabase.table("technographic_leads").upsert(
                payload,
                on_conflict="url"
            ).execute()
            
            # Log what we found
            signals = [k for k, v in data["signals"].items() if v]
            pain_points = [k for k, v in data["pain_points"].items() if v]
            
            print(f"  ✅ Saved: {domain}")
            if signals:
                print(f"     Signals: {', '.join(signals)}")
            if pain_points:
                print(f"     Pain Points: {', '.join(pain_points)}")
            
            return True
            
        except Exception as e:
            print(f"  ❌ Error: {e}")
            return False
    
    def scan_batch(self, domains: list) -> dict:
        """
        Scan multiple domains and return stats
        """
        stats = {
            "total": len(domains),
            "success": 0,
            "failed": 0,
            "shopify_found": 0,
            "high_value": 0  # Shopify + missing analytics
        }
        
        print(f"\n=== Starting batch scan of {len(domains)} domains ===\n")
        
        for domain in domains:
            if self.scan_and_store(domain):
                stats["success"] += 1
                
                # Check if this was a high-value lead
                # (We'd need to query back, but for now just count successes)
            else:
                stats["failed"] += 1
        
        print(f"\n=== Scan Complete ===")
        print(f"Total: {stats['total']}")
        print(f"Success: {stats['success']}")
        print(f"Failed: {stats['failed']}")
        
        return stats


def main():
    """
    Main entry point for the scraper pipeline
    """
    # Validation Mix - 25 domains
    test_domains = [
        # --- Known Shopify (Should be TRUE) ---
        "gymshark.com",
        "allbirds.com",
        "kyliecosmetics.com",
        "colourpop.com",
        "fashionnova.com",
        "redbullshop.com",
        
        # --- The Control Group (Should be FALSE for Shopify) ---
        "wikipedia.org",
        "stripe.com",       # Should be TRUE for Stripe, FALSE for Shopify
        "example.com",
        "craigslist.org",
        
        # --- Local Reno Candidates (The "Wild West") ---
        "flowingtidepub.com",           # Your test case
        "renorunningcompany.com",       # Likely local retail
        "silverandblueoutfitters.com",  # UNR Gear (High probability of e-commerce)
        "greatbasincoop.com",
        "renocyclery.com",
        "pantryproducts.com",           # Local skincare
        "sierranevada.com",             # Big local brewery
        "peppermillreno.com",           # Casino (Likely custom tech)
        "washoecounty.gov",             # Gov (Should be FALSE/Neglected)
        "naturalpawsreno.com",
        "renosparkscheer.com",
        "moananeedlery.com",
        "buyinreno.com",
        "visithartley.com"
    ]
    
    pipeline = ScraperPipeline()
    stats = pipeline.scan_batch(test_domains)
    
    print(f"\n✅ Pipeline complete. {stats['success']} domains stored in Supabase.")
    print("\nNext steps:")
    print("1. Check your Supabase dashboard to verify data")
    print("2. Run with your full domain list (50+ domains)")
    print("3. Build the API endpoint to serve this data")


if __name__ == "__main__":
    main()
