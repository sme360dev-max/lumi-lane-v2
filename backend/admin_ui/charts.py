r"""
   \==================================================================
   \==   @ Henvo                                                    ==
   \==   @ author: Mai Quoc Viet                                    ==
   \==   @ project: knowledge                                       ==
   \==   @ copyright: (c) 2026 Henvo. All rights reserved.          ==
   \==================================================================
"""

import math

from admin_ui.text_format import group_digits

WEEKDAY_SHORT = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")


def css_pct(value):
    """
    A percentage for a style attribute, as a string with a full stop.

    A float handed to a template can be localised (e.g. "12,5" in some
    locales), which CSS reads as two values and drops the rule.
    """
    return f"{max(0.0, min(float(value), 100.0)):.2f}"


def nice_ceiling(value):
    """
    The smallest 2, 4, 5, 6, 8 or 10 times a power of ten at or above the value.

    An axis that tops out at 37 reads like a measurement; one at 40 reads like
    a scale. Every step halves to a whole number, because the middle tick is
    printed too and "2" under a line drawn at 2.5 misstates every bar near it.
    Zero stays two, so an empty chart still has an axis to sit on.
    """
    if value <= 2:
        return 2
    exponent = math.floor(math.log10(value))
    base = 10 ** exponent
    for step in (2, 4, 5, 6, 8, 10):
        if value <= step * base:
            ceiling = step * base
            # 5 x 10^0 halves to 2.5; nudge it to the next even step.
            if exponent == 0 and step == 5:
                ceiling = 6
            return int(ceiling)
    return int(10 * base)


def compact(value):
    """Short labels for axis ticks: 1,200,000 becomes 1.2M; 45,000 becomes 45k."""
    if value >= 1_000_000:
        return f"{value / 1_000_000:.1f}".rstrip("0").rstrip(".") + "M"
    if value >= 10_000:
        return f"{value / 1_000:.1f}".rstrip("0").rstrip(".") + "k"
    return group_digits(value)


def column_chart(points, unit="", money=False, label_every=None):
    """
    Geometry for a single-series column chart, drawn by the template in CSS.

    `points` is a list of (label, value, tip_label). The template only sets
    heights from `pct` — no chart library, nothing fetched, and the bars follow
    the theme like any other element. Ticks are three clean steps up to a nice
    ceiling; labels thin out so a 30-day chart prints every fifth day, not a
    smear of thirty.
    """
    values = [value or 0 for _, value, _ in points]
    top = nice_ceiling(max(values) if values else 0)
    every = label_every or (1 if len(points) <= 10 else (5 if len(points) <= 35 else 2))
    bars = []
    for index, (label, value, tip_label) in enumerate(points):
        value = value or 0
        shown = group_digits(value) + (f" {unit}" if unit else "")
        bars.append({
            "label": label if index % every == 0 or index == len(points) - 1 else "",
            "value": value,
            "pct": css_pct(value / top * 100 if top else 0),
            "tip": f"{tip_label}: {shown}",
            "empty": value == 0,
        })
    ticks = [
        {"pct": css_pct(pct), "text": (compact if money else group_digits)(top * pct / 100)}
        for pct in (100, 50, 0)
    ]
    total = sum(values)
    return {
        "bars": bars,
        "ticks": ticks,
        "total": total,
        "total_text": group_digits(total),
        "peak": max(values) if values else 0,
        "is_empty": total == 0,
    }


def share_rows(rows, total=None):
    """
    Rows for a ranked bar list: each value as a share of the largest or of a total.

    Against the largest by default, so the leader fills the track and the rest
    read relative to it; against the total when the rows are parts of a whole
    and the percentage itself is the point.
    """
    rows = list(rows)
    largest = max((row["value"] for row in rows), default=0)
    out = []
    for row in rows:
        value = row["value"] or 0
        basis = total if total else largest
        out.append({
            **row,
            "value_text": group_digits(value),
            "pct": css_pct(value / basis * 100 if basis else 0),
            "share": round(value / total * 100) if total else None,
        })
    return out


def delta(current, previous):
    """
    Change against the previous period, as something a reader can glance at.

    None when there is no previous figure to compare with: "+100%" from zero
    to one visit is arithmetic, not news.
    """
    if not previous:
        return None
    change = (current - previous) / previous * 100
    return {
        "pct": abs(round(change)),
        "direction": "up" if change > 0.5 else ("down" if change < -0.5 else "flat"),
    }
