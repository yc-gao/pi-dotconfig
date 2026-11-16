#!/usr/bin/env python3
"""Convert a Cookie request header to Netscape HTTP Cookie File format."""

import argparse
import re
import sys
from pathlib import Path
from typing import List, Optional, Sequence, Tuple


COOKIE_NAME_RE = re.compile(r"[!#$%&'*+\-.^_`|~0-9A-Za-z]+\Z")
DOMAIN_LABEL_RE = re.compile(r"[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\Z")
NETSCAPE_HEADER = "# Netscape HTTP Cookie File"


def normalize_domain(domain: str) -> Tuple[str, str]:
    """Validate a cookie domain and return its host and subdomain flag."""
    includes_subdomains = domain.startswith(".")
    host = domain[1:] if includes_subdomains else domain

    if not host or len(host) > 253 or any(not label for label in host.split(".")):
        raise ValueError("domain must be a hostname, optionally prefixed with a dot")

    try:
        ascii_host = host.encode("idna").decode("ascii")
    except UnicodeError as exc:
        raise ValueError("domain is not a valid hostname") from exc

    if any(not DOMAIN_LABEL_RE.fullmatch(label) for label in ascii_host.split(".")):
        raise ValueError("domain is not a valid hostname")

    return ascii_host, "TRUE" if includes_subdomains else "FALSE"


def parse_cookie_header(header: str) -> List[Tuple[str, str]]:
    """Parse a Cookie header into name/value pairs."""
    header = header.strip()
    if header[:7].lower() == "cookie:":
        header = header[7:].strip()

    if not header:
        raise ValueError("no cookies found in input")

    cookies = []
    for item in header.split(";"):
        item = item.strip()
        if not item:
            continue

        name, separator, value = item.partition("=")
        name = name.strip()
        value = value.strip()
        if not separator or not COOKIE_NAME_RE.fullmatch(name):
            raise ValueError("invalid cookie pair: {!r}".format(item))
        if any(char in value for char in "\t\r\n"):
            raise ValueError("cookie values cannot contain tabs or newlines")

        cookies.append((name, value))

    if not cookies:
        raise ValueError("no cookies found in input")
    return cookies


def convert_to_netscape(header: str, domain: str) -> str:
    """Convert a Cookie header into Netscape cookie-file text."""
    host, include_subdomains = normalize_domain(domain)
    cookies = parse_cookie_header(header)
    lines = [NETSCAPE_HEADER]

    for name, value in cookies:
        lines.append(
            "{}\t{}\t/\tFALSE\t0\t{}\t{}".format(
                host, include_subdomains, name, value
            )
        )

    return "\n".join(lines) + "\n"


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="Convert a Cookie header to Netscape cookies.txt format."
    )
    parser.add_argument(
        "cookie_header",
        nargs="?",
        help="Cookie header text; if omitted, read it from stdin",
    )
    parser.add_argument(
        "--domain",
        required=True,
        help="cookie domain, e.g. www.example.com or .example.com",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        help="write to this file instead of stdout",
    )
    args = parser.parse_args(argv)

    header = args.cookie_header if args.cookie_header is not None else sys.stdin.read()
    try:
        output = convert_to_netscape(header, args.domain)
    except ValueError as exc:
        parser.error(str(exc))

    if args.output is None:
        sys.stdout.write(output)
    else:
        args.output.write_text(output, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
