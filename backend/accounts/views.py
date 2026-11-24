import json
import logging
import re
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import F
from django.db.models import Sum
from django.core.validators import validate_email
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from bookings.models import BookingRequest
from menu.models import MenuItem
from menu.serializers import build_menu

from .auth import issue_token, token_digest
from .decorators import account_required
from .emails import build_order_email, build_password_reset_email
from . import ratelimit
from .models import Account, CartItem, LoyaltyEntry, LoyaltyProgram, Order, PasswordResetToken

logger = logging.getLogger(__name__)

MINUTE, HOUR = 60, 3600


def _payload(request):
    try:
        data = json.loads(request.body or b"{}")
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None
    return data if isinstance(data, dict) else None


def _account_json(account):
    return {
        "id": str(account.pk), "name": account.full_name, "email": account.email,
        "phone": account.phone, "avatar": account.avatar,
    }


def _auth_response(account, status=200):
    return JsonResponse({"account": _account_json(account), "token": issue_token(account)}, status=status)


def _send_order_notification(order_id):
    order = Order.objects.select_related("account").filter(pk=order_id).first()
    if not order:
        return
    try:
        if not settings.BOOKING_NOTIFICATION_EMAIL:
            raise RuntimeError("BOOKING_NOTIFICATION_EMAIL is not configured")
        build_order_email(order).send(fail_silently=False)
        Order.objects.filter(pk=order.pk).update(notification_status=Order.NotificationStatus.SENT)
    except Exception:
        logger.exception("Pickup order notification failed for order %s", order_id)
        Order.objects.filter(pk=order.pk).update(notification_status=Order.NotificationStatus.FAILED)


@csrf_exempt
@require_http_methods(["POST"])
def register(request):
    data = _payload(request)
    if data is None:
        return JsonResponse({"error": "The request could not be read."}, status=400)
    name = str(data.get("fullName", data.get("name", ""))).strip()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    if limited := ratelimit.check(request, ("register-ip", ratelimit.client_ip(request), 10, HOUR)):
        return limited
    errors = {}
    if not name or len(name) > 80:
        errors["fullName"] = "Enter a name of 1–80 characters."
    try:
        validate_email(email)
        if len(email) > 254:
            raise ValidationError("Email is too long.")
    except ValidationError:
        errors["email"] = "Enter a valid email address."
    if len(password) < 8 or len(password) > 128:
        errors["password"] = "Use a password between 8 and 128 characters."
    if errors:
        return JsonResponse({"error": "Please check the highlighted details.", "errors": errors}, status=400)
    if Account.objects.filter(email__iexact=email).exists():
        return JsonResponse({"error": "An account with this email already exists.", "errors": {"email": "This email is already registered."}}, status=409)
    account = Account.objects.create(email=email, full_name=name, password=make_password(password))
    return _auth_response(account, status=201)


@csrf_exempt
@require_http_methods(["POST"])
def login(request):
    data = _payload(request)
    if data is None:
        return JsonResponse({"error": "The request could not be read."}, status=400)
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    if limited := ratelimit.check(
        request,
        ("login-ip", ratelimit.client_ip(request), 20, 15 * MINUTE),
        ("login-email", email, 8, 15 * MINUTE),
    ):
        return limited
    account = Account.objects.filter(email__iexact=email, is_active=True).first()
    if account is None or not check_password(password, account.password):
        return JsonResponse({"error": "Email or password is incorrect."}, status=401)
    return _auth_response(account)


@csrf_exempt
@require_http_methods(["POST"])
@account_required
def logout(request):
    request.account_token.delete()
    return JsonResponse({"message": "Signed out."})


@csrf_exempt
@require_http_methods(["GET", "PATCH"])
@account_required
def me(request):
    account = request.account
    if request.method == "GET":
        return JsonResponse({"account": _account_json(account)})
    data = _payload(request)
    if data is None:
        return JsonResponse({"error": "The request could not be read."}, status=400)
    name = str(data.get("name", account.full_name)).strip()
    email = str(data.get("email", account.email)).strip().lower()
    phone = str(data.get("phone", account.phone)).strip()
    avatar = str(data.get("avatar", account.avatar))
    errors = {}
    if not name or len(name) > 80:
        errors["name"] = "Enter a name of 1–80 characters."
    email_valid = True
    try:
        validate_email(email)
        if len(email) > 254:
            raise ValidationError("Email is too long.")
    except ValidationError:
        errors["email"] = "Enter a valid email address."
        email_valid = False
    if email_valid and Account.objects.filter(email__iexact=email).exclude(pk=account.pk).exists():
        errors["email"] = "This email is already registered."
    if phone and (len(phone) > 24 or not re.fullmatch(r"\+?[\d .()-]{8,24}", phone) or sum(char.isdigit() for char in phone) not in range(8, 16)):
        errors["phone"] = "Enter a phone number with 8–15 digits."
    if avatar not in Account.Avatar.values:
        errors["avatar"] = "Choose a valid avatar."
    if errors:
        return JsonResponse({"error": "Please check the highlighted details.", "errors": errors}, status=400)
    account.full_name, account.email, account.phone, account.avatar = name, email, phone, avatar
    account.save(update_fields=("full_name", "email", "phone", "avatar", "updated_at"))
    return JsonResponse({"account": _account_json(account)})


