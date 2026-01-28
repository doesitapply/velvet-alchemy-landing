#!/usr/bin/env python3
"""
Technographic Hunter - Tech Stack Scraper
Detects technology signals from website HTML/JS
"""

import re
import ssl
import socket
from typing import Dict, List, Optional
from urllib.parse import urlparse
import requests
from bs4 import BeautifulSoup

class TechSignalDetector:
    """Detects technology stack signals from website content"""
    
    # Tech signal patterns (regex or string matches)
    SIGNALS = {
        'shopify': [
            r'Shopify\.shop',
            r'cdn\.shopify\.com',
            r'myshopify\.com',
            r'shopify-analytics'
        ],
        'stripe': [
            r'js\.stripe\.com',
            r'Stripe\(',
            r'stripe\.com/v3'
        ],
        'klaviyo': [
            r'klaviyo\.com/media/js',
            r'_learnq\.push',
            r'static\.klaviyo\.com'
        ],
        'google_analytics': [
            r'google-analytics\.com/analytics\.js',
            r'gtag\(',
            r'UA-\d+-\d+',
            r'G-[A-Z0-9]+'
        ],
        'facebook_pixel': [
            r'fbq\(',
            r'connect\.facebook\.net/en_US/fbevents\.js',
            r'facebook\.com/tr\?'
        ],
        'openai_api': [
            r'api\.openai\.com',
            r'openai\.com/v1'
        ],
        'wordpress': [
            r'wp-content',
            r'wp-includes',
            r'/wp-json/',
            r'WordPress'
        ],
        'woocommerce': [
            r'woocommerce',
            r'wp-content/plugins/woocommerce'
        ]
    }
    
    def __init__(self, timeout: int = 10):
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
    
    def scrape_domain(self, domain: str) -> Dict:
        """
        Scrape a domain and detect all tech signals
        
        Returns:
            {
                'domain': 'example.com',
                'business_name': 'Example Inc',
                'email': 'contact@example.com',
                'has_shopify': True,
                'has_stripe': False,
                ...
                'detected_technologies': {'shopify': 'detected', 'stripe': 'not_found'},
                'missing_technologies': ['google_analytics', 'facebook_pixel'],
                'signal_strength': 45,
                'has_broken_ssl': False
            }
        """
        
        # Normalize domain
        if not domain.startswith('http'):
            domain = f'https://{domain}'
        
        parsed = urlparse(domain)
        clean_domain = parsed.netloc or parsed.path
        
        result = {
            'domain': clean_domain,
            'business_name': None,
            'email': None,
            'has_broken_ssl': False,
            'detected_technologies': {},
            'missing_technologies': [],
            'signal_strength': 0
        }
        
        # Check SSL
        result['has_broken_ssl'] = self._check_broken_ssl(clean_domain)
        
        # Fetch HTML
        try:
            response = self.session.get(domain, timeout=self.timeout, verify=False)
            html = response.text
            soup = BeautifulSoup(html, 'html.parser')
            
            # Extract business name (from title or meta)
            result['business_name'] = self._extract_business_name(soup)
            
            # Extract email
            result['email'] = self._extract_email(html)
            
            # Detect each tech signal
            for tech_name, patterns in self.SIGNALS.items():
                detected = self._detect_signal(html, patterns)
                result[f'has_{tech_name}'] = detected
                result['detected_technologies'][tech_name] = 'detected' if detected else 'not_found'
            
            # Calculate signal strength (0-100)
            detected_count = sum(1 for v in result['detected_technologies'].values() if v == 'detected')
            result['signal_strength'] = int((detected_count / len(self.SIGNALS)) * 100)
            
            # Identify missing critical technologies
            critical_techs = ['google_analytics', 'facebook_pixel']
            result['missing_technologies'] = [
                tech for tech in critical_techs 
                if result['detected_technologies'].get(tech) == 'not_found'
            ]
            
        except Exception as e:
            print(f"[Error] Failed to scrape {domain}: {e}")
            result['error'] = str(e)
        
        return result
    
    def _detect_signal(self, html: str, patterns: List[str]) -> bool:
        """Check if any pattern matches in HTML"""
        for pattern in patterns:
            if re.search(pattern, html, re.IGNORECASE):
                return True
        return False
    
    def _check_broken_ssl(self, domain: str) -> bool:
        """Check if SSL certificate is broken or expired"""
        try:
            context = ssl.create_default_context()
            with socket.create_connection((domain, 443), timeout=5) as sock:
                with context.wrap_socket(sock, server_hostname=domain) as ssock:
                    cert = ssock.getpeercert()
                    return False  # SSL is valid
        except Exception:
            return True  # SSL is broken
    
    def _extract_business_name(self, soup: BeautifulSoup) -> Optional[str]:
        """Extract business name from title or meta tags"""
        # Try title tag
        title = soup.find('title')
        if title:
            return title.get_text().strip()[:255]
        
        # Try og:site_name
        og_name = soup.find('meta', property='og:site_name')
        if og_name:
            return og_name.get('content', '').strip()[:255]
        
        return None
    
    def _extract_email(self, html: str) -> Optional[str]:
        """Extract email from HTML"""
        email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
        emails = re.findall(email_pattern, html)
        
        # Filter out common noise emails
        noise = ['example.com', 'test.com', 'domain.com', 'yoursite.com']
        valid_emails = [e for e in emails if not any(n in e for n in noise)]
        
        return valid_emails[0] if valid_emails else None


def scrape_domains_batch(domains: List[str]) -> List[Dict]:
    """Scrape multiple domains and return results"""
    detector = TechSignalDetector()
    results = []
    
    for domain in domains:
        print(f"[Scraping] {domain}...")
        result = detector.scrape_domain(domain)
        results.append(result)
        print(f"[Result] {domain}: {result['signal_strength']}/100 signals detected")
    
    return results


if __name__ == '__main__':
    # Test with sample domains
    test_domains = [
        'shopify.com',
        'stripe.com',
        'example.com'
    ]
    
    print("=== Technographic Hunter - Test Run ===\n")
    results = scrape_domains_batch(test_domains)
    
    print("\n=== Summary ===")
    for r in results:
        print(f"\n{r['domain']}:")
        print(f"  Business: {r['business_name']}")
        print(f"  Email: {r['email']}")
        print(f"  Signal Strength: {r['signal_strength']}/100")
        print(f"  Technologies: {', '.join([k for k, v in r['detected_technologies'].items() if v == 'detected'])}")
        print(f"  Missing: {', '.join(r['missing_technologies'])}")
        print(f"  Broken SSL: {r['has_broken_ssl']}")
