from django import forms

from .permissions import ACTIONS, AREAS, managed_permissions, split
from .roles import describe


class PermissionMatrix(forms.CheckboxSelectMultiple):
    """Permissions as a table: one row per area of the admin, one column per action."""

    template_name = "staff/widgets/permission_matrix.html"

    def get_context(self, name, value, attrs):
        context = super().get_context(name, value, attrs)
        selected = {str(v) for v in (value or [])}
        by_key = {split(p): p for p in managed_permissions()}
        base_id = (attrs or {}).get("id") or f"id_{name}"
        sections = []
        for title, models in AREAS:
            rows = []
            for app, model, label, help_text in models:
                cells = []
                for action, action_label in ACTIONS:
                    perm = by_key.get((app, model, action))
                    cells.append(perm and {
                        "id": f"{base_id}_{perm.pk}",
                        "value": perm.pk,
                        "checked": str(perm.pk) in selected,
                        "label": f"{action_label} {label[0].lower() + label[1:]}",
                    })
                rows.append({"label": label, "help": help_text, "cells": cells})
            sections.append({"title": title, "rows": rows})
        context["matrix"] = {"actions": [label for _, label in ACTIONS], "sections": sections}
        return context


class RoleCards(forms.CheckboxSelectMultiple):
    """Roles as cards: name, what the role is for, and how many permissions it grants."""

    template_name = "staff/widgets/role_cards.html"

    def get_context(self, name, value, attrs):
        context = super().get_context(name, value, attrs)
        cards = []
        for _, options, _ in context["widget"]["optgroups"]:
            for option in options:
                group = getattr(option["value"], "instance", None)
                cards.append({
                    **option,
                    "description": describe(group.name) if group else "",
                    "count": group.permissions.count() if group else 0,
                })
        context["cards"] = cards
        return context
