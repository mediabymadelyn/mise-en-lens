#!/usr/bin/env python3
"""Scrape a Letterboxd profile's Top 4 favorite films."""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass
from typing import List, Optional
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup


BASE_URL = "https://letterboxd.com"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
)
RESERVED_PATHS = {
    "film",
    "films",
    "list",
    "lists",
    "search",
    "activity",
    "signin",
    "sign-in",
    "pro",
    "about",
}


@dataclass
class Film:
    title: str
    film_url: Optional[str]
    poster_url: Optional[str]


def validate_username(candidate: str) -> str:
    candidate = candidate.strip("/@")
    if not re.fullmatch(r"[a-zA-Z0-9_\-]+", candidate):
        raise ValueError("Username can only include letters, numbers, _ and -")
    return candidate


def extract_username_from_url(url: str) -> Optional[str]:
    parsed = urlparse(url)
    host = parsed.netloc.lower().removeprefix("www.")
    if host != "letterboxd.com":
        return None

    path_parts = [part for part in parsed.path.split("/") if part]
    if not path_parts:
        return None

    first = path_parts[0].strip("/@")
    if first.lower() in RESERVED_PATHS:
        return None

    if re.fullmatch(r"[a-zA-Z0-9_\-]+", first):
        return first
    return None


def normalize_username(value: str, timeout: float = 12.0) -> str:
    candidate = value.strip()
    if not candidate:
        raise ValueError("Username is required.")

    if candidate.startswith("http://") or candidate.startswith("https://"):
        parsed = urlparse(candidate)
        host = parsed.netloc.lower().removeprefix("www.")

        if host == "boxd.it":
            resolved = requests.get(
                candidate,
                headers={"User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9"},
                timeout=timeout,
                allow_redirects=True,
            )
            username = extract_username_from_url(resolved.url)
            if not username:
                raise ValueError("Short URL did not resolve to a Letterboxd profile.")
            return username

        username = extract_username_from_url(candidate)
        if username:
            return username

        resolved = requests.get(
            candidate,
            headers={"User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9"},
            timeout=timeout,
            allow_redirects=True,
        )
        redirected_username = extract_username_from_url(resolved.url)
        if redirected_username:
            return redirected_username

        raise ValueError("Could not find a Letterboxd profile username in the provided URL.")

    return validate_username(candidate)


def absolutize_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    if url.startswith("//"):
        return f"https:{url}"
    if url.startswith("/"):
        return f"{BASE_URL}{url}"
    return url


