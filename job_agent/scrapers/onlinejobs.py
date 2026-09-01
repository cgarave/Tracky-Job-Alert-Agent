"""onlinejobs.ph scraper using requests + BeautifulSoup with Playwright fallback and robust description extraction."""
import logging
import re
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

BASE_URL = "https://www.onlinejobs.ph/jobseekers/jobsearch"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "max-age=0",
    "Upgrade-Insecure-Requests": "1",
}


def _fetch_full_page_desc(job_url: str) -> str:
    """Fetch full job post page if snippet is too short."""
    try:
        resp = requests.get(job_url, headers=HEADERS, timeout=8)
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.text, "lxml")
            desc_el = soup.select_one(".job-description, .jobpost-full, div[class*='job-desc'], .desc, #job-description, div.card-body")
            if desc_el:
                for bad in desc_el.select("script, style, a.badge"):
                    bad.decompose()
                return desc_el.get_text(separator="\n", strip=True)
    except Exception:
        pass
    return ""


def _parse_html(html_content: str, max_results: int) -> list[dict]:
    """Parse HTML text into normalized job dicts with clean descriptions."""
    soup = BeautifulSoup(html_content, "lxml")
    results = []
    cards = soup.select(".jobpost-cat-box, div.job-post-item, div[class*='jobpost']")

    for card in cards:
        if len(results) >= max_results:
            break
        try:
            link_el = card.select_one("a[href*='/jobseekers/job/']")
            if not link_el:
                continue

            href = link_el.get("href", "")
            if href.startswith("/"):
                href = f"https://www.onlinejobs.ph{href}"

            h_el = card.select_one("h4, h3, h2, .job-title")
            raw_title = h_el.get_text(strip=True) if h_el else link_el.get_text(strip=True)

            # Strip trailing employment type tags from title (e.g. 'Full Time', 'Part Time', 'Gig')
            clean_title = re.sub(
                r"(Full Time|Part Time|Gig|Any|Freelance)$",
                "",
                raw_title,
                flags=re.IGNORECASE,
            ).strip()
            if not clean_title:
                clean_title = raw_title

            # Description extraction: isolate div.desc and remove 'See More' links
            desc_text = ""
            desc_el = card.select_one("div.desc, .desc, .job-description, div[class*='job-desc']")
            if desc_el:
                # Remove inner link anchors
                for a_tag in desc_el.select("a"):
                    a_tag.decompose()
                desc_text = desc_el.get_text(separator="\n", strip=True)

            # Salary parsing
            card_text = card.get_text(separator=" ", strip=True)
            salary_match = re.search(
                r"(\$[\d,]+(?:\s*-\s*\$[\d,]+)?(?:\s*/\s*mo|\s*a month|\s*/\s*hr|\s*/\s*h)?|₱[\d,]+(?:\s*-\s*₱[\d,]+)?|TBD|Negotiable)",
                card_text,
                re.IGNORECASE,
            )
            salary = salary_match.group(1).strip() if salary_match else "Negotiable"

            results.append(
                {
                    "title": clean_title,
                    "company": "OnlineJobs Employer",
                    "url": href,
                    "source": "OnlineJobs.ph",
                    "location": "Remote / Philippines",
                    "salary": salary,
                    "apply_type": "Direct Message",
                    "description": desc_text,
                }
            )
        except Exception:
            continue

    return results


def scrape(keyword: str, location: str = "Philippines", max_results: int = 10) -> list[dict]:
    """
    Scrape public job listings from onlinejobs.ph with rich description extraction.
    Returns normalized job dicts: {title, company, url, source, location, salary, apply_type, description}.
    """
    encoded_kw = urllib.parse.quote(keyword)
    url = f"{BASE_URL}?jobkeyword={encoded_kw}"
    results = []

    # 1. Try requests with full browser headers
    try:
        resp = requests.get(url, headers=HEADERS, allow_redirects=True, timeout=15)
        if resp.status_code == 200 and "/error" not in resp.url:
            results = _parse_html(resp.text, max_results)
            if results:
                logger.info(f"[OnlineJobs] '{keyword}': {len(results)} results (via HTTP)")
    except Exception as exc:
        logger.warning(f"[OnlineJobs] HTTP request failed for '{keyword}': {exc}")

    # 2. Fallback to Playwright headless browser if HTTP returned nothing
    if not results:
        try:
            logger.info(f"[OnlineJobs] Trying Playwright fallback for '{keyword}'...")
            from playwright.sync_api import sync_playwright

            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                page = browser.new_page(user_agent=HEADERS["User-Agent"])
                page.goto(url, wait_until="domcontentloaded", timeout=20000)
                page.wait_for_selector(".jobpost-cat-box, a[href*='/jobseekers/job/']", timeout=10000)
                html_content = page.content()
                browser.close()

                results = _parse_html(html_content, max_results)
                logger.info(f"[OnlineJobs] '{keyword}': {len(results)} results (via Playwright)")
        except Exception as exc:
            logger.error(f"[OnlineJobs] Playwright fallback failed for '{keyword}': {exc}")

    # 3. Enrich any jobs that have short descriptions
    def _enrich_desc(job: dict) -> None:
        if not job.get("description") or len(job["description"]) < 60:
            full_desc = _fetch_full_page_desc(job["url"])
            if full_desc:
                job["description"] = full_desc

    if results:
        with ThreadPoolExecutor(max_workers=4) as executor:
            executor.map(_enrich_desc, results)

    return results[:max_results]
