from django.contrib.auth.models import Group, Permission, User
from django.test import TestCase
from django.urls import reverse

from .permissions import friendly_name, managed_permissions
from .roles import ROLES


class RoleTests(TestCase):
    def test_preset_roles_exist_with_permissions(self):
        for name in ROLES:
            self.assertTrue(Group.objects.get(name=name).permissions.exists(), name)
        foh = Group.objects.get(name="Front of house")
        codes = set(foh.permissions.values_list("codename", flat=True))
        self.assertEqual(codes, {
            "view_bookingrequest", "add_bookingrequest", "change_bookingrequest", "view_menuitem",
            "view_account", "view_order", "change_order",
        })

    def test_existing_role_is_not_overwritten(self):
        from .roles import create_default_roles

        manager = Group.objects.get(name="Manager")
        manager.permissions.clear()
        create_default_roles()
        # Only customer/account permissions are re-added; booking and menu edits are kept as-is.
        self.assertFalse(manager.permissions.filter(content_type__app_label__in=["bookings", "menu"]).exists())

    def test_sync_default_roles_resets_roles(self):
        from .roles import sync_default_roles

        manager = Group.objects.get(name="Manager")
        manager.permissions.clear()
        sync_default_roles()
        self.assertTrue(manager.permissions.filter(codename="change_menuitem").exists())

    def test_role_permissions_work(self):
        user = User.objects.create_user("sam", password="pw", is_staff=True)
        user.groups.add(Group.objects.get(name="Menu editor"))
        self.assertTrue(user.has_perm("menu.change_menuitem"))
        self.assertFalse(user.has_perm("auth.change_user"))


class PermissionNameTests(TestCase):
    def test_friendly_names(self):
        perm = Permission.objects.get(codename="view_user")
        self.assertEqual(friendly_name(perm), "View staff accounts")
        self.assertEqual(friendly_name(Permission.objects.get(codename="change_menuitem")), "Edit menu items & prices")

    def test_every_admin_model_is_covered(self):
        # 12 models x view/add/change/delete
        self.assertEqual(managed_permissions().count(), 48)


class StaffAdminTests(TestCase):
    def setUp(self):
        self.boss = User.objects.create_superuser("boss", "boss@example.com", "pw", first_name="Ava", last_name="Lee")
        self.client.force_login(self.boss)

    def test_user_profile_page(self):
        response = self.client.get(reverse("admin:auth_user_change", args=[self.boss.pk]))
        self.assertContains(response, "hv-profile")
        self.assertContains(response, "Owner · full access")
        self.assertContains(response, "hv-perm-table")
        self.assertContains(response, "Front of house")  # role cards

    def test_save_roles_and_permissions(self):
        sam = User.objects.create_user("sam", password="pw", is_staff=True)
        url = reverse("admin:auth_user_change", args=[sam.pk])
        foh = Group.objects.get(name="Front of house")
        extra = Permission.objects.get(codename="change_menuitem")
        response = self.client.post(url, {
            "username": "sam", "first_name": "Sam", "last_name": "Tran", "email": "sam@example.com",
            "is_active": "on", "is_staff": "on", "groups": [foh.pk], "user_permissions": [extra.pk],
            "last_login_0": "", "last_login_1": "", "date_joined_0": "2026-11-01", "date_joined_1": "09:00:00",
        })
        self.assertEqual(response.status_code, 302, getattr(response, "context", None) and response.context["errors"])
        sam.refresh_from_db()
        self.assertEqual(list(sam.groups.all()), [foh])
        self.assertTrue(sam.has_perm("menu.change_menuitem"))

    def test_add_user_signs_in_to_admin(self):
        response = self.client.post(reverse("admin:auth_user_add"), {
            "username": "kim", "first_name": "Kim", "last_name": "Ho", "email": "kim@example.com",
            "usable_password": "true", "password1": "a-long-passphrase-42", "password2": "a-long-passphrase-42",
        })
        self.assertEqual(response.status_code, 302)
        self.assertTrue(User.objects.get(username="kim").is_staff)

    def test_role_page(self):
        group = Group.objects.get(name="Manager")
        response = self.client.get(reverse("admin:auth_group_change", args=[group.pk]))
        self.assertContains(response, "Staff accounts")
        self.assertContains(response, "Edit menu items &amp; prices")
        self.assertContains(self.client.get(reverse("admin:auth_group_changelist")), "Handles table requests")