def clean_title(raw_title: str) -> str:
    title = raw_title.strip()
    title = re.sub(r"^Poster\s+for\s+", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\s+\(.*poster.*\)$", "", title, flags=re.IGNORECASE)
    return title.strip()


def parse_favorites_from_meta_description(soup: BeautifulSoup) -> List[Film]:
    meta = soup.select_one("meta[name='description']")
    if not meta:
        return []

    description = (meta.get("content") or "").strip()
    if "Favorites:" not in description:
        return []

    match = re.search(r"Favorites:\s*(.+?)(?:\.|$)", description)
    if not match:
        return []

    segment = match.group(1)
    entries = [part.strip() for part in segment.split(",") if part.strip()]

    films: List[Film] = []
    for entry in entries:
        title = clean_title(entry)
        if not title:
            continue
        films.append(Film(title=title, film_url=None, poster_url=None))
        if len(films) == 4:
            break

    return films


def resolve_direct_poster_url(film_url: Optional[str], timeout: float = 8.0) -> Optional[str]:
    if not film_url:
        return None

    try:
        response = requests.get(
            film_url,
            headers={
                "User-Agent": USER_AGENT,
                "Accept-Language": "en-US,en;q=0.9",
            },
            timeout=timeout,
        )
        if response.status_code >= 400:
            return None

        soup = BeautifulSoup(response.text, "html.parser")

        # Prefer structured data image because it typically points to the actual poster,
        # while og:image may be an alternative backdrop on some titles.
        for script in soup.select("script[type='application/ld+json']"):
            raw_text = (script.string or script.get_text() or "").strip()
            if not raw_text:
                continue

            cleaned = re.sub(r"^/\*\s*<!\[CDATA\[\s*\*/", "", raw_text)
            cleaned = re.sub(r"/\*\s*\]\]>\s*\*/$", "", cleaned).strip()

            try:
                payload = json.loads(cleaned)
            except json.JSONDecodeError:
                continue

            entries = payload if isinstance(payload, list) else [payload]
            for entry in entries:
                if not isinstance(entry, dict):
                    continue
                image = entry.get("image")
                if isinstance(image, str) and image:
                    return absolutize_url(image)

        og = soup.select_one("meta[property='og:image']")
        if og and og.get("content"):
            return absolutize_url(og.get("content"))

        tw = soup.select_one("meta[name='twitter:image']")
        if tw and tw.get("content"):
            return absolutize_url(tw.get("content"))
    except requests.RequestException:
        return None

    return None


def parse_top4_from_profile_html(html: str) -> List[Film]:
    soup = BeautifulSoup(html, "html.parser")

    favorites_section = (
        soup.select_one("section#favourites")
        or soup.select_one("section.favorites")
        or soup.select_one("section.profile-favorites")
        or soup
    )

    films: List[Film] = []
    seen_titles = set()

    lazy_posters = favorites_section.select(
        "div.react-component[data-component-class='LazyPoster']"
    )
    for poster in lazy_posters:
        raw_title = (
            poster.get("data-item-name")
            or poster.get("data-item-full-display-name")
            or ""
        )
        title = clean_title(raw_title) if raw_title else ""
        if not title:
            continue

        normalized = title.lower()
        if normalized in seen_titles:
            continue

        seen_titles.add(normalized)
        film_url = absolutize_url(
            poster.get("data-item-link")
            or poster.get("data-target-link")
            or poster.get("data-details-endpoint", "").replace("/json/", "/")
        )
        poster_url = absolutize_url(poster.get("data-poster-url"))

        img_tag = poster.select_one("img")
        if img_tag:
            img_src = absolutize_url(img_tag.get("src") or img_tag.get("data-src"))
            if img_src and "empty-poster" not in img_src:
                poster_url = img_src

        films.append(Film(title=title, film_url=film_url, poster_url=poster_url))
        if len(films) == 4:
            return films

    candidates = favorites_section.select("li.poster-container")
    if not candidates:
        candidates = favorites_section.select("li[class*='poster-container']")

    for candidate in candidates:
        link_tag = candidate.select_one("a[href*='/film/']")
        img_tag = candidate.select_one("img")

        raw_title = ""
        if img_tag and img_tag.get("alt"):
            raw_title = img_tag.get("alt", "")
        elif link_tag and link_tag.get("title"):
            raw_title = link_tag.get("title", "")

        title = clean_title(raw_title) if raw_title else ""
        if not title:
            continue

        normalized = title.lower()
        if normalized in seen_titles:
            continue

        seen_titles.add(normalized)
        film_url = absolutize_url(link_tag.get("href") if link_tag else None)
        poster_url = None
        if img_tag:
            poster_url = absolutize_url(
                img_tag.get("src") or img_tag.get("data-src") or img_tag.get("srcset", "").split(" ")[0]
            )

        films.append(Film(title=title, film_url=film_url, poster_url=poster_url))
        if len(films) == 4:
            break

    if films:
        return films

    return parse_favorites_from_meta_description(soup)


def scrape_top4(username_or_url: str, timeout: float = 12.0) -> dict:
    username = normalize_username(username_or_url, timeout=timeout)
    url = f"{BASE_URL}/{username}/"

    response = requests.get(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept-Language": "en-US,en;q=0.9",
        },
        timeout=timeout,
    )

    if response.status_code == 404:
        return {
            "ok": False,
            "username": username,
            "error": "Profile not found (404). Check the username.",
            "films": [],
        }

    if response.status_code >= 400:
        return {
            "ok": False,
            "username": username,
            "error": f"Letterboxd returned status {response.status_code}.",
            "films": [],
        }

    films = parse_top4_from_profile_html(response.text)

    if not films:
        soup = BeautifulSoup(response.text, "html.parser")
        favorites_section = soup.select_one("section#favourites")
        if favorites_section:
            section_text = " ".join(favorites_section.get_text(" ", strip=True).split())
            if "Don’t forget to select your favorite films" in section_text or "Don't forget to select your favorite films" in section_text:
                return {
                    "ok": False,
                    "username": username,
                    "error": "This user has not set a Top 4 yet.",
                    "films": [],
                }

        lower_html = response.text.lower()
        if "this profile is private" in lower_html or "members only" in lower_html:
            return {
                "ok": False,
                "username": username,
                "error": "This profile is private or requires sign-in.",
                "films": [],
            }

        return {
            "ok": False,
            "username": username,
            "error": "No Top 4 films found. The profile may be private or page markup changed.",
            "films": [],
        }

    result = {
        "ok": True,
        "username": username,
        "source_url": url,
        "films": [],
    }

    for film in films:
        direct_poster = resolve_direct_poster_url(film.film_url, timeout=min(timeout, 8.0))
        if direct_poster:
            film.poster_url = direct_poster
        result["films"].append(asdict(film))

    if len(films) < 4:
        result["warning"] = f"Only found {len(films)} favorites."

    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Scrape Letterboxd Top 4 favorites")
    parser.add_argument("username", help="Letterboxd username or profile URL")
    args = parser.parse_args()

    try:
        payload = scrape_top4(args.username)
    except ValueError as exc:
        payload = {"ok": False, "error": str(exc), "films": []}
    except requests.RequestException as exc:
        payload = {"ok": False, "error": f"Request failed: {exc}", "films": []}
    except Exception as exc:  # noqa: BLE001
        payload = {"ok": False, "error": f"Unexpected scraper error: {exc}", "films": []}

    print(json.dumps(payload, ensure_ascii=True))
    return 0 if payload.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
