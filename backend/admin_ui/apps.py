r"""
   \==================================================================
   \==   @ Henvo                                                    ==
   \==   @ author: Mai Quoc Viet                                    ==
   \==   @ project: knowledge                                       ==
   \==   @ copyright: (c) 2026 Henvo. All rights reserved.          ==
   \==================================================================
"""

from django.apps import AppConfig


class AdminUiConfig(AppConfig):
    """Admin skin. Must be listed BEFORE django.contrib.admin in INSTALLED_APPS."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "admin_ui"
    verbose_name = "Admin interface"
