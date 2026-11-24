from django import forms
from django.contrib import admin
from django.db.models import Sum
from django.urls import reverse
from django.utils.html import format_html, format_html_join

from .models import Account, CartItem, LoyaltyEntry, LoyaltyProgram, Order


class OrderAdminForm(forms.ModelForm):
    class Meta:
        model = Order
        fields = "__all__"

    def clean(self):
        cleaned = super().clean()
        previous = Order.objects.filter(pk=self.instance.pk).values_list("status", flat=True).first() if self.instance.pk else None
        if previous == Order.Status.COMPLETED and cleaned.get("status") != Order.Status.COMPLETED:
            raise forms.ValidationError("A completed order cannot be moved back to an earlier status.")
        if previous == Order.Status.CANCELLED and cleaned.get("status") != Order.Status.CANCELLED:
            # Cancelling already returned any reward credit, so reopening would let it be spent twice.
            raise forms.ValidationError("A cancelled order cannot be reopened. Ask the customer to place a new order.")
        return cleaned


class LoyaltyProgramAdminForm(forms.ModelForm):
    class Meta:
        model = LoyaltyProgram
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["is_active"].help_text = "Turn off to pause all new points and rewards. Existing balances remain on customer accounts."
        self.fields["points_per_order"].help_text = "Points awarded when an order is marked Completed."
        self.fields["points_for_reward"].help_text = "Points exchanged for one reward. The reward value is set below."
        self.fields["reward_amount"].help_text = "AUD credit granted for each reward threshold reached."


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ("customer_summary", "loyalty_balance", "phone", "account_status", "created_at")
    list_filter = ("is_active", "created_at")
    search_fields = ("email", "full_name", "phone")
    list_display_links = ("customer_summary",)
    fieldsets = (
        ("Customer profile", {"fields": ("full_name", "email", "phone", "avatar")} ),
        ("Website account", {"fields": ("is_active", "compact_dashboard")} ),
        ("Account activity", {"fields": ("id", "created_at", "updated_at"), "classes": ("collapse",)}),
    )
    readonly_fields = ("id", "created_at", "updated_at")

    @admin.display(description="Customer", ordering="email")
    def customer_summary(self, obj):
        return format_html('<strong>{}</strong><span class="hv-cell-sub">{}</span>', obj.full_name or "Customer", obj.email)

    @admin.display(description="Points", ordering="loyalty_balance")
    def loyalty_balance(self, obj):
        points = obj.loyalty_balance or 0
        return format_html('<span class="hv-points hv-points-positive">{} pt{}</span>', points, "" if points == 1 else "s")

    @admin.display(description="Account", ordering="is_active")
    def account_status(self, obj):
        label, tone = ("Active", "good") if obj.is_active else ("Inactive", "quiet")
        return format_html('<span class="hv-chip hv-chip-{}">{}</span>', tone, label)

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(loyalty_balance=Sum("loyalty_entries__points_delta"))

    def has_add_permission(self, request):
        # Customer accounts are created through registration, not by staff without credentials.
        return False


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("order_reference", "customer_display", "status_display", "notification_display", "total_display", "created_at")
    list_filter = ("status", "notification_status", "created_at")
    search_fields = ("request_id", "account__email", "account__full_name")
    list_select_related = ("account",)
    list_display_links = ("order_reference",)
    readonly_fields = ("request_id", "account", "notification_status", "subtotal_display", "reward_display", "total_display", "items_display", "created_at", "updated_at")
    fieldsets = (
        ("Pickup order", {"fields": ("request_id", "account", "status", "notification_status")} ),
        ("Payment at pickup", {"fields": ("subtotal_display", "reward_display", "total_display")} ),
        ("Order details", {"fields": ("items_display", "notes")} ),
        ("Activity", {"fields": ("created_at", "updated_at"), "classes": ("collapse",)}),
    )
    form = OrderAdminForm

    @admin.display(description="Order", ordering="request_id")
    def order_reference(self, obj):
        return format_html('<span class="hv-code">#{}</span>', str(obj.request_id).split("-")[0].upper())

    @admin.display(description="Customer", ordering="account__email")
    def customer_display(self, obj):
        return format_html('<strong>{}</strong><span class="hv-cell-sub">{}</span>', obj.account.full_name or obj.account.email, obj.account.email)

    @admin.display(description="Status", ordering="status")
    def status_display(self, obj):
        tones = {"received": "warn", "accepted": "info", "preparing": "info", "ready": "good", "completed": "live", "cancelled": "bad"}
        return format_html('<span class="hv-chip hv-chip-{}">{}</span>', tones.get(obj.status, "quiet"), obj.get_status_display())

    @admin.display(description="Email", ordering="notification_status")
    def notification_display(self, obj):
        tone = "bad" if obj.notification_status == Order.NotificationStatus.FAILED else "quiet" if obj.notification_status == Order.NotificationStatus.PENDING else "good"
        return format_html('<span class="hv-chip hv-chip-{}">{}</span>', tone, obj.get_notification_status_display())

    @admin.display(description="Items ordered")
    def items_display(self, obj):
        if not obj.lines:
            return format_html('<span class="hv-muted">No item details recorded.</span>')
        rows = format_html_join(
            "", '<li><span><strong>{} × {}</strong><small>{}</small></span><b>{}</b></li>',
            ((line.get("quantity", 1), line.get("name", "Menu item"), line.get("label") or "Standard", f"${line.get('subtotal', 0) / 100:,.2f} AUD") for line in obj.lines),
        )
        return format_html('<ul class="hv-order-lines">{}</ul>', rows)

    @admin.display(description="Subtotal")
    def subtotal_display(self, obj):
        return f"${obj.subtotal_cents / 100:.2f} AUD"

    @admin.display(description="Reward credit")
    def reward_display(self, obj):
        return f"${obj.reward_cents / 100:.2f} AUD"

    @admin.display(description="Due at pickup")
    def total_display(self, obj):
        return f"${obj.total_cents / 100:.2f} AUD"

    def save_model(self, request, obj, form, change):
        previous_status = Order.objects.filter(pk=obj.pk).values_list("status", flat=True).first() if change else None
        from django.db import transaction
        with transaction.atomic():
            super().save_model(request, obj, form, change)
            if obj.status == Order.Status.COMPLETED and previous_status != Order.Status.COMPLETED:
                award_completed_order(obj)
            if obj.status == Order.Status.CANCELLED:
                restore_order_reward(obj)


