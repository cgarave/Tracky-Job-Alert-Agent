"""onlinejobs.ph scraper using requests + BeautifulSoup (public listings only)."""
import logging
import time
import urllib.parse

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

BASE_URL = "https://www.onlinejobs.ph/jobseekers/job-search/"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Referer": "https://www.onlinejobs.ph/",
}


def scrape(keyword: str, location: str = "Philippines", max_results: int = 10) -> list[dict]:
    """
    Scrape public job listings from onlinejobs.ph.
    Returns a list of normalized job dicts: {title, company, url, source}.
    Note: detailed contact info requires login and is intentionally excluded.
    """
    encoded_kw = urllib.parse.quote(keyword)
    url = f"{BASE_URL}?jobkeyword={encoded_kw}"

    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
    except requests.RequestException as exc:
        logger.error(f"[OnlineJobs] Request failed for '{keyword}': {exc}")
        return []

    soup = BeautifulSoup(resp.text, "lxml")
    results = []

    # Try multiple selector strategies since the site may change markup
    selectors = [
        "div.job-post-item",
        "div.jobpost-full",
        "article.job-listing",
        "div[class*='jobpost']",
    ]
    job_cards = []
    for sel in selectors:
        job_cards = soup.select(sel)
        if job_cards:
            break

    for card in job_cards[:max_results]:
        try:
            # Title link
            title_el = card.select_one("h2 a, h3 a, .job-title a, a[href*='/jobseekers/job/']") 
            if not title_el:
                continue
            title = title_el.get_text(strip=True)
            href = title_el.get("href", "")
            if href.startswith("/"):
                href = f"https://www.onlinejobs.ph{href}"
            if not title or not href:
                continue

            # Company / employer name
            company_el = card.select_one(".employer-name, .company-name, .job-company, span[class*='employer']")
            company = company_el.get_text(strip=True) if company_el else "Unknown"

            results.append(
                {
                    "title": title,
                    "company": company,
                    "url": href,
                    "source": "OnlineJobs.ph",
                }
            )
        except Exception:
            continue

    time.sleep(1)  # Polite crawl delay
    logger.info(f"[OnlineJobs] '{keyword}': {len(results)} results")
    return results
