"""Small database-backed rate limiter for the public API.

Counters live in Postgres so both gunicorn workers share them and a restart does not
reset them. Each rule is (scope, value, limit, window seconds); values such as email
addresses are hashed so the table never stores them in plain text.
"""

import hashlib
import random
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone

from .models import RateLimit


def client_ip(request):
    """Visitor IP behind Render's proxy (Cloudflare sets CF-Connecting-IP and overwrites any sent by the client)."""
    for header in ("HTTP_CF_CONNECTING_IP", "HTTP_TRUE_CLIENT_IP"):
        value = request.META.get(header, "").strip()
        if value:
            return value
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded:
        return forwarded.split(",")[-1].strip()  # the hop added by the proxy, not the client
    return request.META.get("REMOTE_ADDR", "")


def _key(scope, value):
    digest = hashlib.sha256(str(value).strip().lower().encode("utf-8")).hexdigest()[:40]
    return f"{scope}:{digest}"


def _hit(key, limit, window):
    """Count one request; return seconds to wait when over the limit, else 0."""
    now = timezone.now()
    with transaction.atomic():
        row, created = RateLimit.objects.select_for_update().get_or_create(
            key=key, defaults={"window_start": now, "count": 1}
        )
        if not created:
            if now - row.window_start >= timedelta(seconds=window):
                row.window_start, row.count = now, 1
            else:
                row.count += 1
            row.save(update_fields=("window_start", "count"))
    if random.random() < 0.01:  # occasional cleanup of long-expired counters
        RateLimit.objects.filter(window_start__lt=now - timedelta(days=1)).delete()
    if row.count <= limit:
        return 0
    return max(1, int(window - (now - row.window_start).total_seconds()))


def check(request, *rules):
    """Return a 429 response if any rule is exceeded, otherwise None.

    Every rule is counted even when an earlier one fails, so an attacker cannot
    dodge the per-email counter by tripping the per-IP one first.
    """
    if not getattr(settings, "RATE_LIMITS_ENABLED", True):
        return None
    wait = 0
    for scope, value, limit, window in rules:
        if value:
            wait = max(wait, _hit(_key(scope, value), limit, window))
    if not wait:
        return None
    minutes = max(1, round(wait / 60))
    response = JsonResponse(
        {"error": f"Too many attempts. Please wait about {minutes} minute{'s' if minutes != 1 else ''} and try again."},
        status=429,
    )
    response["Retry-After"] = str(wait)
    return response
