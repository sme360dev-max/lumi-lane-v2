from functools import wraps

from django.http import JsonResponse

from .auth import account_from_request


def account_required(view):
    @wraps(view)
    def wrapped(request, *args, **kwargs):
        account = account_from_request(request, touch=True)
        if account is None:
            return JsonResponse({"error": "Sign in to continue."}, status=401)
        request.account = account
        return view(request, *args, **kwargs)

    return wrapped
