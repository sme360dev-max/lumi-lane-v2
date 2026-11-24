import json
import logging
from datetime import date, time
from uuid import UUID

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import DatabaseError, connection, transaction
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import BookingRequest
from .notifications import build_booking_email
from accounts.auth import account_from_request

logger = logging.getLogger(__name__)


def health(request):
    """Readiness probe: return healthy only when Django can query its database."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except DatabaseError:
        logger.exception("Health check database query failed")
        return JsonResponse({"status": "error", "database": "unavailable"}, status=503)
    return JsonResponse({"status": "ok", "database": "ok", "time": timezone.now().isoformat()})


def _send_booking_notification(booking_id):
    try:
        if not settings.BOOKING_NOTIFICATION_EMAIL:
            raise RuntimeError("BOOKING_NOTIFICATION_EMAIL is not configured")
        booking = BookingRequest.objects.get(pk=booking_id)
        build_booking_email(booking).send(fail_silently=False)
        BookingRequest.objects.filter(pk=booking_id).update(notification_status=BookingRequest.NotificationStatus.SENT)
    except Exception:
        logger.exception("Booking notification failed for booking id %s", booking_id)
        BookingRequest.objects.filter(pk=booking_id).update(notification_status=BookingRequest.NotificationStatus.FAILED)


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def booking_create(request):
    if request.method == "OPTIONS":
        return JsonResponse({}, status=204)
    try:
        payload = json.loads(request.body or b"{}")
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({"error": "The request could not be read."}, status=400)
    if not isinstance(payload, dict):
        return JsonResponse({"error": "The request could not be read."}, status=400)
    if payload.get("website"):
        return JsonResponse({"message": "Your request has been received."}, status=201)

    request_id = payload.get("requestId")
    try:
        request_id = UUID(str(request_id)) if request_id else None
    except (ValueError, TypeError, AttributeError):
        return JsonResponse({"error": "Invalid request id."}, status=400)

    data = {key: str(payload.get(key, "")).strip() for key in ("name", "email", "phone", "guests", "date", "time", "notes")}
    errors = {}
    if not data["name"] or len(data["name"]) > 120:
        errors["name"] = "Please tell us your name (up to 120 characters)."
    try:
        validate_email(data["email"])
        if len(data["email"]) > 254:
            raise ValidationError("Email is too long")
    except ValidationError:
        errors["email"] = "Enter a valid email address."
    if sum(ch.isdigit() for ch in data["phone"]) < 8 or len(data["phone"]) > 40:
        errors["phone"] = "Enter a valid contact number."
    try:
        guests = int(data["guests"])
        if not 1 <= guests <= 30:
            raise ValueError
    except ValueError:
        errors["guests"] = "Enter between 1 and 30 guests. For larger groups, please call us."
        guests = 0
    try:
        booking_date = date.fromisoformat(data["date"])
        if booking_date < timezone.localdate():
            raise ValueError
    except ValueError:
        errors["date"] = "Choose today or a later date."
        booking_date = None
    try:
        booking_time = time.fromisoformat(data["time"])
    except ValueError:
        errors["time"] = "Enter a time such as 10:30 AM."
        booking_time = None
    if len(data["notes"]) > 2000:
        errors["notes"] = "Special requests can be up to 2,000 characters."
    if errors:
        return JsonResponse({"error": "Please check the highlighted details.", "errors": errors}, status=400)

    if not settings.BOOKING_NOTIFICATION_EMAIL:
        logger.error("BOOKING_NOTIFICATION_EMAIL is not configured")

    with transaction.atomic():
        if request_id:
            booking = BookingRequest.objects.filter(request_id=request_id).first()
        else:
            booking = None
        created = booking is None
        if created:
            booking = BookingRequest.objects.create(
                request_id=request_id or BookingRequest._meta.get_field("request_id").get_default(),
                name=data["name"], email=data["email"], phone=data["phone"], guests=guests,
                date=booking_date, time=booking_time, notes=data["notes"],
                account=account_from_request(request),
            )
            transaction.on_commit(lambda: _send_booking_notification(booking.pk))

    return JsonResponse(
        {"message": "Thank you. Your table request has been sent; the team will contact you to confirm.", "requestId": str(booking.request_id)},
        status=201 if created else 200,
    )
