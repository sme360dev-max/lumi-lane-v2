"""The public menu as JSON, in the exact shape of the website's MenuCategory[] type."""

from django.db.models import Max, Prefetch
from django.utils.text import slugify

from .models import MenuCategory, MenuItem, MenuSection, PriceOption


def _cents(value):
    return None if value is None else int(round(value * 100))


def _item(item, section, category, section_id):
    base = {"id": item.slug, "name": item.name, "sectionId": section_id}
    if section.kind == MenuSection.Kind.WINE:
        return {
            **base, "kind": "wine", "region": item.region,
            "glass": category.format_price(item.glass_price) or "-",
            "bottle": category.format_price(item.bottle_price) or "-",
            "glassCents": _cents(item.glass_price), "bottleCents": _cents(item.bottle_price),
        }
    if section.kind == MenuSection.Kind.ACAI:
        return {**base, "kind": "acai", "description": item.description}
    data = {**base, "kind": "std", "price": category.format_price(item.price) or "", "priceCents": _cents(item.price) or 0}
    if item.description:
        data["description"] = item.description
    return data


def _column(section, category):
    if section.kind == MenuSection.Kind.NOTICE:
        return {"kind": "notice", "title": section.title, "text": section.note}
    if section.kind == MenuSection.Kind.PRICING:
        groups = {}
        for row in section.price_rows.all():
            groups.setdefault(row.group, []).append(
                {"label": row.label, "price": category.format_price(row.price), "priceCents": _cents(row.price)}
            )
        return {"kind": "pricing", "groups": [{"title": t, "rows": r} for t, r in groups.items()], "note": section.note}
    section_id = slugify(section.title) or f"section-{section.pk}"
    column = {"kind": "list", "title": section.title}
    if section.note:
        column["note"] = section.note
    if section.kind == MenuSection.Kind.WINE:
        column["wine"] = True
    column["items"] = [_item(i, section, category, section_id) for i in section.items.all()]
    return column


def build_menu():
    """Active tabs, sections and available items, in display order."""
    sections = MenuSection.objects.filter(is_active=True).order_by("order", "id").prefetch_related(
        Prefetch("items", queryset=MenuItem.objects.filter(is_available=True).order_by("order", "id")),
        Prefetch("price_rows", queryset=PriceOption.objects.order_by("order", "id")),
    )
    categories = MenuCategory.objects.filter(is_active=True).prefetch_related(Prefetch("sections", queryset=sections))
    result = []
    for category in categories:
        columns = [_column(s, category) for s in category.sections.all()]
        # A list whose items are all sold out is hidden rather than shown as an empty heading.
        columns = [c for c in columns if c["kind"] != "list" or c["items"]]
        if columns:
            result.append({"id": category.slug, "label": category.name, "columns": columns})
    return result


def last_updated():
    stamps = [
        model.objects.aggregate(m=Max("updated_at"))["m"] for model in (MenuCategory, MenuSection, MenuItem, PriceOption)
    ]
    stamps = [s for s in stamps if s]
    return max(stamps).isoformat() if stamps else None
