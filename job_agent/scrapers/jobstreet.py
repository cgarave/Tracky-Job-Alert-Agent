"""jobstreet.com.ph scraper using Playwright (headless Chromium)."""
import logging
import urllib.parse

logger = logging.getLogger(__name__)

BASE_URL = "https://www.jobstreet.com.ph/jobs"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)


def scrape(keyword: str, location: str = "Philippines", max_results: int = 10) -> list[dict]:
    """
    Scrape jobstreet.com.ph for the given keyword using Playwright.
    Returns a list of normalized job dicts: {title, company, url, source}.
    """
    try:
        from playwright.sync_api import sync_playwright  # type: ignore
    except ImportError:
        logger.error("Playwright is not installed. Run: pip3 install playwright && playwright install chromium")
        return []

    encoded_kw = urllib.parse.quote(keyword)
    url = f"{BASE_URL}?q={encoded_kw}"

    results = []
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)
            ctx = browser.new_context(user_agent=USER_AGENT)
            page = ctx.new_page()

            page.goto(url, wait_until="networkidle", timeout=30_000)
            page.wait_for_timeout(2_000)  # Let JS hydrate

            # JobStreet uses data-automation attributes on job card titles
            title_links = page.query_selector_all('[data-automation="job-card-title"] a, [data-automation="jobTitle"] a')

            for link in title_links[:max_results]:
                try:
                    title = link.inner_text().strip()
                    href = link.get_attribute("href") or ""
                    if href.startswith("/"):
                        href = f"https://www.jobstreet.com.ph{href}"

                    # Walk up to find the job card container, then find company
                    card = link.evaluate_handle(
                        "el => el.closest('article') || el.closest('[data-job-id]') || el.parentElement"
                    )
                    company_el = card.query_selector(
                        '[data-automation="job-card-company"], [data-automation="jobCompany"], [class*="company"]'
                    )
                    company = company_el.inner_text().strip() if company_el else "Unknown"

                    if title and href:
                        results.append(
                            {
                                "title": title,
                                "company": company,
                                "url": href,
                                "source": "JobStreet.ph",
                            }
                        )
                except Exception:
                    continue

            browser.close()

    except Exception as exc:
        logger.error(f"[JobStreet] Scraper error for '{keyword}': {exc}")

    logger.info(f"[JobStreet] '{keyword}': {len(results)} results")
    return results
