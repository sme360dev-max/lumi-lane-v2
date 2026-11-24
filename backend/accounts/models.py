import uuid
from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models


class Account(models.Model):
    class Avatar(models.TextChoices):
        CLAY = "clay", "Terracotta"
        ESPRESSO = "espresso", "Espresso"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, db_index=True)
    password = models.CharField(max_length=256)
    full_name = models.CharField(max_length=80)
    phone = models.CharField(max_length=24, blank=True)
    avatar = models.CharField(max_length=12, choices=Avatar.choices, default=Avatar.CLAY)
    compact_dashboard = models.BooleanField(default=False)
    favorites = models.ManyToManyField("menu.MenuItem", blank=True, related_name="favorited_by")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("email",)

    def __str__(self):
        return self.email


class AccountToken(models.Model):
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="tokens")
    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)


class PasswordResetToken(models.Model):
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="password_resets")
    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    used_at = models.DateTimeField(null=True, blank=True)
    attempts = models.PositiveSmallIntegerField(default=0)


class CartItem(models.Model):
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="cart_items")
    item = models.ForeignKey("menu.MenuItem", on_delete=models.CASCADE)
    choice_id = models.CharField(max_length=40)
    quantity = models.PositiveSmallIntegerField()
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("account", "item", "choice_id"), name="unique_account_cart_choice")]


class Order(models.Model):
    class NotificationStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        SENT = "sent", "Sent"
        FAILED = "failed", "Failed"

    class Status(models.TextChoices):
        RECEIVED = "received", "Received"
        ACCEPTED = "accepted", "Accepted"
        PREPARING = "preparing", "Preparing"
        READY = "ready", "Ready for pickup"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    request_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name="orders")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.RECEIVED, db_index=True)
    notification_status = models.CharField(max_length=12, choices=NotificationStatus.choices, default=NotificationStatus.PENDING)
    total_cents = models.PositiveIntegerField()
    subtotal_cents = models.PositiveIntegerField(default=0)
    reward_cents = models.PositiveIntegerField(default=0)
    lines = models.JSONField()
    notes = models.TextField(blank=True, max_length=1000)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"Order {self.request_id} · {self.account.email}"

    @property
    def total_display(self):
        return f"${self.total_cents // 100:,}.{self.total_cents % 100:02d} AUD"


class LoyaltyProgram(models.Model):
    """Singleton rule set edited by the venue in Django Admin."""

    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    is_active = models.BooleanField(default=True, verbose_name="Award stamps")
    points_per_order = models.PositiveSmallIntegerField(default=1, validators=[MinValueValidator(1)], verbose_name="Points per completed order")
    points_for_reward = models.PositiveSmallIntegerField(default=8, validators=[MinValueValidator(1)], verbose_name="Points needed for a reward")
    reward_amount = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal("20.00"), validators=[MinValueValidator(Decimal("0.01"))], verbose_name="Reward value (AUD)")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Loyalty program settings"
        verbose_name_plural = "Loyalty program settings"

    def __str__(self):
        return f"Loyalty: {self.points_for_reward} points → ${self.reward_amount:.2f} AUD"

    @property
    def reward_cents(self):
        return int(self.reward_amount * 100)

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)


class LoyaltyEntry(models.Model):
    class Kind(models.TextChoices):
        ORDER_POINTS = "order_points", "Order points"
        REWARD_GRANTED = "reward_granted", "Reward granted"
        REWARD_REDEEMED = "reward_redeemed", "Reward redeemed"
        REWARD_REFUNDED = "reward_refunded", "Reward restored"

    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="loyalty_entries")
    order = models.ForeignKey(Order, null=True, blank=True, on_delete=models.SET_NULL, related_name="loyalty_entries")
    kind = models.CharField(max_length=20, choices=Kind.choices)
    points_delta = models.IntegerField(default=0)
    amount_cents_delta = models.IntegerField(default=0)
    description = models.CharField(max_length=180)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ("-created_at",)
        constraints = [
            models.UniqueConstraint(fields=("order",), condition=models.Q(order__isnull=False, kind="order_points"), name="unique_order_points_entry"),
            models.UniqueConstraint(fields=("order",), condition=models.Q(order__isnull=False, kind="reward_redeemed"), name="unique_order_reward_redemption"),
            models.UniqueConstraint(fields=("order",), condition=models.Q(order__isnull=False, kind="reward_refunded"), name="unique_order_reward_refund"),
        ]


class RateLimit(models.Model):
    """Fixed-window request counter shared by every worker (see accounts/ratelimit.py)."""

    key = models.CharField(max_length=96, unique=True)
    window_start = models.DateTimeField(db_index=True)
    count = models.PositiveIntegerField(default=0)
