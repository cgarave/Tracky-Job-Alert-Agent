"""LinkedIn Philippines job scraper using python-jobspy with guest API fallback sorted by newest listings."""
import logging
import urllib.parse
from bs4 import BeautifulSoup
import requests

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}


def _scrape_fallback(keyword: str, location: str, max_results: int) -> list[dict]:
    """Fallback scraper using LinkedIn public guest job search API filtered to past 3 days and sorted by date."""
    encoded_kw = urllib.parse.quote(keyword)
    encoded_loc = urllib.parse.quote(location)
    # f_TPR=r259200 (past 72h / 3 days), sortBy=DD (Date Descending / newest first)
    url = f"https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords={encoded_kw}&location={encoded_loc}&f_TPR=r259200&sortBy=DD&start=0"

    try:
        resp = requests.get(url, headers=HEADERS, timeout=12)
        if resp.status_code != 200:
            return []

        soup = BeautifulSoup(resp.text, "lxml")
        cards = soup.select("li")
        results = []

        for card in cards[:max_results]:
            title_el = card.select_one(".base-search-card__title, h3")
            comp_el = card.select_one(".base-search-card__subtitle, h4")
            link_el = card.select_one("a.base-card__full-link, a")
            loc_el = card.select_one(".job-search-card__location")

            if not title_el or not link_el:
                continue

            title = title_el.get_text(strip=True)
            company = comp_el.get_text(strip=True) if comp_el else "Unknown Company"
            href = link_el.get("href", "").split("?")[0]
            loc_text = loc_el.get_text(strip=True) if loc_el else location

            if title and href:
                results.append({
                    "title": title,
                    "company": company,
                    "url": href,
                    "source": "LinkedIn",
                    "location": loc_text,
                    "salary": "Negotiable",
                    "apply_type": "LinkedIn Apply",
                })
        return results
    except Exception as exc:
        logger.warning(f"[LinkedIn Fallback] Error for '{keyword}': {exc}")
        return []


def scrape(keyword: str, location: str = "Philippines", max_results: int = 10) -> list[dict]:
    """
    Scrape fresh job listings from LinkedIn Philippines.
    Returns list of normalized job dicts: {title, company, url, source, location, salary, apply_type}.
    """
    results = []

    # 1. Try python-jobspy with 72-hour freshness limit
    try:
        from jobspy import scrape_jobs

        df = scrape_jobs(
            site_name=["linkedin"],
            search_term=keyword,
            location=location,
            results_wanted=max_results,
            country_indeed="Philippines",
            hours_old=72,
        )

        if not df.empty:
            for _, row in df.iterrows():
                title = str(row.get("title") or "").strip()
                company = str(row.get("company") or "").strip() or "LinkedIn Employer"
                url = str(row.get("job_url") or "").strip()
                job_loc = str(row.get("location") or "").strip() or location
                salary = str(row.get("min_amount") or "")
                if salary and salary != "nan":
                    salary_str = f"{salary} PHP"
                else:
                    salary_str = "Negotiable"

                if title and url:
                    results.append({
                        "title": title,
                        "company": company,
                        "url": url.split("?")[0],
                        "source": "LinkedIn",
                        "location": job_loc,
                        "salary": salary_str,
                        "apply_type": "LinkedIn Apply",
                    })

            if results:
                logger.info(f"[LinkedIn] '{keyword}': {len(results)} fresh results (via JobSpy)")
                return results[:max_results]
    except Exception as exc:
        logger.warning(f"[LinkedIn] JobSpy failed for '{keyword}': {exc}")

    # 2. Try guest API fallback with date sort
    results = _scrape_fallback(keyword, location, max_results)
    logger.info(f"[LinkedIn] '{keyword}': {len(results)} fresh results (via Guest API)")
    return results[:max_results]
