r"""
   \==================================================================
   \==   @ Henvo                                                    ==
   \==   @ author: Mai Quoc Viet                                    ==
   \==   @ project: knowledge                                       ==
   \==   @ copyright: (c) 2026 Henvo. All rights reserved.          ==
   \==================================================================
"""

from types import SimpleNamespace

from django.contrib.auth.models import User
from django.test import RequestFactory, SimpleTestCase, TestCase

from admin_ui import charts, nav, text_format
from admin_ui.templatetags import admin_ui as tags


class ChartTests(SimpleTestCase):
    def test_css_pct_never_uses_comma(self):
        self.assertNotIn(",", charts.css_pct(12.5))

    def test_nice_ceiling(self):
        self.assertEqual(charts.nice_ceiling(0), 2)
        for value in (5, 37, 999):
            top = charts.nice_ceiling(value)
            self.assertGreaterEqual(top, value)
            self.assertEqual(top % 2, 0)

    def test_column_chart(self):
        chart = charts.column_chart([("1", 0, "Day 1"), ("2", 4, "Day 2")], unit="visits")
        self.assertTrue(chart["bars"][0]["empty"])
        self.assertIn("Day 2: 4 visits", chart["bars"][1]["tip"])
        self.assertEqual(len(chart["ticks"]), 3)

    def test_compact_and_share_rows(self):
        self.assertEqual(charts.compact(1_200_000), "1.2M")
        self.assertEqual(charts.compact(45_000), "45k")
        self.assertEqual(charts.compact(4_500), "4,500")
        rows = charts.share_rows([{"value": 50}, {"value": 25}])
        self.assertEqual([r["pct"] for r in rows], [charts.css_pct(100), charts.css_pct(50)])


class TextFormatTests(SimpleTestCase):
    def test_australian_formats(self):
        self.assertEqual(text_format.group_digits(450000), "450,000")
        self.assertEqual(text_format.duration_text(90), "1 min 30 sec")
        self.assertEqual(text_format.fold("Café Açai"), "cafe acai")


class TemplateTagTests(SimpleTestCase):
    def test_icon_markup(self):
        html = tags.icon("home", "big")
        self.assertIn('class="hv-i big"', html)
        self.assertRegex(html, r"admin-icons(\.[0-9a-f]+)?\.svg#home")

    def test_initials(self):
        self.assertEqual(tags.initials(SimpleNamespace(first_name="Ava", last_name="Nguyen", username="x")), "NA")
        self.assertEqual(tags.initials(SimpleNamespace(first_name="", last_name="", username="boss")), "BO")

    def test_labels_are_english(self):
        self.assertRegex(tags.today_label(), r"^[A-Z][a-z]+day \d{1,2} [A-Z][a-z]+ \d{4}$")
        self.assertIn(tags.greeting(), {"Good morning", "Good afternoon", "Good evening"})
        self.assertEqual(tags.digits(1000000), "1,000,000")


class NavTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_superuser("boss", "boss@example.com", "pw")

    def nav_for(self, path):
        request = RequestFactory().get(path)
        request.user = self.user
        return nav.build_nav(request)

    def test_sections_and_active_item(self):
        sections = self.nav_for("/admin/menu/menuitem/3/change/")
        self.assertEqual([s["title"] for s in sections], [None, "Bookings", "Menu", "Customers", "Orders", "Loyalty", "Team"])
        active = [i["name"] for s in sections for i in s["items"] if i["active"]]
        self.assertEqual(active, ["Items & prices"])

    def test_dashboard_only_active_on_itself(self):
        self.assertTrue(self.nav_for("/admin/")[0]["items"][0]["active"])


class AdminPagesTests(TestCase):
    def setUp(self):
        User.objects.create_superuser("boss", "boss@example.com", "pw")

    def test_login_page(self):
        response = self.client.get("/admin/login/")
        self.assertContains(response, "hv-login-shell")
        self.assertContains(response, "admin_ui/css/admin")
        self.assertNotContains(response, "hv-language-form")

    def test_shell_pages(self):
        self.client.login(username="boss", password="pw")
        for url in (
            "/admin/", "/admin/bookings/", "/admin/bookings/bookingrequest/", "/admin/bookings/bookingrequest/add/",
            "/admin/menu/menuitem/", "/admin/auth/user/", "/admin/auth/group/",
        ):
            response = self.client.get(url)
            self.assertEqual(response.status_code, 200, url)
            self.assertContains(response, "hv-sidebar")
            self.assertContains(response, "data-hv-theme-toggle")

    def test_logout_page(self):
        self.client.login(username="boss", password="pw")
        self.assertContains(self.client.post("/admin/logout/"), "hv-login-done")
