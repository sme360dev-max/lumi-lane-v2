from datetime import time, timedelta
from unittest import mock

from django.core import mail
from django.core.mail import EmailMultiAlternatives
from django.test import TestCase, override_settings
from django.utils import timezone

from .email import BrevoEmailBackend
from .models import BookingRequest
from .notifications import build_booking_email
from .views import _send_booking_notification

SETTINGS = {
    "BOOKING_NOTIFICATION_EMAIL": "venue@example.com",
    "DEFAULT_FROM_EMAIL": "Lumi Lane <no-reply@example.com>",
    "PUBLIC_BACKEND_URL": "https://api.example.com",
    "EMAIL_BACKEND": "django.core.mail.backends.locmem.EmailBackend",
}


@override_settings(**SETTINGS)
class BookingEmailTests(TestCase):
    def setUp(self):
        self.booking = BookingRequest.objects.create(
            name="Ava <Lee>", email="ava@example.com", phone="0400 123 456", guests=3,
            date=timezone.localdate() + timedelta(days=1), time=time(10, 0), notes="High chair\nWindow seat",
        )

    def test_html_and_text_versions(self):
        message = build_booking_email(self.booking)
        self.assertIsInstance(message, EmailMultiAlternatives)
        self.assertEqual(message.to, ["venue@example.com"])
        self.assertEqual(message.reply_to, ["ava@example.com"])
        self.assertIn("Ava <Lee>", message.subject)
        self.assertIn("10:00 AM", message.subject)
        self.assertIn("3 guests", message.subject)
        self.assertIn("(tomorrow)", message.body)
        html, mimetype = message.alternatives[0][0], message.alternatives[0][1]
        self.assertEqual(mimetype, "text/html")
        self.assertIn("Ava &lt;Lee&gt;", html)  # guest input is escaped
        self.assertIn("High chair<br>Window seat", html)
        self.assertIn(f"https://api.example.com/admin/bookings/bookingrequest/{self.booking.pk}/change/", html)
        self.assertIn('href="tel:0400123456"', html)

    def test_notification_marks_sent(self):
        _send_booking_notification(self.booking.pk)
        self.assertEqual(len(mail.outbox), 1)
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.notification_status, BookingRequest.NotificationStatus.SENT)

    @override_settings(BREVO_API_KEY="test-key")
    def test_brevo_payload_has_html(self):
        message = build_booking_email(self.booking)
        with mock.patch("bookings.email.requests.post") as post:
            post.return_value.raise_for_status.return_value = None
            self.assertEqual(BrevoEmailBackend().send_messages([message]), 1)
        payload = post.call_args.kwargs["json"]
        self.assertIn("<html", payload["htmlContent"])
        self.assertIn("Ava <Lee>", payload["textContent"])
        self.assertEqual(payload["replyTo"], {"email": "ava@example.com"})

    def test_when_label(self):
        self.booking.date = timezone.localdate() + timedelta(days=5)  # Adelaide, not this machine
        self.assertIn("(in 5 days)", build_booking_email(self.booking).body)
