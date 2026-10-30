"""Read-only probe of MSE's HTML directory, not a production price collector."""

import argparse
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from urllib.robotparser import RobotFileParser


SOURCE_URL = "https://open.mse.mn/securities"
USER_AGENT = "EquitiesResearch/0.1"
SECTIONS = {"class1": 1, "class2": 2, "class3": 3, "delisted": None}


def fetch_text(url):
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=20) as response:
        return response.read().decode("utf-8")


class ListingsParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.divs = []
        self.sections_seen = set()
        self.groups = {section: [] for section in SECTIONS}
        self.row = None
        self.cell = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "div":
            section = attrs.get("id")
            self.divs.append(section)
            if section in SECTIONS:
                self.sections_seen.add(section)
        elif tag == "tr":
            self.row = []
        elif tag == "td":
            self.cell = {"parts": [], "href": None}
        elif tag == "a" and self.cell is not None:
            self.cell["href"] = attrs.get("href")

    def handle_data(self, data):
        if self.cell is not None:
            self.cell["parts"].append(data)

    def handle_endtag(self, tag):
        if tag == "td" and self.cell is not None:
            self.cell["text"] = " ".join("".join(self.cell.pop("parts")).split())
            self.row.append(self.cell)
            self.cell = None
        elif tag == "tr":
            section = next((item for item in reversed(self.divs) if item in SECTIONS), None)
            if section and self.row:
                self.add_listing(section)
            self.row = None
        elif tag == "div":
            self.divs.pop()

    def add_listing(self, section):
        if len(self.row) != 3:
            raise ValueError(f"Unexpected directory columns in {section}")
        _, symbol, name = self.row
        href = symbol["href"]
        if not href or href != name["href"]:
            raise ValueError("Ticker and company links do not match")
        parsed = urlparse(href)
        match = re.fullmatch(r"/securities/(\d+)", parsed.path)
        if parsed.scheme != "https" or parsed.netloc != "open.mse.mn" or not match:
            raise ValueError(f"Unexpected profile URL: {href}")
        if not symbol["text"] or not name["text"]:
            raise ValueError("Empty symbol or company name")
        self.groups[section].append(
            {
                "sourceId": match.group(1),
                "symbol": symbol["text"],
                "nameMn": name["text"],
                "listingTier": SECTIONS[section],
                "listingStatus": "delisted" if section == "delisted" else "listed",
                "profileUrl": href,
            }
        )

    def result(self):
        if self.sections_seen != set(SECTIONS):
            raise ValueError("Expected listing sections are missing; inspect source HTML")
        listed = [row for key in ("class1", "class2", "class3") for row in self.groups[key]]
        if not listed:
            raise ValueError("No listed stocks found")
        for field in ("sourceId", "symbol"):
            if len({row[field] for row in listed}) != len(listed):
                raise ValueError(f"Duplicate listed {field}; source needs review")
        return {
            "sourceUrl": SOURCE_URL,
            "counts": {section: len(rows) for section, rows in self.groups.items()},
            "listed": listed,
            "delisted": self.groups["delisted"],
        }


def main():
    args_parser = argparse.ArgumentParser(description=__doc__)
    args_parser.add_argument("--html", type=Path, help="Parse a saved HTML fixture instead of fetching")
    args = args_parser.parse_args()
    if args.html:
        html = args.html.read_text(encoding="utf-8")
        mode = "saved-html"
    else:
        robots_url = "https://open.mse.mn/robots.txt"
        policy = RobotFileParser(robots_url)
        policy.parse(fetch_text(robots_url).splitlines())
        if not policy.can_fetch(USER_AGENT, SOURCE_URL):
            raise RuntimeError("Current robots policy disallows this directory fetch")
        html = fetch_text(SOURCE_URL)
        mode = "live-http"
    parser = ListingsParser()
    parser.feed(html)
    parser.close()
    result = parser.result()
    result["mode"] = mode
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
