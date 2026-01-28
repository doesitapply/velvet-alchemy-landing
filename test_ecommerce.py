#!/usr/bin/env python3
"""
Test Technographic Hunter on known e-commerce stores
Validates that signal detection works correctly
"""

from hunter import TechnographicHunter

# Known e-commerce stores with specific tech stacks
test_stores = [
    # Shopify stores
    ("gymshark.com", ["shopify"]),
    ("allbirds.com", ["shopify"]),
    ("fashionnova.com", ["shopify"]),
    
    # WooCommerce/WordPress stores  
    ("teslamotors.com", ["wordpress"]),  # Tesla uses WordPress
    
    # Stores with Klaviyo
    ("casper.com", ["klaviyo"]),
]

def main():
    hunter = TechnographicHunter()
    
    print("=== E-commerce Signal Validation ===\n")
    print("Testing on known tech stacks to validate detection accuracy...\n")
    
    correct = 0
    total = 0
    
    for domain, expected_signals in test_stores:
        print(f"[Scanning] {domain}")
        print(f"  Expected: {', '.join(expected_signals)}")
        
        result = hunter.analyze_target(domain)
        
        detected = [k for k, v in result['signals'].items() if v]
        print(f"  Detected: {', '.join(detected) if detected else 'None'}")
        
        # Check if we detected what we expected
        matches = [sig for sig in expected_signals if result['signals'].get(sig, False)]
        if matches:
            print(f"  ✓ MATCH: Found {', '.join(matches)}")
            correct += 1
        else:
            print(f"  ✗ MISS: Expected {', '.join(expected_signals)} but got {', '.join(detected)}")
        
        total += 1
        print()
    
    # Accuracy report
    accuracy = (correct / total) * 100 if total > 0 else 0
    print(f"\n=== Accuracy Report ===")
    print(f"Correct detections: {correct}/{total} ({accuracy:.1f}%)")
    
    if accuracy >= 80:
        print("✅ Signal detection is accurate. Ready for production.")
    else:
        print("⚠️  Detection needs tuning. Check regex patterns.")

if __name__ == "__main__":
    main()
