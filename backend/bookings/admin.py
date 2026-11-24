from django.contrib import admin, messages
from django.utils.formats import date_format, time_format
from django.utils.html import format_html

from .models import BookingRequest
from .views import _send_booking_notification

STATUS_CHIPS = {
    "new": "hv-chip-pending",
    "contacted": "hv-chip-approved",
    "confirmed": "hv-chip-approved",
    "cancelled": "hv-chip-rejected",
}
EMAIL_CHIPS = {"pending": "hv-chip-pending", "sent": "hv-chip-approved", "failed": "hv-chip-rejected"}


@admin.action(description="Retry failed email notifications")
def resend_failed_notifications(modeladmin, request, queryset):
    failed = list(queryset.filter(notification_status=BookingRequest.NotificationStatus.FAILED).values_list("pk", flat=True))
    for booking_id in failed:
        _send_booking_notification(booking_id)
    sent = BookingRequest.objects.filter(pk__in=failed, notification_status=BookingRequest.NotificationStatus.SENT).count()
    if not failed:
        modeladmin.message_user(request, "None of the selected requests had a failed email.", messages.INFO)
    else:
        level = messages.SUCCESS if sent == len(failed) else messages.WARNING
        modeladmin.message_user(request, f"Resent {sent} of {len(failed)} failed notifications.", level)


@admin.register(BookingRequest)
class BookingRequestAdmin(admin.ModelAdmin):
    actions = (resend_failed_notifications,)
    add_label = "Add a phone booking"
    list_display = ("guest_summary", "visit_summary", "party_size", "status_badge", "email_badge")
    list_display_links = ("guest_summary",)
    list_filter = ("status", "notification_status", "date")
    search_fields = ("name", "email", "phone")
    date_hierarchy = "date"
    ordering = ("-submitted_at",)
    list_per_page = 30
    readonly_fields = ("request_id", "submitted_at", "notification_status")
    fieldsets = (
        ("Guest details", {"fields": ("account", "name", "email", "phone", "guests")}),
        ("Reservation", {"fields": (("date", "time"), "status", "notes")}),
        ("Request tracking", {"fields": ("request_id", "notification_status", "submitted_at")}),
    )

    @admin.display(description="Guest", ordering="name")
    def guest_summary(self, obj):
        return format_html('<span class="hv-record-primary">{}</span><span class="hv-record-secondary">{}</span>', obj.name, obj.email)

    @admin.display(description="Visit", ordering="date")
    def visit_summary(self, obj):
        return format_html(
            '<span class="hv-record-primary">{}</span><span class="hv-record-secondary">{}</span>',
            date_format(obj.date, "l j F Y"), time_format(obj.time, "g:i A"),
        )

    @admin.display(description="Party", ordering="guests")
    def party_size(self, obj):
        return format_html(
            '<span class="hv-party-size">{} <span>{}</span></span>', obj.guests, "guest" if obj.guests == 1 else "guests"
        )

    @admin.display(description="Reservation", ordering="status")
    def status_badge(self, obj):
        return format_html('<span class="hv-chip {}">{}</span>', STATUS_CHIPS[obj.status], obj.get_status_display())

    @admin.display(description="Email", ordering="notification_status")
    def email_badge(self, obj):
        return format_html(
            '<span class="hv-chip {}">{}</span>', EMAIL_CHIPS[obj.notification_status], obj.get_notification_status_display()
        )
