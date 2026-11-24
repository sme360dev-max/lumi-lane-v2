"""Load the menu that used to live in website/src/data/menu.ts, so every new database starts with it."""

import json
from decimal import Decimal
from pathlib import Path

from django.db import migrations

SEED = Path(__file__).resolve().parent.parent / "data" / "initial_menu.json"


def _price(text):
    text = (text or "").strip().lstrip("$")
    return None if text in {"", "-"} else Decimal(text)


def _section_kind(column):
    if column["kind"] != "list":
        return column["kind"]
    if column.get("wine"):
        return "wine"
    if column["items"] and all(item["kind"] == "acai" for item in column["items"]):
        return "acai"
    return "standard"


def seed(apps, schema_editor):
    Category = apps.get_model("menu", "MenuCategory")
    if Category.objects.exists():
        return
    Section = apps.get_model("menu", "MenuSection")
    Item = apps.get_model("menu", "MenuItem")
    PriceOption = apps.get_model("menu", "PriceOption")

    for c_order, cat in enumerate(json.loads(SEED.read_text(encoding="utf-8")), start=1):
        prices = [
            p for col in cat["columns"] for p in
            [i.get("price", "") for i in col.get("items", [])] + [r["price"] for g in col.get("groups", []) for r in g["rows"]]
            if p
        ]
        style = "dollar" if prices and all(p.startswith("$") for p in prices) else "fixed"
        category = Category.objects.create(slug=cat["id"], name=cat["label"], price_style=style, order=c_order * 10)

        for s_order, col in enumerate(cat["columns"], start=1):
            kind = _section_kind(col)
            section = Section.objects.create(
                category=category, kind=kind, title=col.get("title", ""),
                note=col.get("text", "") if kind == "notice" else col.get("note", ""), order=s_order * 10,
            )
            if kind == "pricing":
                n = 0
                for group in col["groups"]:
                    for row in group["rows"]:
                        n += 1
                        PriceOption.objects.create(
                            section=section, group=group["title"], label=row["label"], price=_price(row["price"]), order=n * 10
                        )
            for i_order, item in enumerate(col.get("items", []), start=1):
                Item.objects.create(
                    section=section, slug=item["id"], name=item["name"], description=item.get("description", ""),
                    price=_price(item.get("price")), region=item.get("region", ""),
                    glass_price=_price(item.get("glass")), bottle_price=_price(item.get("bottle")), order=i_order * 10,
                )


class Migration(migrations.Migration):
    dependencies = [("menu", "0001_initial")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
