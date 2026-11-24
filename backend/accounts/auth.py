import hashlib
import secrets
from datetime import timedelta

from django.utils import timezone

from .models import AccountToken


def token_digest(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def issue_token(account):
    raw = secrets.token_urlsafe(40)
    AccountToken.objects.create(
        account=account,
        token_hash=token_digest(raw),
        expires_at=timezone.now() + timedelta(days=30),
    )
    return raw


def account_from_request(request, touch=False):
    header = request.headers.get("Authorization", "")
    scheme, _, raw = header.partition(" ")
    if scheme.lower() != "bearer" or not raw:
        return None
    try:
        token = AccountToken.objects.select_related("account").get(
            token_hash=token_digest(raw), expires_at__gt=timezone.now(), account__is_active=True
        )
    except AccountToken.DoesNotExist:
        return None
    if touch:
        AccountToken.objects.filter(pk=token.pk).update(last_used_at=timezone.now())
    request.account_token = token
    return token.account

