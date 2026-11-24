"""
Plain-English names for the permissions staff actually use.

Django lists permissions as "Authentication and Authorisation | user | Can view user".
Here every model the admin manages becomes one row ("Staff accounts") with four
actions (View, Add, Edit, Delete), grouped by the job it belongs to.
"""

from django.contrib.auth.models import Permission
from django.db.models import Q

ACTIONS = (("view", "View"), ("add", "Add"), ("change", "Edit"), ("delete", "Delete"))

# (area title, [(app_label, model, name, what it covers)])
AREAS = (
    ("Bookings", (
        ("bookings", "bookingrequest", "Table requests", "Booking requests sent from the website."),
    )),
    ("Menu", (
        ("menu", "menuitem", "Menu items & prices", "Dishes and drinks, prices, and sold-out status."),
        ("menu", "menusection", "Menu sections", "Groups such as All Day, Cocktails or Red wine."),
        ("menu", "priceoption", "Açai price table", "Size and service prices shared by all açai bowls."),
        ("menu", "menucategory", "Menu tabs", "Brunch, Açai, Coffee & Drinks, Bar."),
    )),
    ("Customers & orders", (
        ("accounts", "account", "Customer accounts", "Customer profiles and account access."),
        ("accounts", "cartitem", "Shopping carts", "Current customer shopping cart lines."),
        ("accounts", "order", "Orders", "Pickup order requests and their status."),
    )),
    ("Loyalty", (
        ("accounts", "loyaltyprogram", "Loyalty rules", "Points per order, qualifying threshold and AUD reward value."),
        ("accounts", "loyaltyentry", "Points & rewards ledger", "Immutable points and reward balance entries."),
    )),
    ("Team", (
        ("auth", "user", "Staff accounts", "Who can sign in to this admin."),
        ("auth", "group", "Roles & permissions", "Roles such as Manager or Front of house."),
    )),
)

MODELS = {(app, model): name for _, rows in AREAS for app, model, name, _ in rows}
ACTION_NAMES = dict(ACTIONS)


def managed_permissions():
    """The permissions shown to staff, in display order handled by the widgets."""
    query = Q()
    for app, model in MODELS:
        query |= Q(content_type__app_label=app, content_type__model=model)
    return Permission.objects.filter(query).select_related("content_type")


def split(permission):
    """(app_label, model, action) for a permission such as menu.change_menuitem."""
    action = permission.codename.split("_", 1)[0]
    return permission.content_type.app_label, permission.content_type.model, action


def friendly_name(permission):
    """ "Edit menu items & prices" instead of "menu | menu item | Can change menu item"."""
    app, model, action = split(permission)
    name = MODELS.get((app, model))
    if not name or action not in ACTION_NAMES:
        return permission.name
    return f"{ACTION_NAMES[action]} {name[0].lower() + name[1:]}"
