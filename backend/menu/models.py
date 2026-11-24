from decimal import Decimal

from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.utils.text import slugify

PRICE = {"max_digits": 8, "decimal_places": 2, "validators": [MinValueValidator(Decimal("0"))]}


class MenuCategory(models.Model):
    """One tab on the website menu page (Brunch, Açai, Coffee & Drinks, Bar)."""

    class PriceStyle(models.TextChoices):
        DOLLAR = "dollar", "$25.9 — with $, no trailing zeros"
        FIXED = "fixed", "4.20 — always two decimals"

    slug = models.SlugField(
        "Tab code", max_length=40, unique=True,
        help_text="Used in the link, e.g. /menu/#bar. Lowercase letters, digits and hyphens only.",
    )
    name = models.CharField("Tab name", max_length=60)
    price_style = models.CharField(
        "Price format", max_length=10, choices=PriceStyle.choices, default=PriceStyle.DOLLAR
    )
    order = models.PositiveSmallIntegerField("Order", default=0)
    is_active = models.BooleanField("Shown on website", default=True)
    updated_at = models.DateTimeField("Updated", auto_now=True)

    class Meta:
        ordering = ("order", "id")
        verbose_name = "Menu category"
        verbose_name_plural = "Menu categories"

    def __str__(self):
        return self.name

    def format_price(self, value):
        """Printed price in this tab's style; None for "not offered"."""
        if value is None:
            return None
        text = f"{value:.2f}"
        if self.price_style == self.PriceStyle.DOLLAR:
            return "$" + text.rstrip("0").rstrip(".")
        return text


class MenuSection(models.Model):
    """A titled block inside a tab (All Day, Sweet, Red, Cocktails...)."""

    class Kind(models.TextChoices):
        STANDARD = "standard", "Item list with prices"
        ACAI = "acai", "Item list priced by a shared table (Açai)"
        WINE = "wine", "Wine list — glass / bottle"
        PRICING = "pricing", "Price table by size / service"
        NOTICE = "notice", "Notice (no items)"

    LIST_KINDS = (Kind.STANDARD, Kind.ACAI, Kind.WINE)

    category = models.ForeignKey(
        MenuCategory, verbose_name="Category", on_delete=models.CASCADE, related_name="sections"
    )
    kind = models.CharField("Section type", max_length=10, choices=Kind.choices, default=Kind.STANDARD)
    title = models.CharField("Title", max_length=120, blank=True)
    note = models.TextField(
        "Note", blank=True,
        help_text="Italic line under the title. For a Notice section this is the text shown.",
    )
    order = models.PositiveSmallIntegerField("Order", default=0)
    is_active = models.BooleanField("Shown", default=True)
    updated_at = models.DateTimeField("Updated", auto_now=True)

    class Meta:
        ordering = ("category__order", "order", "id")
        verbose_name = "Menu section"
        verbose_name_plural = "Menu sections"

    def __str__(self):
        return f"{self.category.name} · {self.title or self.get_kind_display()}"

    def clean(self):
        if self.kind != self.Kind.PRICING and not self.title.strip():
            raise ValidationError({"title": "Enter a title for this section."})
        if self.kind == self.Kind.NOTICE and not self.note.strip():
            raise ValidationError({"note": "A notice needs some text."})


class MenuItem(models.Model):
    section = models.ForeignKey(
        MenuSection, verbose_name="Section", on_delete=models.CASCADE, related_name="items"
    )
    slug = models.SlugField(
        "Item code", max_length=100, unique=True, blank=True,
        help_text="Leave blank to create it from the name. No need to change it when renaming.",
    )
    name = models.CharField("Name", max_length=120)
    description = models.TextField("Description", blank=True)
    price = models.DecimalField("Price (AUD)", null=True, blank=True, **PRICE)
    region = models.CharField(
        "Region", max_length=120, blank=True, help_text="Wine only."
    )
    glass_price = models.DecimalField(
        "Glass (AUD)", null=True, blank=True,
        help_text="Leave blank if not sold by the glass.", **PRICE,
    )
    bottle_price = models.DecimalField(
        "Bottle (AUD)", null=True, blank=True,
        help_text="Leave blank if not sold by the bottle.", **PRICE,
    )
    order = models.PositiveSmallIntegerField("Order", default=0)
    is_available = models.BooleanField("Available", default=True)
    updated_at = models.DateTimeField("Updated", auto_now=True)

    class Meta:
        ordering = ("section__category__order", "section__order", "order", "id")
        verbose_name = "Menu item"
        verbose_name_plural = "Menu items"

    def __str__(self):
        return self.name

    def clean(self):
        section = getattr(self, "section", None)
        if section is None:
            return
        kind = section.kind
        if kind not in MenuSection.LIST_KINDS:
            raise ValidationError({"section": "This section does not hold items. Pick an item list."})
        if kind == MenuSection.Kind.STANDARD and self.price is None:
            raise ValidationError({"price": "Enter a price."})
        if kind == MenuSection.Kind.WINE and self.glass_price is None and self.bottle_price is None:
            raise ValidationError({"glass_price": "A wine needs a glass or a bottle price."})
        if kind == MenuSection.Kind.ACAI and not self.description.strip():
            raise ValidationError({"description": "Açai items need a description."})

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(f"{self.section.category.slug}-{self.name}")[:90] or "item"
            slug, n = base, 2
            while MenuItem.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug, n = f"{base}-{n}", n + 1
            self.slug = slug
        super().save(*args, **kwargs)


class PriceOption(models.Model):
    """One row of a pricing table, e.g. Takeaway / Small / $16.9."""

    section = models.ForeignKey(
        MenuSection, verbose_name="Price table", on_delete=models.CASCADE, related_name="price_rows"
    )
    group = models.CharField("Group", max_length=60, help_text="e.g. Takeaway, Dine In.")
    label = models.CharField("Option", max_length=60, help_text="e.g. Small, Large, Bowl.")
    price = models.DecimalField("Price (AUD)", **PRICE)
    order = models.PositiveSmallIntegerField("Order", default=0)
    updated_at = models.DateTimeField("Updated", auto_now=True)

    class Meta:
        ordering = ("order", "id")
        verbose_name = "Price row"
        verbose_name_plural = "Price table"

    def __str__(self):
        return f"{self.group} · {self.label}"
