r"""
   \==================================================================
   \==   @ Henvo                                                    ==
   \==   @ author: Mai Quoc Viet                                    ==
   \==   @ project: knowledge                                       ==
   \==   @ copyright: (c) 2026 Henvo. All rights reserved.          ==
   \==================================================================
"""

import unicodedata


def fold(text: str) -> str:
    """Lower-cased with accents removed, so "cafe" matches "Café" in searches."""
    text = (text or "").lower()
    return "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")


def duration_text(seconds) -> str:
    """A length of time the way people say it: 90 becomes "1 min 30 sec"."""
    seconds = max(int(seconds or 0), 0)
    hours, rest = divmod(seconds, 3600)
    minutes, secs = divmod(rest, 60)
    parts = [f"{value} {unit}" for value, unit in ((hours, "hr"), (minutes, "min"), (secs, "sec")) if value]
    return " ".join(parts) or "0 sec"


def group_digits(value) -> str:
    """An integer with Australian thousands separators: 450000 becomes "450,000"."""
    try:
        return f"{int(value):,}"
    except (TypeError, ValueError):
        return str(value)
