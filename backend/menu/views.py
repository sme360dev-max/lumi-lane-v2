from django.http import JsonResponse
from django.views.decorators.http import require_GET

from .serializers import build_menu, last_updated


@require_GET
def menu_list(request):
    """Public menu for the website. Cached briefly so a price change shows within a minute."""
    response = JsonResponse(
        {"categories": build_menu(), "updatedAt": last_updated()},
        json_dumps_params={"ensure_ascii": False},
    )
    response["Cache-Control"] = "public, max-age=60"
    return response
