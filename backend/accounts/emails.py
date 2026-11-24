"""HTML emails (with plain-text fallback) for pickup orders and password resets.

Layout lives in templates/emails/base.html, shared with the booking email.
"""

import re

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone


def _money(cents):
    return f"${cents / 100:,.2f}"


def _build(subject, template, context, to, reply_to=None):
    message = EmailMultiAlternatives(
        subject=subject,
        body=render_to_string(f"emails/{template}.txt", context),
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=to,
        reply_to=reply_to,
    )
    message.attach_alternative(render_to_string(f"emails/{template}.html", context), "text/html")
    return message


def build_order_email(order):
    account = order.account
    created = timezone.localtime(order.created_at)
    reference = str(order.request_id).split("-")[0].upper()
    lines = [
        {
            "quantity": line.get("quantity", 1),
            "name": line.get("name", "Menu item"),
            "label": line.get("label", ""),
            "amount": _money(line.get("subtotal", 0)),
        }
        for line in order.lines
    ]
    base = settings.PUBLIC_BACKEND_URL.rstrip("/")
    context = {
        "order": order,
        "reference": reference,
        "lines": lines,
        "item_count": sum(int(line["quantity"]) for line in lines),
        "subtotal": _money(order.subtotal_cents),
        "reward": _money(order.reward_cents),
        "has_reward": order.reward_cents > 0,
        "total": _money(order.total_cents),
        "customer_name": account.full_name or account.email,
        "customer_email": account.email,
        "customer_phone": account.phone,
        "phone_href": "tel:" + re.sub(r"[^\d+]", "", account.phone) if account.phone else "",
        "admin_url": f"{base}/admin/accounts/order/{order.pk}/change/" if base else "",
        "submitted_label": f"{created.day} {created:%b %Y}, {created.strftime('%I').lstrip('0')}:{created:%M %p}",
    }
    subject = f"New pickup order #{reference} · {context['customer_name']} · {context['total']} AUD"
    return _build(subject, "order_notification", context, [settings.BOOKING_NOTIFICATION_EMAIL], [account.email])


def build_password_reset_email(account, code, minutes=10):
    website = settings.PUBLIC_WEBSITE_URL.rstrip("/")
    context = {
        "name": (account.full_name or "there").split()[0],
        "email": account.email,
        "code": code,
        "minutes": minutes,
        "reset_url": f"{website}/reset-password/" if website else "",
    }
    return _build("Your Lumi Lane password reset code", "password_reset", context, [account.email])
