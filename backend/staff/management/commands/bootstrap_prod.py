"""One-off production setup: preset roles, loyalty settings and the first superuser.

Safe to re-run. The superuser password is read from the environment so it is
never stored in the repository:

    BOOTSTRAP_SUPERUSER_USERNAME=... BOOTSTRAP_SUPERUSER_PASSWORD=... \
    BOOTSTRAP_SUPERUSER_EMAIL=... python manage.py bootstrap_prod
"""

import os
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from accounts.models import LoyaltyProgram
from menu.models import MenuCategory, MenuItem, MenuSection
from staff.roles import sync_default_roles


class Command(BaseCommand):
    help = "Refresh preset roles, create loyalty settings and the first superuser (idempotent)."

    def handle(self, *args, **options):
        roles = sync_default_roles()
        self.stdout.write(f"Roles refreshed: {', '.join(roles)}")

        program, created = LoyaltyProgram.objects.get_or_create(
            pk=1,
            defaults={
                "is_active": True,
                "points_per_order": 1,
                "points_for_reward": 8,
                "reward_amount": Decimal("20.00"),
            },
        )
        self.stdout.write(f"Loyalty settings {'created' if created else 'already present'} ({program.points_for_reward} points -> ${program.reward_amount} AUD)")

        self.stdout.write(
            f"Menu: {MenuCategory.objects.count()} categories, {MenuSection.objects.count()} sections, "
            f"{MenuItem.objects.count()} items"
        )
        if not MenuCategory.objects.exists():
            raise CommandError("Menu is empty - run `python manage.py migrate` first.")

        username = os.getenv("BOOTSTRAP_SUPERUSER_USERNAME", "").strip()
        password = os.getenv("BOOTSTRAP_SUPERUSER_PASSWORD", "")
        if not username or not password:
            self.stdout.write("No BOOTSTRAP_SUPERUSER_* variables set: superuser step skipped.")
            return
        User = get_user_model()
        user, made = User.objects.get_or_create(username=username)
        user.email = os.getenv("BOOTSTRAP_SUPERUSER_EMAIL", user.email)
        user.is_staff = user.is_superuser = user.is_active = True
        user.set_password(password)
        user.save()
        self.stdout.write(self.style.SUCCESS(f"Superuser '{username}' {'created' if made else 'updated'}."))
