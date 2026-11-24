r"""
   \==================================================================
   \==   @ Henvo                                                    ==
   \==   @ author: Mai Quoc Viet                                    ==
   \==   @ project: knowledge                                       ==
   \==   @ copyright: (c) 2026 Henvo. All rights reserved.          ==
   \==================================================================
"""

from django import template
from django.utils import timezone
from django.utils.html import format_html
from django.templatetags.static import static

from admin_ui.nav import build_nav
from admin_ui.text_format import group_digits

register = template.Library()

ICON_SPRITE = "admin_ui/img/admin-icons.svg"

@register.simple_tag(takes_context=True)
def admin_nav(context):
    """The sidebar sections for the signed-in staff member, or none."""
    request = context.get("request")
    if request is None or not getattr(request.user, "is_staff", False):
        return []
    return build_nav(request)


@register.simple_tag
def icon(name, extra=""):
    """
    One glyph from the admin's own icon sprite.

    A sprite rather than an icon font: every glyph is drawn in the same 24-unit
    grid with the same stroke, takes its colour from the text around it, and
    nothing is fetched from a third party.
    """
    classes = f"hv-i {extra}".strip()
    return format_html(
        '<svg class="{}" aria-hidden="true" focusable="false"><use href="{}#{}"></use></svg>',
        classes,
        static(ICON_SPRITE),
        name,
    )


@register.filter
def initials(user):
    """Two letters for the avatar circle: first and last name, else the username."""
    first = (getattr(user, "first_name", "") or "").strip()
    last = (getattr(user, "last_name", "") or "").strip()
    if first or last:
        letters = (last[:1] + first[:1]) if last and first else (first or last)[:2]
    else:
        letters = (getattr(user, "username", "") or "?")[:2]
    return letters.upper()


@register.filter
def digits(value):
    """450000 as 450,000, for numbers set in running text."""
    return group_digits(value)


@register.filter
def order_status_tone(status):
    return {
        "received": "pending", "accepted": "info", "preparing": "info",
        "ready": "approved", "completed": "live", "cancelled": "rejected",
    }.get(status, "quiet")


@register.simple_tag
def today_label():
    """Today at the venue (Adelaide), e.g. "Sunday 22 November 2026"."""
    today = timezone.localdate()
    return f"{today:%A} {today.day} {today:%B %Y}"


@register.simple_tag
def greeting():
    """A greeting based on the venue's local time (Adelaide)."""
    hour = timezone.localtime().hour
    if hour < 12:
        return "Good morning"
    if hour < 17:
        return "Good afternoon"
    return "Good evening"


@register.simple_tag
def booking_dashboard_counts():
    """A few useful totals and the next reservations, without loading the full lists."""
    try:
        from bookings.models import BookingRequest
        from menu.models import MenuItem
        from accounts.models import LoyaltyEntry, LoyaltyProgram, Order

        today = timezone.localdate()
        active = BookingRequest.objects.exclude(status=BookingRequest.Status.CANCELLED)
        return {
            "new": BookingRequest.objects.filter(status=BookingRequest.Status.NEW).count(),
            "today": active.filter(date=today).count(),
            "email_issues": BookingRequest.objects.filter(
                notification_status=BookingRequest.NotificationStatus.FAILED
            ).count(),
            "sold_out": MenuItem.objects.filter(is_available=False).count(),
            "upcoming": list(active.filter(date__gte=today).order_by("date", "time")[:6]),
            "orders_new": Order.objects.filter(status=Order.Status.RECEIVED).count(),
            "orders_active": Order.objects.filter(status__in=(Order.Status.ACCEPTED, Order.Status.PREPARING, Order.Status.READY)).count(),
            "order_email_issues": Order.objects.filter(notification_status=Order.NotificationStatus.FAILED).count(),
            "recent_orders": list(Order.objects.select_related("account").exclude(status=Order.Status.CANCELLED).order_by("-created_at")[:5]),
            "loyalty_program": LoyaltyProgram.objects.filter(pk=1).first(),
            "recent_loyalty": list(LoyaltyEntry.objects.select_related("account", "order").order_by("-created_at")[:4]),
        }
    except Exception:
        return {"new": 0, "today": 0, "email_issues": 0, "sold_out": 0, "upcoming": [], "orders_new": 0, "orders_active": 0, "order_email_issues": 0, "recent_orders": [], "loyalty_program": None, "recent_loyalty": []}
