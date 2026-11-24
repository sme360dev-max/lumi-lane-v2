r"""
   \==================================================================
   \==   @ Henvo                                                    ==
   \==   @ author: Mai Quoc Viet                                    ==
   \==   @ project: knowledge                                       ==
   \==   @ copyright: (c) 2026 Henvo. All rights reserved.          ==
   \==================================================================
"""

from django.contrib import admin
from django.urls import NoReverseMatch, reverse

# Pages that are a piece of work rather than a model table ("desks").
# Each names the permission its own view checks, so the menu never offers a
# door that answers 403. "superuser": True hides it from everyone else.
DESKS = {
    "dashboard": {"label": "Overview", "icon": "home", "url": "admin:index", "perm": None},
}

# The sidebar, top to bottom, grouped by the JOB a staff member is doing,
# not by Django app. Keys: "desk:<name>" or "<app_label>.<model_name>".
# Every model registered on the admin should appear exactly once.
SECTIONS = (
    (None, ("desk:dashboard",)),
    ("Bookings", ("bookings.bookingrequest",)),
    ("Menu", ("menu.menuitem", "menu.menusection", "menu.menucategory")),
    ("Customers", ("accounts.account", "accounts.cartitem")),
    ("Orders", ("accounts.order",)),
    ("Loyalty", ("accounts.loyaltyprogram", "accounts.loyaltyentry")),
    ("Team", ("auth.user", "auth.group")),
)

# One icon per model, from static/admin_ui/img/admin-icons.svg.
MODEL_ICONS = {
    "bookings.bookingrequest": "calendar",
    "menu.menuitem": "bowl",
    "menu.menusection": "list",
    "menu.menucategory": "layers",
    "accounts.account": "users",
    "accounts.cartitem": "menu",
    "accounts.order": "clipboard",
    "accounts.loyaltyprogram": "star",
    "accounts.loyaltyentry": "wallet",
    "auth.user": "shield-user",
    "auth.group": "users",
}

# Shorter names where verbose_name_plural does not fit the rail.
MODEL_LABELS = {
    "bookings.bookingrequest": "Table requests",
    "menu.menuitem": "Items & prices",
    "menu.menusection": "Sections",
    "menu.menucategory": "Menu tabs",
    "accounts.account": "Customers",
    "accounts.cartitem": "Shopping carts",
    "accounts.order": "Orders",
    "accounts.loyaltyprogram": "Program rules",
    "accounts.loyaltyentry": "Points & rewards",
    "auth.user": "Staff accounts",
    "auth.group": "Roles & permissions",
}

# model key -> badge key; counts come from badge_counts().
MODEL_BADGES = {}


def badge_counts(keys) -> dict:
    """
    Every sidebar count in ONE query (scalar subqueries in a single SELECT),
    not cached so a count drops the moment work is done. Example:

        from django.db import connection
        parts = {"pending": ("(SELECT COUNT(*) FROM orders WHERE status = %s)", ["PENDING"])}
        sql = "SELECT " + ", ".join(p[0] for p in parts.values())
        with connection.cursor() as c:
            c.execute(sql, [v for p in parts.values() for v in p[1]])
            return dict(zip(parts, c.fetchone()))

    A DatabaseError must return {} so the menu loses its numbers, not the page.
    """
    return {}


def _model_entries(request) -> dict:
    """What this user may open, from the admin itself, keyed by 'app.model'."""
    entries = {}
    for app in admin.site.get_app_list(request):
        for model in app["models"]:
            url = model.get("admin_url")
            if url:
                entries[f"{app['app_label']}.{model['object_name'].lower()}"] = {"name": str(model["name"]), "url": url}
    return entries


def _desk_entry(key, user):
    """A desk the user may open, or None."""
    desk = DESKS[key]
    if desk["perm"] and not user.has_perm(desk["perm"]):
        return None
    if desk.get("superuser") and not user.is_superuser:
        return None
    try:
        url = reverse(desk["url"])
    except NoReverseMatch:
        return None
    return {"name": desk["label"], "url": url, "icon": desk["icon"], "badge_key": desk.get("badge")}


def build_nav(request) -> list:
    """Sections with the items this user may open; empty sections are dropped."""
    user = request.user
    entries = _model_entries(request)
    sections = []
    for section_label, keys in SECTIONS:
        items = []
        for key in keys:
            if key.startswith("desk:"):
                item = _desk_entry(key[5:], user)
            elif key in entries:
                item = {
                    "name": MODEL_LABELS.get(key, entries[key]["name"]),
                    "url": entries[key]["url"],
                    "icon": MODEL_ICONS.get(key, "dot"),
                    "badge_key": MODEL_BADGES.get(key),
                }
            else:
                item = None
            if item:
                items.append(item)
        if items:
            sections.append({"title": section_label, "items": items})

    # Models registered but missing from SECTIONS still get a menu entry, so
    # nothing silently disappears; add them to SECTIONS to place them properly.
    listed = {key for _, keys in SECTIONS for key in keys}
    leftovers = [
        {"name": entry["name"], "url": entry["url"], "icon": MODEL_ICONS.get(key, "dot"), "badge_key": None}
        for key, entry in entries.items()
        if key not in listed
    ]
    if leftovers:
        sections.append({"title": "Other", "items": leftovers})

    _mark_active(sections, request.path)
    wanted = {i["badge_key"] for s in sections for i in s["items"] if i["badge_key"]}
    counts = badge_counts(wanted) if wanted else {}
    for section in sections:
        for item in section["items"]:
            item["badge"] = counts.get(item["badge_key"]) or 0
    return sections


def _mark_active(sections, path):
    """Light the item whose URL is the LONGEST prefix of this page (dashboard only on itself)."""
    best = None
    for section in sections:
        for item in section["items"]:
            item["active"] = False
            url = item["url"]
            matches = path == url if url.rstrip("/").endswith("/admin") else path.startswith(url)
            if matches and (best is None or len(url) > len(best["url"])):
                best = item
    if best:
        best["active"] = True
