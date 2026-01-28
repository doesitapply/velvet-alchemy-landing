#!/usr/bin/env python3
"""
Technographic Hunter - Dry Run Validation
Tests signal detection on 25 domains without Supabase
"""

from hunter import TechnographicHunter

def main():
    """
    Dry run validation - no database needed
    """
    # Validation Mix - 25 domains
    targets = [
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
    
    hunter = TechnographicHunter()
    
    print("=== Technographic Hunter - Validation Run ===")
    print(f"Testing {len(targets)} domains...\n")
    
    results = []
    shopify_count = 0
    high_value_count = 0
    
    for domain in targets:
        print(f"[{len(results)+1}/{len(targets)}] {domain}")
        
        data = hunter.analyze_target(domain)
        
        if data["status"] != "active":
            print(f"  ⚠️  Status: {data['status']}")
            print()
            continue
        
        # Extract key signals
        is_shopify = data["signals"]["shopify"]
        has_pixel = data["signals"]["meta_pixel"]
        has_ga4 = data["signals"]["ga4"]
        ssl_error = data["pain_points"]["ssl_error"]
        neglected = data["pain_points"]["neglected_site"]
        missing_analytics = data["pain_points"]["missing_analytics"]
        
        # Display results
        if is_shopify:
            print(f"  ✅ SHOPIFY DETECTED")
            shopify_count += 1
        else:
            print(f"  ❌ Not Shopify")
        
        # Show other signals
        signals = []
        if has_pixel:
            signals.append("Meta Pixel")
        if has_ga4:
            signals.append("GA4")
        if signals:
            print(f"     Other signals: {', '.join(signals)}")
        
        # Show pain points (selling opportunities)
        pains = []
        if ssl_error:
            pains.append("SSL Error")
        if neglected:
            pains.append("Neglected Site")
        if missing_analytics:
            pains.append("Missing Analytics")
        
        if pains:
            print(f"  🎯 Pain Points: {', '.join(pains)}")
            if is_shopify and missing_analytics:
                print(f"  ⭐ HIGH VALUE LEAD (Shopify + No Analytics)")
                high_value_count += 1
        
        results.append({
            "domain": domain,
            "shopify": is_shopify,
            "high_value": is_shopify and missing_analytics
        })
        
        print()
    
    # Summary Report
    print("\n" + "="*60)
    print("=== VALIDATION SUMMARY ===")
    print("="*60)
    print(f"Total Scanned: {len(results)}")
    print(f"Shopify Detected: {shopify_count}")
    print(f"High-Value Leads: {high_value_count} (Shopify + Missing Analytics)")
    
    # Show all Shopify stores found
    shopify_stores = [r["domain"] for r in results if r["shopify"]]
    if shopify_stores:
        print(f"\n🛍️  Shopify Stores Found:")
        for store in shopify_stores:
            print(f"   • {store}")
    
    # Show high-value leads
    high_value = [r["domain"] for r in results if r["high_value"]]
    if high_value:
        print(f"\n💰 High-Value Leads (Ready to Sell):")
        for lead in high_value:
            print(f"   • {lead}")
    
    # The moment of truth
    silver_and_blue = next((r for r in results if "silverandblue" in r["domain"]), None)
    if silver_and_blue:
        print(f"\n🎯 MOMENT OF TRUTH: silverandblueoutfitters.com")
        if silver_and_blue["shopify"]:
            print(f"   ✅ IS SHOPIFY - Local Reno market is VIABLE!")
        else:
            print(f"   ❌ NOT SHOPIFY - Need to pivot target market")
    
    print("\n✅ Validation complete. Ready for Supabase integration.")


if __name__ == "__main__":
    main()
