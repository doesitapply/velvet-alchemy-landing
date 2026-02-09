#!/usr/bin/env python3
"""
Technographic Hunter - Core Detection Script
Detects tech stack signals + pain points (negative signals) for selling opportunities
"""

import requests
from bs4 import BeautifulSoup
import re
import socket
from urllib.parse import urlparse

class TechnographicHunter:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
        }

    def analyze_target(self, url):
        if not url.startswith('http'):
            url = f'https://{url}'
        
        result = {
            "url": url,
            "status": "active",
            "signals": {
                "shopify": False,
                "klaviyo": False,
                "stripe": False,
                "meta_pixel": False,
                "ga4": False,
                "gtm": False  # Google Tag Manager
            },
            "pain_points": {
                "ssl_error": False,
                "missing_analytics": False,
                "neglected_site": False  # Checks for old copyright dates
            }
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
                return result

            html = response.text.lower()
            soup = BeautifulSoup(response.text, 'html.parser')

            # 2. Signal Hunting (Regex is faster than DOM traversal for raw script detection)
            
            # Shopify: Look for the global Shopify object or CDN links
            if 'window.shopify' in html or 'cdn.shopify.com' in html:
                result["signals"]["shopify"] = True

            # Klaviyo: Look for the identifiable tracking script
            if 'static.klaviyo.com' in html or '_learnq' in html:
                result["signals"]["klaviyo"] = True

            # Stripe: Look for the JS library
            if 'js.stripe.com' in html:
                result["signals"]["stripe"] = True

            # Meta Pixel: Look for the events ID or standard loader
            if 'fbevents.js' in html or 'connect.facebook.net' in html:
                result["signals"]["meta_pixel"] = True

            # GA4: Look for the G- ID specifically (Universal Analytics is UA-, which is dead)
            if re.search(r'googletagmanager\.com/gtag/js\?id=g-', html) or re.search(r'gtag\(\'config\',\s*\'g-', html):
                result["signals"]["ga4"] = True
            
            # GTM (Google Tag Manager): The "hidden" analytics wrapper
            if 'googletagmanager.com/gtm.js' in html:
                result["signals"]["gtm"] = True

            # 3. Pain Point Logic
            
            # Missing Analytics: "Flying Blind" = Shopify but NO GA4, NO GTM, NO Pixel
            # This is the REAL money signal - they're losing money on ads
            if result["signals"]["shopify"] and not (result["signals"]["ga4"] or result["signals"]["gtm"] or result["signals"]["meta_pixel"]):
                result["pain_points"]["missing_analytics"] = True

            # Neglected Site: Check footer for old copyright years (e.g., "2023" or older)
            footer_text = soup.get_text()
            # Simple check for copyright followed by a year that ISN'T 2025 or 2026
            if "copyright" in html or "©" in html:
                # If we don't find 2025 or 2026, flag it
                if "2025" not in html and "2026" not in html:
                    result["pain_points"]["neglected_site"] = True

        except Exception as e:
            result["status"] = "error"
            result["error_detail"] = str(e)

        return result


def test_batch(domains):
    """Test hunter on multiple domains and print results"""
    hunter = TechnographicHunter()
    results = []
    
    print("=== Technographic Hunter - Validation Test ===\n")
    
    for domain in domains:
        print(f"[Scanning] {domain}...")
        result = hunter.analyze_target(domain)
        
        print(f"  Status: {result['status']}")
        print(f"  Signals: {', '.join([k for k, v in result['signals'].items() if v])}")
        print(f"  Pain Points: {', '.join([k for k, v in result['pain_points'].items() if v])}")
        
        # Calculate "opportunity score" (more pain points = higher value)
        pain_count = sum(1 for v in result['pain_points'].values() if v)
        signal_count = sum(1 for v in result['signals'].items() if v)
        opportunity_score = (pain_count * 30) + (signal_count * 10)
        
        print(f"  Opportunity Score: {opportunity_score}/100")
        print()
        
        results.append(result)
    
    return results


# Quick Test Block
if __name__ == "__main__":
    # Test on Reno businesses from Google Maps
    test_domains = [
        "flowingtidepub.com",  # Original test case
        "shopify.com",         # Known Shopify (control)
        "stripe.com",          # Known Stripe (control)
        # Add 3-5 Reno businesses here for validation
    ]
    
    test_batch(test_domains)