@csrf_exempt
@require_http_methods(["GET", "PATCH"])
@account_required
def preferences(request):
    account = request.account
    if request.method == "GET":
        return JsonResponse({"preferences": {"compact": account.compact_dashboard, "examples": False}})
    data = _payload(request)
    if data is None or not isinstance(data.get("compact"), bool):
        return JsonResponse({"error": "compact must be true or false."}, status=400)
    account.compact_dashboard = data["compact"]
    account.save(update_fields=("compact_dashboard", "updated_at"))
    return JsonResponse({"preferences": {"compact": account.compact_dashboard, "examples": False}})


@csrf_exempt
@require_http_methods(["GET", "PUT"])
@account_required
def favorites(request):
    account = request.account
    if request.method == "GET":
        return JsonResponse({"items": list(account.favorites.order_by("slug").values_list("slug", flat=True))})
    data = _payload(request)
    ids = data.get("items") if data else None
    if not isinstance(ids, list) or len(ids) > 300 or not all(isinstance(item, str) for item in ids):
        return JsonResponse({"error": "items must be a list of menu item IDs."}, status=400)
    valid = set(MenuItem.objects.filter(is_available=True, slug__in=ids).values_list("slug", flat=True))
    if valid != set(ids):
        return JsonResponse({"error": "One or more menu items are unavailable."}, status=400)
    account.favorites.set(MenuItem.objects.filter(slug__in=ids))
    return JsonResponse({"items": list(account.favorites.order_by("slug").values_list("slug", flat=True))})


def _choice_catalog():
    """Current sellable cart choices, with prices sourced from the menu database."""
    choices = {}
    for category in build_menu():
        acai_options = []
        for column in category["columns"]:
            if column["kind"] == "pricing":
                for group_index, group in enumerate(column["groups"]):
                    for row_index, row in enumerate(group["rows"]):
                        acai_options.append((f"size-{group_index}-{row_index}", f"{group['title']} · {row['label']}", row["priceCents"]))
        for column in category["columns"]:
            if column["kind"] != "list":
                continue
            for item in column["items"]:
                if item["kind"] == "std":
                    item_choices = [("standard", "", item["priceCents"])]
                elif item["kind"] == "wine":
                    item_choices = [(key, label, item[f"{key}Cents"]) for key, label in (("glass", "Glass"), ("bottle", "Bottle")) if item[f"{key}Cents"] is not None]
                else:
                    item_choices = acai_options
                for choice_id, label, cents in item_choices:
                    choices[f"{item['id']}:{choice_id}"] = {
                        "key": f"{item['id']}:{choice_id}", "itemId": item["id"], "category": category["id"],
                        "name": item["name"], "label": label, "cents": cents,
                    }
    return choices


def _cart_json(account):
    choices = _choice_catalog()
    items, lines = {}, []
    for row in account.cart_items.select_related("item"):
        key = f"{row.item.slug}:{row.choice_id}"
        choice = choices.get(key)
        if not choice:
            continue
        items[key] = row.quantity
        lines.append({**choice, "quantity": row.quantity, "subtotal": choice["cents"] * row.quantity})
    return {"items": items, "lines": lines}


@csrf_exempt
@require_http_methods(["GET", "PUT", "DELETE"])
@account_required
def cart(request):
    account = request.account
    if request.method == "GET":
        return JsonResponse(_cart_json(account))
    if request.method == "DELETE":
        account.cart_items.all().delete()
        return JsonResponse({"items": {}, "lines": []})
    data = _payload(request)
    items = data.get("items") if data else None
    if not isinstance(items, dict) or len(items) > 100:
        return JsonResponse({"error": "items must be a map of menu choice IDs to quantities."}, status=400)
    catalog = _choice_catalog()
    parsed = []
    for key, quantity in items.items():
        if key not in catalog or not isinstance(quantity, int) or isinstance(quantity, bool) or not 1 <= quantity <= 99:
            return JsonResponse({"error": f"Invalid cart choice or quantity: {key}."}, status=400)
        item_id, choice_id = key.rsplit(":", 1)
        item = MenuItem.objects.filter(slug=item_id, is_available=True).first()
        if item is None:
            return JsonResponse({"error": f"Menu item is no longer available: {item_id}."}, status=400)
        parsed.append((item, choice_id, quantity))
    with transaction.atomic():
        account.cart_items.all().delete()
        CartItem.objects.bulk_create([CartItem(account=account, item=item, choice_id=choice_id, quantity=quantity) for item, choice_id, quantity in parsed])
    return JsonResponse(_cart_json(account))


