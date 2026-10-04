"""
SSRF-safe audio download for `POST /analyze` (the URL form).

The engine runs inside the deployment's network, so a caller-supplied URL
must never reach localhost, private/link-local ranges, or cloud metadata
endpoints. The host is resolved once, every resolved address is checked,
and the connection is pinned to a checked address, so a DNS answer that
changes between the check and the connect (DNS rebinding) cannot redirect
the request. Redirects are followed by hand and re-validated hop by hop.
"""

import ipaddress
import os
import socket
from dataclasses import dataclass
from urllib.parse import urljoin, urlsplit

import certifi
from urllib3 import HTTPConnectionPool, HTTPSConnectionPool
from urllib3.exceptions import HTTPError
from urllib3.util import Timeout

MAX_REDIRECTS = 3
CHUNK_BYTES = 64 * 1024


class FetchError(Exception):
    """Raised for anything that stops a download. The message is safe to log, not to return."""


class BlockedURLError(FetchError):
    """The URL points somewhere the engine must not connect to."""


class TooLargeError(FetchError):
    pass


@dataclass(frozen=True)
class _Target:
    scheme: str
    hostname: str
    port: int
    path: str
    host_header: str
    address: str


def _allowed_hosts() -> set[str]:
    raw = os.environ.get("RESONIQ_AUDIO_URL_ALLOWED_HOSTS", "")
    return {h.strip().lower() for h in raw.split(",") if h.strip()}


def is_public_address(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    if isinstance(ip, ipaddress.IPv6Address):
        # ::ffff:127.0.0.1 and friends would otherwise dodge the IPv4 checks.
        mapped = ip.ipv4_mapped or ip.sixtofour
        if mapped is not None:
            return is_public_address(mapped)
    # is_global excludes loopback, RFC 1918, link-local (169.254.169.254 and
    # other metadata endpoints), CGNAT, unique-local IPv6, documentation and
    # reserved ranges. Multicast is global-scoped in some cases, so it is
    # excluded explicitly.
    return ip.is_global and not ip.is_multicast


def _resolve(hostname: str, port: int) -> list[str]:
    try:
        infos = socket.getaddrinfo(hostname, port, type=socket.SOCK_STREAM)
    except socket.gaierror as e:
        raise FetchError(f"DNS lookup failed for {hostname}: {e}") from e
    return list(dict.fromkeys(info[4][0] for info in infos))


def validate_url(url: str) -> _Target:
    parts = urlsplit(url)
    scheme = parts.scheme.lower()
    if scheme not in ("http", "https"):
        raise BlockedURLError(f"scheme {scheme!r} not allowed")
    if parts.username or parts.password:
        raise BlockedURLError("credentials in URL not allowed")
    hostname = (parts.hostname or "").lower().rstrip(".")
    if not hostname:
        raise BlockedURLError("URL has no host")

    allowed = _allowed_hosts()
    if allowed and hostname not in allowed:
        raise BlockedURLError(f"host {hostname} is not in RESONIQ_AUDIO_URL_ALLOWED_HOSTS")

    try:
        port = parts.port or (443 if scheme == "https" else 80)
    except ValueError as e:
        raise BlockedURLError("invalid port") from e

    addresses = _resolve(hostname, port)
    if not addresses:
        raise FetchError(f"{hostname} did not resolve")
    for addr in addresses:
        # Every answer must be public, not just the first: otherwise a host
        # with one public and one private A record could pick either.
        if not is_public_address(ipaddress.ip_address(addr.split("%", 1)[0])):
            raise BlockedURLError(f"{hostname} resolves to non-public address {addr}")

    path = parts.path or "/"
    if parts.query:
        path += f"?{parts.query}"
    host = f"[{parts.hostname}]" if ":" in parts.hostname else parts.hostname
    host_header = host if port == (443 if scheme == "https" else 80) else f"{host}:{port}"
    return _Target(scheme, hostname, port, path, host_header, addresses[0])


def _pool(target: _Target, timeout_s: float):
    timeout = Timeout(connect=min(timeout_s, 10.0), read=timeout_s)
    if target.scheme == "https":
        # Connect to the checked IP, but verify the certificate (and send
        # SNI) for the original hostname.
        return HTTPSConnectionPool(
            target.address,
            target.port,
            timeout=timeout,
            retries=False,
            server_hostname=target.hostname,
            assert_hostname=target.hostname,
            cert_reqs="CERT_REQUIRED",
            ca_certs=certifi.where(),
        )
    return HTTPConnectionPool(target.address, target.port, timeout=timeout, retries=False)


def fetch_audio(url: str, max_bytes: int, timeout_s: float = 30.0) -> bytes:
    """Download `url` into memory, refusing non-public hosts and anything over `max_bytes`."""
    for _ in range(MAX_REDIRECTS + 1):
        target = validate_url(url)
        pool = _pool(target, timeout_s)
        try:
            resp = pool.urlopen(
                "GET",
                target.path,
                headers={"Host": target.host_header, "User-Agent": "resoniq-engine"},
                redirect=False,
                preload_content=False,
            )
        except HTTPError as e:
            pool.close()
            raise FetchError(f"request to {target.hostname} failed: {e}") from e

        try:
            if resp.status in (301, 302, 303, 307, 308):
                location = resp.headers.get("Location")
                if not location:
                    raise FetchError(f"redirect from {target.hostname} without Location")
                url = urljoin(url, location)
                continue
            if resp.status != 200:
                raise FetchError(f"{target.hostname} returned HTTP {resp.status}")

            declared = resp.headers.get("Content-Length")
            if declared and declared.isdigit() and int(declared) > max_bytes:
                raise TooLargeError(f"Content-Length {declared} exceeds {max_bytes}")

            chunks, total = [], 0
            for chunk in resp.stream(CHUNK_BYTES):
                total += len(chunk)
                if total > max_bytes:
                    raise TooLargeError(f"body exceeds {max_bytes} bytes")
                chunks.append(chunk)
            return b"".join(chunks)
        except HTTPError as e:
            raise FetchError(f"reading from {target.hostname} failed: {e}") from e
        finally:
            resp.release_conn()
            pool.close()

    raise FetchError(f"more than {MAX_REDIRECTS} redirects")
