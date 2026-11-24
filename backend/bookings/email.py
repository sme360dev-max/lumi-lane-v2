import logging
from email.utils import parseaddr

import requests
from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend

logger = logging.getLogger(__name__)


class BrevoEmailBackend(BaseEmailBackend):
    """Send Django EmailMessage objects through Brevo's HTTPS API."""

    def send_messages(self, email_messages):
        if not email_messages:
            return 0
        if not settings.BREVO_API_KEY:
            raise RuntimeError("BREVO_API_KEY is not configured")

        sent = 0
        for message in email_messages:
            sender_name, sender_email = parseaddr(message.from_email or settings.DEFAULT_FROM_EMAIL)
            payload = {
                "sender": {"name": sender_name or "Lumi Lane", "email": sender_email},
                "to": [{"email": address} for address in message.to],
                "subject": message.subject,
                "textContent": message.body,
            }
            # EmailMultiAlternatives: send the HTML version too; mail apps pick the one they can show.
            for alternative in getattr(message, "alternatives", None) or ():
                content, mimetype = alternative[0], alternative[1]
                if mimetype == "text/html":
                    payload["htmlContent"] = content
            if message.cc:
                payload["cc"] = [{"email": address} for address in message.cc]
            if message.bcc:
                payload["bcc"] = [{"email": address} for address in message.bcc]
            if message.reply_to:
                payload["replyTo"] = {"email": message.reply_to[0]}

            try:
                response = requests.post(
                    settings.BREVO_API_URL,
                    headers={"api-key": settings.BREVO_API_KEY, "accept": "application/json"},
                    json=payload,
                    timeout=12,
                )
                response.raise_for_status()
                sent += 1
            except requests.RequestException:
                logger.exception("Brevo failed to send an email")
                if not self.fail_silently:
                    raise
        return sent
