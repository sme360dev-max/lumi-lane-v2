import json
from datetime import date, time, timedelta

from django.contrib.auth.hashers import make_password
from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone

from bookings.models import BookingRequest

from .admin import OrderAdminForm
from .auth import issue_token
from .emails import build_order_email, build_password_reset_email
from .models import Account, Order


def post(client, url, data, **extra):
    return client.post(url, json.dumps(data), content_type="application/json", **extra)


class ReservationPrivacyTests(TestCase):
    def test_bookings_matching_only_by_email_are_hidden(self):
        """Registering with someone else's email must not reveal their bookings."""
        BookingRequest.objects.create(
            name="Victim", email="victim@example.com", phone="0400 000 000", guests=2,
            date=timezone.localdate() + timedelta(days=1), time=time(10, 0), notes="Private note",
        )
        response = post(self.client, "/api/account/register/", {
            "fullName": "Attacker", "email": "victim@example.com", "password": "long-password-1",
        })
        token = response.json()["token"]
        auth = {"HTTP_AUTHORIZATION": f"Bearer {token}"}
        self.assertEqual(self.client.get("/api/account/reservations/", **auth).json()["reservations"], [])
        self.assertEqual(self.client.get("/api/account/dashboard/", **auth).json()["reservations"], [])

    def test_bookings_made_while_signed_in_are_listed(self):
        account = Account.objects.create(email="me@example.com", full_name="Me", password=make_password("pw-123456"))
        token = issue_token(account)
        auth = {"HTTP_AUTHORIZATION": f"Bearer {token}"}
        response = post(self.client, "/api/bookings/", {
            "name": "Me", "email": "me@example.com", "phone": "0400 111 222", "guests": "2",
            "date": (timezone.localdate() + timedelta(days=2)).isoformat(), "time": "11:00",
        }, **auth)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(self.client.get("/api/account/reservations/", **auth).json()["reservations"]), 1)


class RateLimitTests(TestCase):
    def test_login_is_limited_per_email(self):
        for _ in range(8):
            response = post(self.client, "/api/account/login/", {"email": "a@example.com", "password": "wrong"})
            self.assertEqual(response.status_code, 401)
        response = post(self.client, "/api/account/login/", {"email": "a@example.com", "password": "wrong"})
        self.assertEqual(response.status_code, 429)
        self.assertIn("Retry-After", response)
        # A different address from the same visitor still works until the IP limit.
        self.assertEqual(post(self.client, "/api/account/login/", {"email": "b@example.com", "password": "x"}).status_code, 401)

    def test_reset_requests_are_limited_per_email(self):
        Account.objects.create(email="c@example.com", full_name="Cee", password=make_password("pw-123456"))
        for _ in range(3):
            self.assertEqual(post(self.client, "/api/account/password-reset/", {"email": "c@example.com"}).status_code, 200)
        self.assertEqual(post(self.client, "/api/account/password-reset/", {"email": "c@example.com"}).status_code, 429)
        self.assertEqual(len(mail.outbox), 3)

    def test_reset_code_guesses_are_capped_across_codes(self):
        for _ in range(10):
            post(self.client, "/api/account/password-reset/confirm/", {"email": "d@example.com", "code": "000000", "password": "new-password-1"})
        response = post(self.client, "/api/account/password-reset/confirm/", {"email": "d@example.com", "code": "000000", "password": "new-password-1"})
        self.assertEqual(response.status_code, 429)

    def test_booking_is_limited_but_retries_are_not(self):
        base = {"name": "Guest", "phone": "0400 123 456", "guests": "2", "time": "10:00",
                "date": (timezone.localdate() + timedelta(days=1)).isoformat()}
        first = post(self.client, "/api/bookings/", {**base, "email": "g@example.com", "requestId": "bc3d12d0-99e4-4a20-9c52-00000000aaaa"})
        self.assertEqual(first.status_code, 201)
        for _ in range(3):
            self.assertEqual(post(self.client, "/api/bookings/", {**base, "email": "g@example.com"}).status_code, 201)
        self.assertEqual(post(self.client, "/api/bookings/", {**base, "email": "g@example.com"}).status_code, 429)
        # Re-sending the first request (same id) returns it without counting as new.
        retry = post(self.client, "/api/bookings/", {**base, "email": "g@example.com", "requestId": "bc3d12d0-99e4-4a20-9c52-00000000aaaa"})
        self.assertEqual(retry.status_code, 200)
        self.assertEqual(BookingRequest.objects.count(), 4)

    @override_settings(RATE_LIMITS_ENABLED=False)
    def test_can_be_disabled(self):
        for _ in range(12):
            self.assertEqual(post(self.client, "/api/account/login/", {"email": "a@example.com", "password": "x"}).status_code, 401)


