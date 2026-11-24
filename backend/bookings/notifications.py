"""The email the venue receives for each new table request: HTML with a plain-text fallback."""

import re

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone


def _when(days):
    if days == 0:
        return "Today"
    if days == 1:
        return "Tomorrow"
    if days < 0:
        return "In the past"
    return f"In {days} days"


def booking_email_context(booking):
    base = settings.PUBLIC_BACKEND_URL.rstrip("/")
    submitted = timezone.localtime(booking.submitted_at) if booking.submitted_at else timezone.localtime()
    hour = booking.time.strftime("%I").lstrip("0")
    return {
        "booking": booking,
        "date_long": f"{booking.date:%A} {booking.date.day} {booking.date:%B %Y}",
        "date_day": booking.date.day,
        "date_month": f"{booking.date:%b}".upper(),
        "weekday": f"{booking.date:%A}",
        "time_label": f"{hour}:{booking.time:%M %p}",
        "guests_label": f"{booking.guests} guest{'s' if booking.guests != 1 else ''}",
        "when_label": _when((booking.date - timezone.localdate()).days),
        "submitted_label": f"{submitted.day} {submitted:%b %Y}, {submitted.strftime('%I').lstrip('0')}:{submitted:%M %p}",
        "phone_href": "tel:" + re.sub(r"[^\d+]", "", booking.phone),
        "admin_url": f"{base}/admin/bookings/bookingrequest/{booking.pk}/change/",
        "list_url": f"{base}/admin/bookings/bookingrequest/?status=new",
    }


def build_booking_email(booking):
    context = booking_email_context(booking)
    subject = f"New table request · {booking.name} · {context['weekday'][:3]} {booking.date.day} {booking.date:%b}, {context['time_label']} · {context['guests_label']}"
    message = EmailMultiAlternatives(
        subject=subject,
        body=render_to_string("bookings/email/booking_notification.txt", context),
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[settings.BOOKING_NOTIFICATION_EMAIL],
        reply_to=[booking.email],
    )
    message.attach_alternative(render_to_string("bookings/email/booking_notification.html", context), "text/html")
    return message
