import json
from decimal import Decimal
from pathlib import Path

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.test import TestCase, override_settings
from django.urls import reverse

from .models import MenuCategory, MenuItem, MenuSection, PriceOption
from .serializers import build_menu

SEED = Path(__file__).resolve().parent / "data" / "initial_menu.json"


def _without_layout(menu):
    """className and sectionId are presentation details the website derives itself."""
    for cat in menu:
        for col in cat["columns"]:
            col.pop("className", None)
            for item in col.get("items", []):
                item.pop("sectionId", None)
    return menu


class SeedRoundTripTests(TestCase):
    """The seeded database serves the same menu the website used to hard-code."""

    def test_api_matches_original_menu(self):
        original = _without_layout(json.loads(SEED.read_text(encoding="utf-8")))
        # The only intentional change: the old file printed this one coffee price as "3.5".
        for cat in original:
            for col in cat["columns"]:
                for item in col.get("items", []):
                    if item["id"] == "coffee-baby-cino":
                        item["price"] = "3.50"
        self.assertEqual(_without_layout(build_menu()), original)

    def test_counts(self):
        self.assertEqual(MenuCategory.objects.count(), 4)
        self.assertEqual(MenuItem.objects.count(), 136)
        self.assertEqual(PriceOption.objects.count(), 3)


class FormatTests(TestCase):
    def test_price_styles(self):
        dollar = MenuCategory(price_style="dollar")
        fixed = MenuCategory(price_style="fixed")
        self.assertEqual(dollar.format_price(Decimal("25.90")), "$25.9")
        self.assertEqual(dollar.format_price(Decimal("3.00")), "$3")
        self.assertEqual(dollar.format_price(Decimal("20.45")), "$20.45")
        self.assertEqual(fixed.format_price(Decimal("4.2")), "4.20")
        self.assertIsNone(fixed.format_price(None))


class MenuApiTests(TestCase):
    def test_price_change_is_served(self):
        item = MenuItem.objects.get(slug="brunch-lumi-breakfast")
        item.price = Decimal("27.50")
        item.save()
        data = self.client.get(reverse("menu-list")).json()
        served = next(i for c in data["categories"] for col in c["columns"] for i in col.get("items", []) if i["id"] == item.slug)
        self.assertEqual((served["price"], served["priceCents"]), ("$27.5", 2750))
        self.assertTrue(data["updatedAt"])

    def test_hidden_things_are_left_out(self):
        MenuItem.objects.filter(slug="brunch-lumi-breakfast").update(is_available=False)
        MenuSection.objects.filter(title="Sweet").update(is_active=False)
        MenuCategory.objects.filter(slug="bar").update(is_active=False)
        menu = build_menu()
        ids = {i["id"] for c in menu for col in c["columns"] for i in col.get("items", [])}
        self.assertNotIn("brunch-lumi-breakfast", ids)
        self.assertNotIn("Sweet", [col.get("title") for c in menu for col in c["columns"]])
        self.assertEqual([c["id"] for c in menu], ["brunch", "acai", "coffee"])

    def test_sold_out_section_is_hidden(self):
        section = MenuSection.objects.get(title="Puppaccino")
        section.items.update(is_available=False)
        self.assertNotIn("Puppaccino", [col.get("title") for c in build_menu() for col in c["columns"]])

    @override_settings(CORS_ALLOWED_ORIGINS=["https://site.example"])
    def test_cache_and_cors_headers(self):
        response = self.client.get(reverse("menu-list"), HTTP_ORIGIN="https://site.example")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Access-Control-Allow-Origin"], "https://site.example")
        self.assertIn("GET", response["Access-Control-Allow-Methods"])
        self.assertEqual(response["Cache-Control"], "public, max-age=60")

    def test_get_only(self):
        self.assertEqual(self.client.post(reverse("menu-list")).status_code, 405)


class ValidationTests(TestCase):
    def test_standard_item_needs_price(self):
        item = MenuItem(section=MenuSection.objects.get(title="All Day"), name="Toast")
        with self.assertRaises(ValidationError):
            item.full_clean()

    def test_wine_needs_glass_or_bottle(self):
        item = MenuItem(section=MenuSection.objects.get(title="Red"), name="House Red")
        with self.assertRaises(ValidationError):
            item.full_clean()
        item.bottle_price = Decimal("40")
        item.full_clean(exclude=["slug"])

    def test_slug_is_generated_and_unique(self):
        section = MenuSection.objects.get(title="All Day")
        first = MenuItem.objects.create(section=section, name="Lumi Breakfast", price=Decimal("1"))
        self.assertEqual(first.slug, "brunch-lumi-breakfast-2")


class AdminTests(TestCase):
    def setUp(self):
        self.client.force_login(User.objects.create_superuser("boss", "boss@example.com", "x"))

    def test_pages_open(self):
        section = MenuSection.objects.get(title="Red")
        pricing = MenuSection.objects.get(kind="pricing")
        for url in (
            reverse("admin:menu_menuitem_changelist"),
            reverse("admin:menu_menuitem_change", args=[MenuItem.objects.first().pk]),
            reverse("admin:menu_menusection_changelist"),
            reverse("admin:menu_menusection_change", args=[section.pk]),
            reverse("admin:menu_menusection_change", args=[pricing.pk]),
            reverse("admin:menu_menusection_add"),
            reverse("admin:menu_menucategory_changelist"),
            reverse("admin:menu_menucategory_change", args=[MenuCategory.objects.first().pk]),
        ):
            self.assertEqual(self.client.get(url).status_code, 200, url)