class OrderStatusTests(TestCase):
    def setUp(self):
        self.account = Account.objects.create(email="o@example.com", full_name="Olive", password="!")

    def form(self, order, status):
        data = {"status": status, "notes": "", "notification_status": order.notification_status,
                "subtotal_cents": order.subtotal_cents, "reward_cents": order.reward_cents,
                "total_cents": order.total_cents, "lines": json.dumps(order.lines), "account": self.account.pk}
        return OrderAdminForm(data=data, instance=order)

    def test_cancelled_order_cannot_be_reopened(self):
        order = Order.objects.create(account=self.account, status=Order.Status.CANCELLED, lines=[], total_cents=0)
        for status in (Order.Status.COMPLETED, Order.Status.RECEIVED):
            form = self.form(order, status)
            self.assertFalse(form.is_valid())
            self.assertIn("cannot be reopened", str(form.errors))

    def test_open_order_can_be_cancelled(self):
        order = Order.objects.create(account=self.account, status=Order.Status.RECEIVED, lines=[], total_cents=0)
        form = self.form(order, Order.Status.CANCELLED)
        form.is_valid()
        self.assertNotIn("cannot be reopened", str(form.errors))


@override_settings(BOOKING_NOTIFICATION_EMAIL="venue@example.com", PUBLIC_BACKEND_URL="https://api.example.com",
                   PUBLIC_WEBSITE_URL="https://site.example.com")
class EmailTemplateTests(TestCase):
    def setUp(self):
        self.account = Account.objects.create(email="kim@example.com", full_name="Kim Ho", phone="0400 999 888", password="!")

    def test_order_email_has_html_and_text(self):
        order = Order.objects.create(
            account=self.account, subtotal_cents=2450, reward_cents=500, total_cents=1950, notes="No sugar <please>",
            lines=[{"name": "Flat White", "label": "Large", "quantity": 2, "cents": 600, "subtotal": 1200},
                   {"name": "Smashed Avo", "label": "", "quantity": 1, "cents": 1250, "subtotal": 1250}],
        )
        message = build_order_email(order)
        html = message.alternatives[0][0]
        self.assertEqual(message.to, ["venue@example.com"])
        self.assertEqual(message.reply_to, ["kim@example.com"])
        self.assertIn("LUMI&nbsp;LANE", html)
        self.assertIn("Flat White", html)
        self.assertIn("&minus;$5.00", html)
        self.assertIn("$19.50 AUD", html)
        self.assertIn("No sugar &lt;please&gt;", html)  # customer text is escaped
        self.assertIn(f"/admin/accounts/order/{order.pk}/change/", html)
        self.assertIn("2 x Flat White (Large)", message.body)
        self.assertIn("Due at pickup: $19.50 AUD", message.body)

    def test_reset_email_has_code_in_html_and_text(self):
        message = build_password_reset_email(self.account, "123456")
        html = message.alternatives[0][0]
        self.assertIn("123456", html)
        self.assertIn("Hi Kim,", html)
        self.assertIn("https://site.example.com/reset-password/", html)
        self.assertIn("123456", message.body)

    def test_booking_email_uses_shared_base(self):
        from bookings.notifications import build_booking_email

        booking = BookingRequest.objects.create(
            name="Ava", email="ava@example.com", phone="0400 000 111", guests=3,
            date=date.today() + timedelta(days=1), time=time(9, 30),
        )
        html = build_booking_email(booking).alternatives[0][0]
        self.assertIn("LUMI&nbsp;LANE", html)
        self.assertIn("New table request", html)
        self.assertIn("Shop 9, 163/169 Fosters Rd", html)
