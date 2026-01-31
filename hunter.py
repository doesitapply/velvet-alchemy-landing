#!/usr/bin/env python3
"""
Technographic Hunter - Core Detection Script
Detects tech stack signals + pain points (negative signals) for selling opportunities
"""

import requests
import re
import json
import argparse
from typing import TypedDict

class Signals(TypedDict):
    shopify: bool
    klaviyo: bool
    stripe: bool
    meta_pixel: bool
    ga4: bool
    gtm: bool

class PainPoints(TypedDict):
    ssl_error: bool
    missing_analytics: bool
    neglected_site: bool

class ScanResult(TypedDict):
    url: str
    status: str
    signals: Signals
    pain_points: PainPoints
    error_detail: str

class TechnographicHunter:
    def __init__(self) -> None:
        self.headers: dict[str, str] = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
        }

    def analyze_target(self, url: str) -> ScanResult:
        if not url.startswith('http'):
            url = f'https://{url}'
        
        result: ScanResult = {
            "url": url,
            "status": "active",
            "signals": {
                "shopify": False,
                "klaviyo": False,
                "stripe": False,
                "meta_pixel": False,
                "ga4": False,
                "gtm": False
            },
            "pain_points": {
                "ssl_error": False,
                "missing_analytics": False,
                "neglected_site": False
            },
            "error_detail": ""
        }

        try:
            # 1. SSL/Connection Check
            try:
                response = requests.get(url, headers=self.headers, timeout=5)
            except requests.exceptions.SSLError:
                result["pain_points"]["ssl_error"] = True
                # Try again without verify to get the HTML content anyway
                response = requests.get(url, headers=self.headers, verify=False, timeout=5)
            except Exception as e:
                result["status"] = "dead"
                result["error_detail"] = str(e)
                return result

            html = response.text.lower()

            # 2. Signal Hunting
            
            if 'window.shopify' in html or 'cdn.shopify.com' in html:
                result["signals"]["shopify"] = True

            if 'static.klaviyo.com' in html or '_learnq' in html:
                result["signals"]["klaviyo"] = True

            if 'js.stripe.com' in html:
                result["signals"]["stripe"] = True

            if 'fbevents.js' in html or 'connect.facebook.net' in html:
                result["signals"]["meta_pixel"] = True

            if re.search(r'googletagmanager\.com/gtag/js\?id=g-', html) or re.search(r'gtag\(\'config\',\s*\'g-', html):
                result["signals"]["ga4"] = True
            
            if 'googletagmanager.com/gtm.js' in html:
                result["signals"]["gtm"] = True

            # 3. Pain Point Logic
            if result["signals"]["shopify"] and not (result["signals"]["ga4"] or result["signals"]["gtm"] or result["signals"]["meta_pixel"]):
                result["pain_points"]["missing_analytics"] = True

            if "copyright" in html or "©" in html:
                if "2025" not in html and "2026" not in html:
                    result["pain_points"]["neglected_site"] = True

        except Exception as e:
            result["status"] = "error"
            result["error_detail"] = str(e)

        return result


def test_batch(domains: list[str], quiet: bool = False) -> list[ScanResult]:
    """Test hunter on multiple domains and print results"""
    hunter = TechnographicHunter()
    results: list[ScanResult] = []
    
    if not quiet:
        print("=== Technographic Hunter ===\n")
    
    for domain in domains:
        if not quiet:
            print(f"[Scanning] {domain}...")
        result = hunter.analyze_target(domain)
        
        if not quiet:
            print(f"  Status: {result['status']}")
            print(f"  Signals: {', '.join([k for k, v in result['signals'].items() if v])}")
            print(f"  Pain Points: {', '.join([k for k, v in result['pain_points'].items() if v])}")
            
            pain_count = sum(1 for v in result['pain_points'].values() if v)
            signal_count = sum(1 for v in result['signals'].values() if v)
            opportunity_score = (pain_count * 30) + (signal_count * 10)
            
            print(f"  Opportunity Score: {opportunity_score}/100")
            print()
        
        results.append(result)
    
    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", action="store_true", help="Output results as JSON")
    parser.add_argument("domains", nargs="*", help="Domains to scan")
    args = parser.parse_args()
    
    test_domains = args.domains if args.domains else [
        "flowingtidepub.com",
        "renorunningcompany.com",
        "silverandblueoutfitters.com",
        "pantryproducts.com",
        "greatbasincoop.com",
        "renocyclery.com"
    ]
    
    results = test_batch(test_domains, quiet=args.json)
    
    if args.json:
        print(json.dumps(results))
