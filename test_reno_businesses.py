#!/usr/bin/env python3
"""
Test Technographic Hunter on real Reno businesses
Validates signal detection accuracy
"""

from hunter import TechnographicHunter

# Real Reno businesses from Google Maps
reno_businesses = [
    "homegrownreno.com",           # Homegrown Gastropub
    "flowingtidepub.com",          # Flowing Tide Pub
    "therowhouseno.com",           # The Row House
    "midtowneatery.com",           # Midtown Eats
    "greatbasinbrewingco.com",     # Great Basin Brewing
]

def main():
    hunter = TechnographicHunter()
    
    print("=== Reno Business Validation Test ===\n")
    print("Testing signal detection on 5 real Reno restaurants...\n")
    
    high_value_leads = []
    
    for domain in reno_businesses:
        print(f"[Scanning] {domain}...")
        result = hunter.analyze_target(domain)
        
        print(f"  Status: {result['status']}")
        
        # Show detected signals
        detected_signals = [k for k, v in result['signals'].items() if v]
        if detected_signals:
            print(f"  ✓ Signals: {', '.join(detected_signals)}")
        else:
            print(f"  ✗ No tech signals detected")
        
        # Show pain points (selling opportunities)
        pain_points = [k for k, v in result['pain_points'].items() if v]
        if pain_points:
            print(f"  🎯 Pain Points: {', '.join(pain_points)}")
        else:
            print(f"  ✓ No major issues detected")
        
        # Calculate opportunity score
        pain_count = sum(1 for v in result['pain_points'].values() if v)
        signal_count = sum(1 for v in result['signals'].items() if v)
        opportunity_score = (pain_count * 30) + (signal_count * 10)
        
        print(f"  💰 Opportunity Score: {opportunity_score}/100")
        
        # Flag high-value leads
        if opportunity_score >= 60:
            high_value_leads.append((domain, opportunity_score, pain_points))
            print(f"  ⭐ HIGH VALUE LEAD")
        
        print()
    
    # Summary
    print("\n=== Summary ===")
    print(f"Total scanned: {len(reno_businesses)}")
    print(f"High-value leads (60+ score): {len(high_value_leads)}")
    
    if high_value_leads:
        print("\n🎯 Top Opportunities:")
        for domain, score, pains in sorted(high_value_leads, key=lambda x: x[1], reverse=True):
            print(f"  • {domain} ({score}/100) - {', '.join(pains)}")
    
    print("\n✅ Validation complete. Ready to scale to 1000+ domains.")

if __name__ == "__main__":
    main()
