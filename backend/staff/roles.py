"""
Ready-made roles (Django groups) for a café team.

They are created after `migrate` when missing, so a fresh database starts with them.
A role that already exists is never touched: changes made in the admin are kept.
"""

from django.contrib.auth.models import Group

from .permissions import managed_permissions, split

ALL = ("view", "add", "change", "delete")
MENU = ("menuitem", "menusection", "priceoption", "menucategory")

# name -> (description, {(app, model): actions})
ROLES = {
    "Manager": (
        "Runs the venue: bookings, the whole menu, and staff accounts. Cannot delete accounts or change roles.",
        {
            ("bookings", "bookingrequest"): ALL,
            **{("menu", m): ALL for m in MENU},
            ("accounts", "account"): ("view", "change"),
            ("accounts", "cartitem"): ("view", "delete"),
            ("accounts", "order"): ("view", "change"),
            ("accounts", "loyaltyprogram"): ("view", "change"),
            ("accounts", "loyaltyentry"): ("view",),
            ("auth", "user"): ("view", "add", "change"),
            ("auth", "group"): ("view",),
        },
    ),
    "Front of house": (
        "Handles table requests: confirms, updates and adds phone bookings. Can look up the menu.",
        {
            ("bookings", "bookingrequest"): ("view", "add", "change"),
            ("menu", "menuitem"): ("view",),
            ("accounts", "account"): ("view",),
            ("accounts", "order"): ("view", "change"),
        },
    ),
    "Menu editor": (
        "Keeps the menu current: prices, sold-out items, new dishes and sections. Can see bookings.",
        {
            ("bookings", "bookingrequest"): ("view",),
            **{("menu", m): ALL for m in MENU},
        },
    ),
    "View only": (
        "Can look at bookings and the menu without changing anything.",
        {
            ("bookings", "bookingrequest"): ("view",),
            **{("menu", m): ("view",) for m in MENU},
            ("accounts", "account"): ("view",),
            ("accounts", "order"): ("view",),
            ("accounts", "loyaltyprogram"): ("view",),
            ("accounts", "loyaltyentry"): ("view",),
        },
    ),
}


def describe(group_name):
    role = ROLES.get(group_name)
    return role[0] if role else ""


def create_default_roles(**kwargs):
    """post_migrate: add any preset role that does not exist yet."""
    permissions = list(managed_permissions())
    for name, (_, grants) in ROLES.items():
        group, created = Group.objects.get_or_create(name=name)
        if created:
            group.permissions.set(
                p for p in permissions if split(p)[2] in grants.get(split(p)[:2], ())
            )
            continue
        # Existing default roles keep all edits. Add permissions for newly
        # introduced customer/account models without replacing custom choices.
        group.permissions.add(
            *(
                p for p in permissions
                if split(p)[0] == "accounts" and split(p)[2] in grants.get(split(p)[:2], ())
            )
        )


def sync_default_roles():
    """Reset every preset role to exactly what ROLES says (used by `bootstrap_prod`/`sync_roles`).

    Unlike `create_default_roles`, this overwrites edits made in the admin, so the
    roles match the current permission list. Custom roles are left alone.
    """
    permissions = list(managed_permissions())
    for name, (_, grants) in ROLES.items():
        group, _ = Group.objects.get_or_create(name=name)
        group.permissions.set(
            p for p in permissions if split(p)[2] in grants.get(split(p)[:2], ())
        )
    return list(ROLES)
