from django.contrib import admin
from django.urls import path
from django.views.generic import RedirectView

from bookings.views import booking_create, health
from accounts import views as account_views
from menu.views import menu_list

admin.site.site_header = "Lumi Lane"
admin.site.site_title = "Lumi Lane Admin"
admin.site.index_title = "Operations"
admin.site.index_template = "admin/index.html"

urlpatterns = [
    path("", RedirectView.as_view(url="/admin/", permanent=False), name="home"),
    path("admin/", admin.site.urls),
    path("health/", health, name="health"),
    path("api/bookings/", booking_create, name="booking-create"),
    path("api/menu/", menu_list, name="menu-list"),
    path("api/loyalty/", account_views.loyalty_program, name="loyalty-program"),
    path("api/account/register/", account_views.register, name="account-register"),
    path("api/account/login/", account_views.login, name="account-login"),
    path("api/account/logout/", account_views.logout, name="account-logout"),
    path("api/account/me/", account_views.me, name="account-me"),
    path("api/account/preferences/", account_views.preferences, name="account-preferences"),
    path("api/account/favorites/", account_views.favorites, name="account-favorites"),
    path("api/account/cart/", account_views.cart, name="account-cart"),
    path("api/account/orders/", account_views.orders, name="account-orders"),
    path("api/account/reservations/", account_views.reservations, name="account-reservations"),
    path("api/account/rewards/", account_views.rewards, name="account-rewards"),
    path("api/account/dashboard/", account_views.dashboard, name="account-dashboard"),
    path("api/account/password-reset/", account_views.request_password_reset, name="account-password-reset"),
    path("api/account/password-reset/confirm/", account_views.reset_password, name="account-password-reset-confirm"),
]
