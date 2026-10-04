import ipaddress
import socket

import pytest

from app import fetch
from app.fetch import BlockedURLError, is_public_address, validate_url


def fake_dns(monkeypatch, *addresses):
    def getaddrinfo(host, port, *a, **k):
        return [(socket.AF_INET6 if ":" in a_ else socket.AF_INET, socket.SOCK_STREAM, 6, "", (a_, port)) for a_ in addresses]

    monkeypatch.setattr(fetch.socket, "getaddrinfo", getaddrinfo)


@pytest.mark.parametrize(
    "addr",
    [
        "127.0.0.1",
        "10.1.2.3",
        "172.16.0.1",
        "192.168.1.1",
        "169.254.169.254",  # AWS/GCP/Azure metadata
        "100.64.0.1",  # CGNAT
        "0.0.0.0",
        "224.0.0.1",
        "::1",
        "fe80::1",
        "fd00:ec2::254",  # AWS IPv6 metadata
        "::ffff:127.0.0.1",
        "::ffff:169.254.169.254",
    ],
)
def test_non_public_addresses_are_rejected(addr):
    assert not is_public_address(ipaddress.ip_address(addr))


@pytest.mark.parametrize("addr", ["93.184.215.14", "2606:2800:21f:cb07:6820:80da:af6b:8b2c"])
def test_public_addresses_are_allowed(addr):
    assert is_public_address(ipaddress.ip_address(addr))


@pytest.mark.parametrize(
    "url",
    ["file:///etc/passwd", "gopher://example.com/", "ftp://example.com/a.wav", "https://user:pw@example.com/a.wav", "https:///a.wav"],
)
def test_bad_urls_are_rejected(url, monkeypatch):
    fake_dns(monkeypatch, "93.184.215.14")
    with pytest.raises(BlockedURLError):
        validate_url(url)


def test_host_resolving_to_private_address_is_rejected(monkeypatch):
    fake_dns(monkeypatch, "10.0.0.5")
    with pytest.raises(BlockedURLError):
        validate_url("https://looks-public.example.com/a.wav")


def test_any_private_answer_rejects_the_host(monkeypatch):
    fake_dns(monkeypatch, "93.184.215.14", "127.0.0.1")
    with pytest.raises(BlockedURLError):
        validate_url("https://mixed.example.com/a.wav")


def test_literal_metadata_ip_is_rejected():
    with pytest.raises(BlockedURLError):
        validate_url("http://169.254.169.254/latest/meta-data/")


def test_connection_is_pinned_to_the_checked_address(monkeypatch):
    fake_dns(monkeypatch, "93.184.215.14")
    target = validate_url("https://cdn.example.com:8443/songs/a.wav?token=x")
    assert target.address == "93.184.215.14"
    assert target.hostname == "cdn.example.com"
    assert target.host_header == "cdn.example.com:8443"
    assert target.path == "/songs/a.wav?token=x"


def test_allowlist_restricts_hosts(monkeypatch):
    fake_dns(monkeypatch, "93.184.215.14")
    monkeypatch.setenv("RESONIQ_AUDIO_URL_ALLOWED_HOSTS", "abc.supabase.co")
    validate_url("https://abc.supabase.co/storage/v1/object/a.wav")
    with pytest.raises(BlockedURLError):
        validate_url("https://example.com/a.wav")


def test_redirects_are_revalidated(monkeypatch):
    """A public URL that redirects to a private one must be refused at the second hop."""
    answers = {"public.example.com": "93.184.215.14", "internal.example.com": "10.0.0.5"}

    def getaddrinfo(host, port, *a, **k):
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (answers[host], port))]

    class Resp:
        status = 302
        headers = {"Location": "http://internal.example.com/secret"}

        def release_conn(self):
            pass

    class Pool:
        def urlopen(self, *a, **k):
            return Resp()

        def close(self):
            pass

    monkeypatch.setattr(fetch.socket, "getaddrinfo", getaddrinfo)
    monkeypatch.setattr(fetch, "_pool", lambda *a, **k: Pool())
    with pytest.raises(BlockedURLError):
        fetch.fetch_audio("https://public.example.com/a.wav", max_bytes=1000)
