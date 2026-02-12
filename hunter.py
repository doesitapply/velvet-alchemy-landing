#!/usr/bin/env python3
"""
Technographic Hunter - Core Detection Script (Playwright Edition)
Detects tech stack signals + pain points (negative signals) for selling opportunities.
Now with 100% more async headless browser magic.
"""

import re
import asyncio
from typing import TypedDict, Optional
from playwright.async_api import async_playwright, Page, Browser

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
    mobile_issue: bool # New: Detect if site is mobile friendly (basic check)

class ScanResult(TypedDict):
    url: str
    status: str
    signals: Signals
    pain_points: PainPoints
    error_detail: str
    screenshot_path: Optional[str]

class TechnographicHunter:
    def __init__(self, headless: bool = True):
        self.headless = headless
        
    async def analyze_target_async(self, url: str) -> ScanResult:
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
                "gtm": False  # Google Tag Manager
            },
            "pain_points": {
                "ssl_error": False,
                "missing_analytics": False,
                "neglected_site": False,
                "mobile_issue": False
            },
            "error_detail": "",
            "screenshot_path": None
        }

        async with async_playwright() as p:
            # Launch browser with stealth-ish configs
            browser = await p.chromium.launch(headless=self.headless)
            context = await browser.new_context(
                viewport={'width': 1280, 'height': 800},
                user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
            )
            
            page = await context.new_page()
            
            try:
                # 1. Navigation & SSL Check
                try:
                    response = await page.goto(url, timeout=15000, wait_until="domcontentloaded")
                    if not response:
                        raise Exception("No response received")
                except Exception as e:
                    if "SSL" in str(e) or "CERT" in str(e):
                        result["pain_points"]["ssl_error"] = True
                        # Try to bypass SSL error for scraping
                        context_insecure = await browser.new_context(ignore_https_errors=True)
                        page = await context_insecure.new_page()
                        await page.goto(url, timeout=15000, wait_until="domcontentloaded")
                    else:
                        raise e

                # 2. Wait a bit for dynamic content (pixels/chats)
                await page.wait_for_timeout(2000)
                
                # 3. Get Content
                content = await page.content()
                content_lower = content.lower()
                
                # 4. Signal Hunting (Regex + DOM checks)
                
                # Check Global Objects (More reliable than regex for some libs)
                js_checks = await page.evaluate("""() => {
                    return {
                        hasShopify: !!window.Shopify,
                        hasFB: !!window.fbq,
                        hasGTM: !!window.google_tag_manager,
                        hasKlaviyo: !!window._learnq,
                        hasStripe: !!window.Stripe
                    }
                }""")
                
                if js_checks['hasShopify'] or 'cdn.shopify.com' in content_lower:
                    result["signals"]["shopify"] = True
                    
                if js_checks['hasKlaviyo'] or 'static.klaviyo.com' in content_lower:
                    result["signals"]["klaviyo"] = True
                    
                if js_checks['hasStripe'] or 'js.stripe.com' in content_lower:
                    result["signals"]["stripe"] = True
                    
                if js_checks['hasFB'] or 'fbevents.js' in content_lower:
                    result["signals"]["meta_pixel"] = True
                    
                if re.search(r'googletagmanager\.com/gtag/js\?id=g-', content_lower) or re.search(r'gtag\(\'config\',\s*\'g-', content_lower):
                    result["signals"]["ga4"] = True
                    
                if js_checks['hasGTM'] or 'googletagmanager.com/gtm.js' in content_lower:
                    result["signals"]["gtm"] = True

                # 5. Pain Point Logic
                
                # Missing Analytics (Shopify stores SHOULD have these)
                if result["signals"]["shopify"] and not (result["signals"]["ga4"] or result["signals"]["gtm"] or result["signals"]["meta_pixel"]):
                    result["pain_points"]["missing_analytics"] = True

                # Neglected Site (Copyright check)
                if "copyright" in content_lower or "©" in content_lower:
                    if "2025" not in content_lower and "2026" not in content_lower:
                        result["pain_points"]["neglected_site"] = True

            except Exception as e:
                # If basic nav fails, we might still have SSL error caught above
                if not result["pain_points"]["ssl_error"]:
                    result["status"] = "error"
                    result["error_detail"] = str(e)
            finally:
                await context.close()
                await browser.close()
                
        return result

async def test_batch_async(domains: list[str]) -> list[ScanResult]:
    hunter = TechnographicHunter(headless=True)
    results = []
    
    print(f"=== Async Hunter Scanning {len(domains)} domains ===")
    
    # Run all scans efficiently
    tasks = [hunter.analyze_target_async(d) for d in domains]
    results = await asyncio.gather(*tasks)
    
    for res in results:
        print(f"\n[Domain] {res['url']}")
        if res['status'] == 'active':
            signals = [k for k, v in res['signals'].items() if v]
            pain = [k for k, v in res['pain_points'].items() if v]
            print(f"  ✅ Signals: {', '.join(signals) if signals else 'None'}")
            print(f"  ⚠️  Pain: {', '.join(pain) if pain else 'None'}")
        else:
            print(f"  ❌ Error: {res['error_detail']}")
            
    return results

if __name__ == "__main__":
    # Quick test
    domains = [
        "gymshark.com", # Should detect Shopify + everything
        "example.com",  # Should be empty
    ]
    asyncio.run(test_batch_async(domains))