def _order_json(order):
    return {
        "id": str(order.request_id), "date": order.created_at.date().isoformat(), "createdAt": order.created_at.isoformat(),
        "status": order.status, "statusLabel": order.get_status_display(), "totalCents": order.total_cents,
        "subtotalCents": order.subtotal_cents, "rewardCents": order.reward_cents, "items": order.lines,
    }


@csrf_exempt
@require_http_methods(["GET", "POST"])
@account_required
def orders(request):
    account = request.account
    if request.method == "GET":
        return JsonResponse({"orders": [_order_json(order) for order in account.orders.all()]})
    data = _payload(request)
    if data is None:
        return JsonResponse({"error": "The request could not be read."}, status=400)
    try:
        request_id = str(data.get("requestId", ""))
        import uuid
        request_uuid = uuid.UUID(request_id) if request_id else None
    except (ValueError, TypeError, AttributeError):
        return JsonResponse({"error": "Invalid request id."}, status=400)
    if request_uuid:
        existing = Order.objects.filter(request_id=request_uuid).first()
        if existing:
            if existing.account_id != account.pk:
                return JsonResponse({"error": "This request id has already been used."}, status=409)
            return JsonResponse({"order": _order_json(existing)}, status=200)
    cart_data = _cart_json(account)
    if not cart_data["lines"]:
        return JsonResponse({"error": "Your bag is empty."}, status=400)
    notes = str(data.get("notes", "")).strip()
    if len(notes) > 1000:
        return JsonResponse({"error": "Order notes can be up to 1,000 characters."}, status=400)
    subtotal = sum(line["subtotal"] for line in cart_data["lines"])
    use_reward = data.get("useReward") is True
    with transaction.atomic():
        account = Account.objects.select_for_update().get(pk=account.pk)
        if request_uuid:
            existing = Order.objects.filter(request_id=request_uuid).first()
            if existing:
                if existing.account_id != account.pk:
                    return JsonResponse({"error": "This request id has already been used."}, status=409)
                return JsonResponse({"order": _order_json(existing)}, status=200)
        reward_balance = account.loyalty_entries.aggregate(total=Sum("amount_cents_delta"))["total"] or 0
        reward = min(subtotal, reward_balance) if use_reward else 0
        order = Order.objects.create(
            request_id=request_uuid or Order._meta.get_field("request_id").get_default(), account=account,
            subtotal_cents=subtotal, reward_cents=reward, total_cents=subtotal - reward,
            lines=cart_data["lines"], notes=notes,
        )
        if reward:
            LoyaltyEntry.objects.create(account=account, order=order, kind=LoyaltyEntry.Kind.REWARD_REDEEMED,
                amount_cents_delta=-reward, description=f"Reward credit used on order {str(order.request_id)[:8]}.")
        account.cart_items.all().delete()
        transaction.on_commit(lambda: _send_order_notification(order.pk))
    return JsonResponse({"order": _order_json(order), "message": "Order request received. The venue will confirm it; payment is due at pickup."}, status=201)


@csrf_exempt
@require_http_methods(["GET"])
@account_required
def reservations(request):
    rows = BookingRequest.objects.filter(account=request.account)
    return JsonResponse({"reservations": [{
        "id": str(row.request_id), "date": row.date.isoformat(), "time": row.time.strftime("%H:%M"),
        "guests": row.guests, "status": row.get_status_display(), "notes": row.notes,
    } for row in rows]})


@csrf_exempt
@require_http_methods(["GET"])
@account_required
def rewards(request):
    account = request.account
    program = LoyaltyProgram.objects.filter(pk=1).first()
    ledger = account.loyalty_entries.all()
    points = ledger.aggregate(total=Sum("points_delta"))["total"] or 0
    credit = ledger.aggregate(total=Sum("amount_cents_delta"))["total"] or 0
    return JsonResponse({
        "program": None if program is None else {
            "active": program.is_active, "pointsPerOrder": program.points_per_order,
            "pointsForReward": program.points_for_reward, "rewardCents": program.reward_cents,
        },
        "points": points, "rewardBalanceCents": credit,
        "entries": [{"kind": entry.kind, "points": entry.points_delta, "amountCents": entry.amount_cents_delta,
                     "description": entry.description, "createdAt": entry.created_at.isoformat()} for entry in ledger[:50]],
    })


@csrf_exempt
@require_http_methods(["GET"])
def loyalty_program(request):
    program = LoyaltyProgram.objects.filter(pk=1).first()
    if not program:
        return JsonResponse({"active": False, "pointsPerOrder": 0, "pointsForReward": 0, "rewardCents": 0})
    return JsonResponse({
        "active": program.is_active, "pointsPerOrder": program.points_per_order,
        "pointsForReward": program.points_for_reward, "rewardCents": program.reward_cents,
    })