@admin.register(LoyaltyProgram)
class LoyaltyProgramAdmin(admin.ModelAdmin):
    list_display = ("program_status", "earning_rule", "reward_rule", "updated_at")
    list_display_links = ("program_status",)
    fieldsets = (
        ("Program status", {"fields": ("is_active",), "description": "Pause or resume earning and redeeming points. Customer balances are retained."}),
        ("Earn points", {"fields": ("points_per_order",), "description": "Points are awarded only when staff mark an order Completed."}),
        ("Redeem a reward", {"fields": ("points_for_reward", "reward_amount"), "description": "Set how many points unlock a reward and its value in Australian dollars."}),
        ("Last updated", {"fields": ("updated_at",), "classes": ("collapse",)}),
    )
    readonly_fields = ("updated_at",)
    form = LoyaltyProgramAdminForm

    @admin.display(description="Status")
    def program_status(self, obj):
        tone, label = ("good", "Active") if obj.is_active else ("quiet", "Paused")
        return format_html('<span class="hv-chip hv-chip-{}">{}</span>', tone, label)

    @admin.display(description="Earn", ordering="points_per_order")
    def earning_rule(self, obj):
        return format_html('<strong>{} point{}</strong><span class="hv-cell-sub">per completed order</span>', obj.points_per_order, "" if obj.points_per_order == 1 else "s")

    @admin.display(description="Reward", ordering="points_for_reward")
    def reward_rule(self, obj):
        amount = f"${obj.reward_amount:,.2f} AUD"
        return format_html('<strong>{}</strong><span class="hv-cell-sub">for {} points</span>', amount, obj.points_for_reward)

    def has_add_permission(self, request):
        return not LoyaltyProgram.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(LoyaltyEntry)
