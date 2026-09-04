"""indeed.ph scraper using python-jobspy with strict freshness limit, clean URLs, and description extraction."""
import logging
import urllib.parse
from typing import Optional

logger = logging.getLogger(__name__)


def _clean_indeed_url(url: str) -> str:
    if not url:
        return ""
    if "jk=" in url:
        parsed = urllib.parse.urlparse(url)
        params = urllib.parse.parse_qs(parsed.query)
        jk = params.get("jk", [""])[0]
        if jk:
            return f"https://ph.indeed.com/viewjob?jk={jk}"
    return url.split("?")[0] if "?" in url else url


def scrape(keyword: str, location: str = "Philippines", max_results: int = 10) -> list[dict]:
    """
    Scrape indeed.ph for recently posted jobs (past 48 hours).
    Returns a list of normalized job dicts: {title, company, url, source, location, salary, description}.
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
            raw_url = str(row.get("job_url", "")).strip()
            url = _clean_indeed_url(raw_url)
            job_loc = str(row.get("location", location)).strip()
            desc = str(row.get("description", "")).strip()
            if desc == "nan":
                desc = ""

            min_sal = row.get("min_amount")
            max_sal = row.get("max_amount")
            interval = str(row.get("interval", "")).strip()
            currency = str(row.get("currency", "PHP")).strip()

            salary_str = "Negotiable"
            if min_sal and str(min_sal) != "nan":
                if max_sal and str(max_sal) != "nan" and max_sal != min_sal:
                    salary_str = f"{currency} {min_sal:,.0f} - {max_sal:,.0f}"
                else:
                    salary_str = f"{currency} {min_sal:,.0f}"
                if interval and interval != "nan":
                    salary_str += f" /{interval}"

            if title and url and url != "nan":
                results.append(
                    {
                        "title": title,
                        "company": company if company != "nan" else "Unknown Company",
                        "url": url,
                        "source": "Indeed.ph",
                        "location": job_loc if job_loc != "nan" else location,
                        "salary": salary_str,
                        "apply_type": "Indeed Easy Apply",
                        "description": desc,
                    }
                )
        logger.info(f"[Indeed] '{keyword}': {len(results)} fresh results")
        return results

    except ImportError:
        logger.error("python-jobspy is not installed. Run: pip3 install python-jobspy")
        return []
    except Exception as exc:
        logger.error(f"[Indeed] Scraper error for '{keyword}': {exc}")
        return []