@csrf_exempt
@require_http_methods(["GET"])
@account_required
def dashboard(request):
    account = request.account
    reservation_rows = BookingRequest.objects.filter(account=account)
    program = LoyaltyProgram.objects.filter(pk=1).first()
    ledger = account.loyalty_entries.all()
    return JsonResponse({
        "account": _account_json(account),
        "preferences": {"compact": account.compact_dashboard, "examples": False},
        "favorites": list(account.favorites.order_by("slug").values_list("slug", flat=True)),
        "cart": _cart_json(account),
        "orders": [_order_json(order) for order in account.orders.all()],
        "reservations": [{
            "id": str(row.request_id), "date": row.date.isoformat(), "time": row.time.strftime("%H:%M"),
            "guests": row.guests, "status": row.get_status_display(), "notes": row.notes,
        } for row in reservation_rows],
        "rewards": {
            "program": None if program is None else {"active": program.is_active, "pointsPerOrder": program.points_per_order,
                "pointsForReward": program.points_for_reward, "rewardCents": program.reward_cents},
            "points": ledger.aggregate(total=Sum("points_delta"))["total"] or 0,
            "rewardBalanceCents": ledger.aggregate(total=Sum("amount_cents_delta"))["total"] or 0,
            "entries": [{"kind": entry.kind, "points": entry.points_delta, "amountCents": entry.amount_cents_delta,
                         "description": entry.description, "createdAt": entry.created_at.isoformat()} for entry in ledger[:20]],
        },
    })


@csrf_exempt
@require_http_methods(["POST"])
def request_password_reset(request):
    data = _payload(request)
    email = str((data or {}).get("email", "")).strip().lower()
    if limited := ratelimit.check(
        request,
        ("reset-request-ip", ratelimit.client_ip(request), 10, HOUR),
        ("reset-request-email", email, 3, HOUR),
    ):
        return limited
    account = Account.objects.filter(email__iexact=email, is_active=True).first()
    if account:
        code = f"{secrets.randbelow(1_000_000):06d}"
        digest = token_digest(code)
        while PasswordResetToken.objects.filter(token_hash=digest).exists():
            code = f"{secrets.randbelow(1_000_000):06d}"
            digest = token_digest(code)
        now = timezone.now()
        PasswordResetToken.objects.filter(account=account, used_at__isnull=True).update(used_at=now)
        PasswordResetToken.objects.create(
            account=account,
            token_hash=digest,
            expires_at=now + timedelta(minutes=10),
        )
        try:
            build_password_reset_email(account, code).send(fail_silently=False)
        except Exception:
            logger.exception("Password reset email failed")
    return JsonResponse({"message": "If an account exists for that email, a six-digit reset code has been sent."})


@csrf_exempt
@require_http_methods(["POST"])
def reset_password(request):
    data = _payload(request)
    email = str((data or {}).get("email", "")).strip().lower()
    code = str((data or {}).get("code", "")).strip()
    password = str((data or {}).get("password", ""))
    # Caps guesses per email across every code requested, on top of 5 tries per code.
    if limited := ratelimit.check(
        request,
        ("reset-confirm-ip", ratelimit.client_ip(request), 30, HOUR),
        ("reset-confirm-email", email, 10, HOUR),
    ):
        return limited
    if not email or not re.fullmatch(r"\d{6}", code):
        return JsonResponse({"error": "Enter the email address and six-digit code."}, status=400)
    if len(password) < 8 or len(password) > 128:
        return JsonResponse({"error": "Use a password between 8 and 128 characters."}, status=400)
    reset = PasswordResetToken.objects.select_related("account").filter(
        account__email__iexact=email,
        expires_at__gt=timezone.now(),
        used_at__isnull=True,
    ).order_by("-created_at").first()
    if reset is None:
        return JsonResponse({"error": "This code is invalid or has expired. Request a new code."}, status=400)
    if reset.attempts >= 5:
        return JsonResponse({"error": "Too many incorrect codes. Request a new code."}, status=400)
    if not secrets.compare_digest(reset.token_hash, token_digest(code)):
        PasswordResetToken.objects.filter(pk=reset.pk).update(attempts=F("attempts") + 1)
        return JsonResponse({"error": "This code is invalid or has expired. Check it and try again."}, status=400)
    with transaction.atomic():
        account = reset.account
        account.password = make_password(password)
        account.save(update_fields=("password", "updated_at"))
        reset.used_at = timezone.now()
        reset.save(update_fields=("used_at",))
        account.tokens.all().delete()
    return JsonResponse({"message": "Password updated. Please sign in."})