class LoyaltyEntryAdmin(admin.ModelAdmin):
    list_display = ("activity_display", "customer_display", "points_display", "amount_display", "order_display", "created_at")
    list_filter = ("kind", "created_at")
    search_fields = ("account__email", "account__full_name", "description")
    list_select_related = ("account", "order")
    list_display_links = ("activity_display",)
    date_hierarchy = "created_at"
    fieldsets = (
        ("Loyalty activity", {"fields": ("kind", "description")} ),
        ("Customer and order", {"fields": ("account", "order")} ),
        ("Balance change", {"fields": ("points_delta", "amount_cents_delta")} ),
        ("Recorded", {"fields": ("created_at",)}),
    )
    readonly_fields = ("account", "order", "kind", "points_delta", "amount_cents_delta", "description", "created_at")

    def has_add_permission(self, request):
        return False

    @admin.display(description="Reward value (AUD)")
    def amount_display(self, obj):
        if not obj.amount_cents_delta:
            return format_html('<span class="hv-muted">—</span>')
        cents = abs(obj.amount_cents_delta)
        amount = f"${cents // 100:,}.{cents % 100:02d} AUD"
        return format_html('<span class="hv-money">{}</span>', amount)

    @admin.display(description="Activity", ordering="kind")
    def activity_display(self, obj):
        tones = {"order_points": "good", "reward_granted": "info", "reward_redeemed": "warn", "reward_refunded": "quiet"}
        return format_html('<span class="hv-chip hv-chip-{}">{}</span><span class="hv-cell-sub">{}</span>', tones.get(obj.kind, "quiet"), obj.get_kind_display(), obj.description)

    @admin.display(description="Customer", ordering="account__email")
    def customer_display(self, obj):
        return format_html('<strong>{}</strong><span class="hv-cell-sub">{}</span>', obj.account.full_name or obj.account.email, obj.account.email)

    @admin.display(description="Points", ordering="points_delta")
    def points_display(self, obj):
        if not obj.points_delta:
            return format_html('<span class="hv-muted">—</span>')
        tone = "positive" if obj.points_delta > 0 else "negative"
        prefix = "+" if obj.points_delta > 0 else "−"
        return format_html('<span class="hv-points hv-points-{}">{}{} point{}</span>', tone, prefix, abs(obj.points_delta), "" if abs(obj.points_delta) == 1 else "s")

    @admin.display(description="Order")
    def order_display(self, obj):
        if not obj.order_id:
            return format_html('<span class="hv-muted">—</span>')
        url = reverse("admin:accounts_order_change", args=(obj.order_id,))
        return format_html('<a class="hv-code" href="{}">#{}</a>', url, str(obj.order.request_id).split("-")[0].upper())

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("account", "order")

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(CartItem)
class CartItemAdmin(admin.ModelAdmin):
    list_display = ("account", "item", "choice_id", "quantity", "updated_at")
    search_fields = ("account__email", "item__name", "item__slug")
    readonly_fields = ("account", "item", "choice_id", "quantity", "updated_at")

    def has_add_permission(self, request):
        return False


def award_completed_order(order):
    if LoyaltyEntry.objects.filter(order=order, kind=LoyaltyEntry.Kind.ORDER_POINTS).exists():
        return
    program = LoyaltyProgram.objects.filter(pk=1, is_active=True).first()
    if not program or program.points_for_reward < 1 or program.points_per_order < 1 or program.reward_cents < 1:
        return
    LoyaltyEntry.objects.create(
        account=order.account, order=order, kind=LoyaltyEntry.Kind.ORDER_POINTS,
        points_delta=program.points_per_order,
        description=f"{program.points_per_order} point(s) for completed order {str(order.request_id)[:8]}.",
    )
    current_points = order.account.loyalty_entries.aggregate(total=Sum("points_delta"))["total"] or 0
    while current_points >= program.points_for_reward:
        LoyaltyEntry.objects.create(
            account=order.account, order=order, kind=LoyaltyEntry.Kind.REWARD_GRANTED,
            points_delta=-program.points_for_reward, amount_cents_delta=program.reward_cents,
            description=f"${program.reward_cents / 100:.2f} AUD reward for {program.points_for_reward} points.",
        )
        current_points -= program.points_for_reward


def restore_order_reward(order):
    redeemed = LoyaltyEntry.objects.filter(order=order, kind=LoyaltyEntry.Kind.REWARD_REDEEMED).first()
    if redeemed and not LoyaltyEntry.objects.filter(order=order, kind=LoyaltyEntry.Kind.REWARD_REFUNDED).exists():
        LoyaltyEntry.objects.create(
            account=order.account, order=order, kind=LoyaltyEntry.Kind.REWARD_REFUNDED,
            amount_cents_delta=-redeemed.amount_cents_delta,
            description=f"Reward credit restored after order {str(order.request_id)[:8]} was cancelled.",
        )
