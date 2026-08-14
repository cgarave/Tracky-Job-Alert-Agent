"""indeed.ph scraper using python-jobspy."""
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def scrape(keyword: str, location: str = "Philippines", max_results: int = 10) -> list[dict]:
    """
    Scrape indeed.ph for the given keyword.
    Returns a list of normalized job dicts: {title, company, url, source}.
    """
    try:
        from jobspy import scrape_jobs  # type: ignore

        jobs_df = scrape_jobs(
            site_name=["indeed"],
            search_term=keyword,
            location=location,
            results_wanted=max_results,
            country_indeed="Philippines",
            hours_old=48,
            verbose=0,
        )

        results = []
        for _, row in jobs_df.iterrows():
            title = str(row.get("title", "")).strip()
            company = str(row.get("company", "Unknown")).strip()
            url = str(row.get("job_url", "")).strip()
            if title and url and url != "nan":
                results.append(
                    {
                        "title": title,
                        "company": company if company != "nan" else "Unknown",
                        "url": url,
                        "source": "Indeed.ph",
                    }
                )
        logger.info(f"[Indeed] '{keyword}': {len(results)} results")
        return results

    except ImportError:
        logger.error("python-jobspy is not installed. Run: pip3 install python-jobspy")
        return []
    except Exception as exc:
        logger.error(f"[Indeed] Scraper error for '{keyword}': {exc}")
        return []
