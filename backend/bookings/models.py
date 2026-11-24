import uuid

from django.db import models


class BookingRequest(models.Model):
    class Status(models.TextChoices):
        NEW = "new", "New"
        CONTACTED = "contacted", "Contacted"
        CONFIRMED = "confirmed", "Confirmed"
        CANCELLED = "cancelled", "Cancelled"

    class NotificationStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        SENT = "sent", "Sent"
        FAILED = "failed", "Failed"

    request_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    account = models.ForeignKey("accounts.Account", null=True, blank=True, on_delete=models.SET_NULL, related_name="reservations")
    name = models.CharField("Guest name", max_length=120)
    email = models.EmailField("Email address", max_length=254)
    phone = models.CharField("Phone number", max_length=40)
    guests = models.PositiveSmallIntegerField("Number of guests")
    date = models.DateField("Reservation date")
    time = models.TimeField("Arrival time")
    notes = models.TextField("Special requests", blank=True)
    status = models.CharField("Reservation status", max_length=16, choices=Status.choices, default=Status.NEW, db_index=True)
    notification_status = models.CharField(
        "Email notification", max_length=12, choices=NotificationStatus.choices, default=NotificationStatus.PENDING
    )
    submitted_at = models.DateTimeField("Submitted", auto_now_add=True, db_index=True)

    class Meta:
        ordering = ("-submitted_at",)
        verbose_name = "Table request"
        verbose_name_plural = "Table requests"

    def __str__(self):
        return f"{self.name} · {self.date:%d/%m/%Y} {self.time:%H:%M} ({self.guests} {'guest' if self.guests == 1 else 'guests'})"
