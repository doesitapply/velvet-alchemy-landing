#!/usr/bin/env python3
"""
Technographic Hunter - Supabase Integration
Scrapes domains and pushes data to Supabase (Async Edition)
"""

import os
import sys
import asyncio
from datetime import datetime
from hunter import TechnographicHunter
from dotenv import load_dotenv

# Load environment variables
load_dotenv(".env.local")

# Check for supabase library
try:
    from supabase import create_client, Client
except ImportError:
    print("❌ Error: supabase library not installed")
    print("Run: pip install supabase")
    sys.exit(1)

class ScraperPipeline:
    def __init__(self):
        # Get Supabase credentials
        supabase_url = os.environ.get("SUPABASE_URL")
        supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        
        print(f"Attempting to connect to Supabase at: {supabase_url}")
        
        try:
            self.supabase: Client = create_client(supabase_url, supabase_key)
            self.hunter = TechnographicHunter(headless=True)
            print("✅ Successfully initialized Supabase client & Async Hunter")
        except Exception as e:
            print(f"❌ Error initializing pipeline: {e}")
            sys.exit(1)
        
        self.supabase: Client = create_client(supabase_url, supabase_key)
        self.hunter = TechnographicHunter()
        
        print("✅ Connected to Supabase")
    
    async def process_domain(self, domain: str) -> bool:
        """
        Scan a single domain and store results (Async)
        """
        print(f"[Scanning] {domain}...")
        
        try:
            # Run the hunter (await the async call)
            data = await self.hunter.analyze_target_async(domain)
            
            if data["status"] != "active":
                print(f"  ⚠️  Skipped {domain}: {data['status']} ({data.get('error_detail', '')})")
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
            
            # Upsert to Supabase
            # Note: supbase-py is synchronous HTTP client, so we run it in a thread if blocking is an issue
            # For 5-10 concurrent tasks, likely fine to run directly or wrap in to_thread
            response = self.supabase.table("technographic_leads").upsert(
                payload,
                on_conflict="url"
            ).execute()
            
            # Log success
            signals = [k for k, v in data["signals"].items() if v]
            pain_points = [k for k, v in data["pain_points"].items() if v]
            
            print(f"  ✅ Saved: {domain}")
            if signals:
                print(f"     Signals: {', '.join(signals)}")
            if pain_points:
                print(f"     Pain: {', '.join(pain_points)}")
            
            return True
            
        except Exception as e:
            print(f"  ❌ Error processing {domain}: {e}")
            return False

    async def scan_batch_async(self, domains: list) -> dict:
        """
        Scan multiple domains concurrently
        """
        stats = {
            "total": len(domains),
            "success": 0,
            "failed": 0
        }
        
        print(f"\n=== Starting batch scan of {len(domains)} domains ===\n")
        
        # Create tasks
        tasks = [self.process_domain(d) for d in domains]
        results = await asyncio.gather(*tasks)
        
        # Tally results
        stats["success"] = sum(1 for r in results if r)
        stats["failed"] = stats["total"] - stats["success"]
        
        print(f"\n=== Scan Complete ===")
        print(f"Total: {stats['total']}")
        print(f"Success: {stats['success']}")
        print(f"Failed: {stats['failed']}")
        
        return stats


async def main_async():
    """
    Main entry point
    """
    # Validation Mix
    test_domains = [
        # --- Known Shopify ---
        "gymshark.com",
        "allbirds.com",
        
        # --- Local Reno ---
        "flowingtidepub.com",
        "renorunningcompany.com",
        "silverandblueoutfitters.com",
        "greatbasincoop.com",
        "renocyclery.com"
    ]
    
    pipeline = ScraperPipeline()
    await pipeline.scan_batch_async(test_domains)

if __name__ == "__main__":
    asyncio.run(main_async())
