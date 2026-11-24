from datetime import timedelta
from uuid import UUID

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from django.utils import timezone

from bookings.models import BookingRequest
from accounts.models import Account, LoyaltyProgram, Order


class Command(BaseCommand):
    help = "Create or refresh sample table requests for local admin preview."

    SAMPLES = [
        {
            "request_id": UUID("bc3d12d0-99e4-4a20-9c52-000000000001"),
            "name": "Alex Morgan", "email": "alex.morgan@example.com", "phone": "0400 123 456",
            "day_offset": 1, "time": "10:30", "guests": 2,
            "notes": "Window seat if available.", "status": BookingRequest.Status.NEW,
            "notification_status": BookingRequest.NotificationStatus.SENT,
        },
        {
            "request_id": UUID("bc3d12d0-99e4-4a20-9c52-000000000002"),
            "name": "Taylor Nguyen", "email": "taylor.nguyen@example.com", "phone": "0412 345 678",
            "day_offset": 2, "time": "12:00", "guests": 5,
            "notes": "High chair, please.", "status": BookingRequest.Status.NEW,
            "notification_status": BookingRequest.NotificationStatus.FAILED,
        },
        {
            "request_id": UUID("bc3d12d0-99e4-4a20-9c52-000000000003"),
            "name": "Jordan Lee", "email": "jordan.lee@example.com", "phone": "0433 222 110",
            "day_offset": 3, "time": "09:15", "guests": 3,
            "notes": "One guest is vegetarian.", "status": BookingRequest.Status.CONFIRMED,
            "notification_status": BookingRequest.NotificationStatus.SENT,
        },
        {
            "request_id": UUID("bc3d12d0-99e4-4a20-9c52-000000000004"),
            "name": "Casey Wilson", "email": "casey.wilson@example.com", "phone": "0408 555 012",
            "day_offset": 0, "time": "13:00", "guests": 2,
            "notes": "Birthday lunch.", "status": BookingRequest.Status.CONTACTED,
            "notification_status": BookingRequest.NotificationStatus.PENDING,
        },
        {
            "request_id": UUID("bc3d12d0-99e4-4a20-9c52-000000000005"),
            "name": "Morgan Patel", "email": "morgan.patel@example.com", "phone": "0421 987 654",
            "day_offset": -2, "time": "11:45", "guests": 4,
            "notes": "No special requests.", "status": BookingRequest.Status.CANCELLED,
            "notification_status": BookingRequest.NotificationStatus.SENT,
        },
        {
            "request_id": UUID("bc3d12d0-99e4-4a20-9c52-000000000006"),
            "name": "Riley Chen", "email": "riley.chen@example.com", "phone": "0402 777 909",
            "day_offset": 5, "time": "14:00", "guests": 8,
            "notes": "A table together for a small group.", "status": BookingRequest.Status.CONFIRMED,
            "notification_status": BookingRequest.NotificationStatus.SENT,
        },
    ]

    def handle(self, *args, **options):
        if not settings.DEBUG or connection.vendor != "sqlite":
            raise CommandError("seed_data is restricted to DEBUG + local SQLite; it will not write to production databases.")

        today = timezone.localdate()
        created_count = 0
        updated_count = 0
        for sample in self.SAMPLES:
            values = sample.copy()
            day_offset = values.pop("day_offset")
            values["date"] = today + timedelta(days=day_offset)
            booking, created = BookingRequest.objects.update_or_create(
                request_id=values.pop("request_id"), defaults=values
            )
            created_count += int(created)
            updated_count += int(not created)

        # Keep the seeded loyalty settings stable after the first creation, so
        # rerunning this command never overwrites a venue's local configuration.
        program, _ = LoyaltyProgram.objects.get_or_create(
            pk=1,
            defaults={"is_active": True, "points_per_order": 1, "points_for_reward": 8, "reward_amount": "20.00"},
        )

        demo_customers = [
            ("alex.morgan@example.com", "Alex Morgan", "0400 123 456"),
            ("taylor.nguyen@example.com", "Taylor Nguyen", "0412 345 678"),
            ("jordan.lee@example.com", "Jordan Lee", "0433 222 110"),
        ]
        customers = {}
        for email, full_name, phone in demo_customers:
            customer, _ = Account.objects.get_or_create(
                email=email,
                defaults={"full_name": full_name, "phone": phone, "password": "!", "is_active": True},
            )
            customers[email] = customer

        order_created = 0
        completed_order_ids = []
        for index in range(1, 9):
            request_id = UUID(f"bc3d12d0-99e4-4a20-9c52-1000000000{index:02d}")
            subtotal_cents = 1850 + index * 125
            order, created = Order.objects.get_or_create(
                request_id=request_id,
                defaults={
                    "account": customers["alex.morgan@example.com"],
                    "status": Order.Status.COMPLETED,
                    "notification_status": Order.NotificationStatus.SENT,
                    "subtotal_cents": subtotal_cents,
                    "reward_cents": 0,
                    "total_cents": subtotal_cents,
                    "lines": [{"name": "Smashed Avo Toast", "label": "Sourdough", "quantity": 1, "cents": subtotal_cents, "subtotal": subtotal_cents}],
                    "notes": "Local admin demo order.",
                },
            )
            order_created += int(created)
            if order.status == Order.Status.COMPLETED:
                completed_order_ids.append(order.pk)

        extra_orders = [
            ("taylor.nguyen@example.com", 1, Order.Status.RECEIVED, 2240),
            ("taylor.nguyen@example.com", 2, Order.Status.PREPARING, 3150),
            ("jordan.lee@example.com", 3, Order.Status.READY, 1780),
        ]
        for email, index, status, total_cents in extra_orders:
            request_id = UUID(f"bc3d12d0-99e4-4a20-9c52-2000000000{index:02d}")
            _, created = Order.objects.get_or_create(
                request_id=request_id,
                defaults={
                    "account": customers[email],
                    "status": status,
                    "notification_status": Order.NotificationStatus.SENT,
                    "subtotal_cents": total_cents,
                    "reward_cents": 0,
                    "total_cents": total_cents,
                    "lines": [{"name": "Flat White", "label": "Regular", "quantity": 2, "cents": total_cents // 2, "subtotal": total_cents}],
                    "notes": "Local admin demo order.",
                },
            )
            order_created += int(created)

        # Run the same completion hook as the admin, so the demo ledger proves
        # that eight completed orders unlock the configured reward.
        if program.is_active:
            from accounts.admin import award_completed_order
            for order_id in completed_order_ids:
                award_completed_order(Order.objects.get(pk=order_id))

        self.stdout.write(self.style.SUCCESS(
            f"Seeded {len(self.SAMPLES)} bookings ({created_count} created, {updated_count} refreshed), "
            f"{len(demo_customers)} demo customers and {order_created} pickup orders. "
            "Loyalty entries were generated using the configured completion rules. No emails were sent."
        ))
