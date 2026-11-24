from django.apps import AppConfig
from django.db.models.signals import post_migrate


class StaffConfig(AppConfig):
    """Staff accounts, roles and permissions. Listed last in INSTALLED_APPS so every
    model's permissions exist before the preset roles are filled in."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "staff"
    verbose_name = "Team"

    def ready(self):
        from django.apps import apps

        from .roles import create_default_roles

        # Breadcrumbs say "Team" instead of "Authentication and Authorisation".
        # (App names are not part of migrations, so this is safe to change.)
        apps.get_app_config("auth").verbose_name = "Team"

        post_migrate.connect(create_default_roles, sender=self, dispatch_uid="staff.create_default_roles")
