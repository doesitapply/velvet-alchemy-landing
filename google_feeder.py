#!/usr/bin/env python3
"""
Technographic Hunter - Google Custom Search Feeder
Uses Google CSE API to find Shopify stores (90%+ hit rate vs 7% random scanning)
"""

import os
import sys
from urllib.parse import urlparse

try:
    from googleapiclient.discovery import build
except ImportError:
    print("❌ Error: google-api-python-client not installed")
    print("Run: pip install google-api-python-client")
    sys.exit(1)

# --- CONFIG ---
# Get these from:
# 1. API Key: Google Cloud Console -> APIs & Services -> Credentials
# 2. CX ID: Programmable Search Engine -> Create -> Get CX ID
API_KEY = os.environ.get("GOOGLE_API_KEY", "YOUR_GOOGLE_API_KEY")
CX_ID = os.environ.get("GOOGLE_CX_ID", "YOUR_SEARCH_ENGINE_ID")

# Search queries optimized for Shopify stores
QUERIES = [
    # Reno-specific Shopify stores
    'site:myshopify.com "Reno, NV"',
    '"powered by shopify" "Reno, NV"',
    'site:myshopify.com "Nevada" "contact"',
    
    # E-commerce indicators
    'intitle:"shop" "Reno" "cart"',
    'inurl:collections "Reno" -site:amazon.com',
    
    # Broader Nevada market
    'site:myshopify.com "Nevada" "store"',
    '"powered by shopify" "Nevada" -site:amazon.com',
]
# --------------

def google_search(query, start_index=1):
    """
    Execute a Google Custom Search query
    Returns up to 10 results per call
    """
    service = build("customsearch", "v1", developerKey=API_KEY)
    res = service.cse().list(
        q=query,
        cx=CX_ID,
        start=start_index,
        num=10  # Max allowed per request
    ).execute()
    return res.get('items', [])

def harvest_targets(output_file="targets.txt"):
    """
    Harvest Shopify store URLs from Google Custom Search
    Saves unique base domains to output_file
    """
    unique_urls = set()
    
    print("🚀 Starting Google Search Harvest...")
    print(f"📊 Quota: 100 free queries/day (1,000 results)")
    print(f"🎯 Target: Shopify stores in Reno/Nevada\n")
    
    total_queries = 0
    
    for q in QUERIES:
        print(f"🔎 Query: {q}")
        
        # Fetch 3 pages (30 results) per query to save quota
        for page in range(0, 3):
            start = (page * 10) + 1
            
            try:
                results = google_search(q, start)
                total_queries += 1
                
                if not results:
                    print(f"   ⚠️  No more results for this query")
                    break
                
                for item in results:
                    link = item.get('link')
                    
                    # Clean URL to base domain
                    parsed = urlparse(link)
                    base_url = f"{parsed.scheme}://{parsed.netloc}"
                    
                    # Remove .myshopify.com subdomain if present
                    # (We want the custom domain, not the Shopify subdomain)
                    if '.myshopify.com' in base_url:
                        # Extract just the domain name
                        domain_name = parsed.netloc.split('.myshopify.com')[0]
                        # Try to find custom domain in snippet
                        snippet = item.get('snippet', '')
                        # For now, keep the myshopify.com domain
                        # (Custom domain detection would require visiting the site)
                    
                    if base_url not in unique_urls:
                        unique_urls.add(base_url)
                        print(f"   + Found: {base_url}")
                
                print(f"   ✓ Page {page + 1} complete ({len(results)} results)")
                
            except Exception as e:
                print(f"   ❌ Error: {e}")
                break
        
        print()
    
    # Save to file
    with open(output_file, "w") as f:
        for url in sorted(unique_urls):
            f.write(f"{url}\n")
    
    print(f"\n{'='*60}")
    print(f"✅ Harvest Complete!")
    print(f"📊 Stats:")
    print(f"   - Queries used: {total_queries}/100 daily quota")
    print(f"   - Unique domains found: {len(unique_urls)}")
    print(f"   - Saved to: {output_file}")
    print(f"{'='*60}\n")
    
    print("Next steps:")
    print(f"1. Review {output_file} to verify quality")
    print(f"2. Run: python3 scraper_pipeline.py --input {output_file}")
    print(f"3. Check Supabase for populated data")
    
    return list(unique_urls)

if __name__ == "__main__":
    # Check for API credentials
    if API_KEY == "YOUR_GOOGLE_API_KEY" or CX_ID == "YOUR_SEARCH_ENGINE_ID":
        print("❌ Error: Missing Google API credentials")
        print("\nTo get credentials:")
        print("1. API Key:")
        print("   - Go to: https://console.cloud.google.com/apis/credentials")
        print("   - Create Project → Enable Custom Search API → Create Credentials")
        print("   - Copy API Key")
        print("\n2. Search Engine ID (CX):")
        print("   - Go to: https://programmablesearchengine.google.com/")
        print("   - Create → Search the entire web → Get CX ID")
        print("\n3. Set environment variables:")
        print("   export GOOGLE_API_KEY='your-api-key'")
        print("   export GOOGLE_CX_ID='your-cx-id'")
        print("\nOr edit google_feeder.py and replace the placeholders directly.")
        sys.exit(1)
    
    harvest_targets()
