from django import forms
from django.contrib import admin
from django.contrib.auth.admin import GroupAdmin, UserAdmin
from django.contrib.auth.forms import AdminUserCreationForm, UserChangeForm
from django.contrib.auth.models import Group, User
from django.db.models import Count
from django.urls import reverse
from django.utils import timezone
from django.utils.html import format_html, format_html_join
from django.utils.timesince import timesince

from .permissions import managed_permissions
from .roles import describe
from .widgets import PermissionMatrix, RoleCards


def permission_field(label, help_text):
    return forms.ModelMultipleChoiceField(
        queryset=managed_permissions(), widget=PermissionMatrix, required=False, label=label, help_text=help_text
    )


ACCESS_LABELS = {
    "is_active": ("Account active", "Untick to block sign-in without deleting the account or its history."),
    "is_staff": ("Can sign in to the admin", "Needed for every team member who uses this admin."),
    "is_superuser": ("Owner (full access)", "Can do everything, whatever roles are ticked. Keep this to one or two people."),
}


class StaffChangeForm(UserChangeForm):
    user_permissions = permission_field(
        "Extra permissions",
        "Only for exceptions. Permissions from the roles above already apply; tick here to add more for this person.",
    )

    class Meta(UserChangeForm.Meta):
        widgets = {"groups": RoleCards}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for name, (label, help_text) in ACCESS_LABELS.items():
            if name in self.fields:
                self.fields[name].label, self.fields[name].help_text = label, help_text
        if "groups" in self.fields:
            self.fields["groups"].label = "Roles"
            self.fields["groups"].help_text = "What this person does at Lumi Lane. Tick one or more."
        if "email" in self.fields:
            self.fields["email"].help_text = "Used to contact this person. Not used to sign in."


class StaffCreationForm(AdminUserCreationForm):
    class Meta(AdminUserCreationForm.Meta):
        fields = ("username", "first_name", "last_name", "email")


admin.site.unregister(User)
admin.site.unregister(Group)


@admin.register(User)
class StaffUserAdmin(UserAdmin):
    form = StaffChangeForm
    add_form = StaffCreationForm
    change_form_template = "admin/auth/user/change_form.html"
    list_title = "Staff accounts"
    add_label = "Add staff account"
    list_display = ("person", "email", "role_list", "access", "last_seen")
    list_display_links = ("person",)
    list_filter = ("is_active", "is_staff", "is_superuser", "groups")
    search_fields = ("username", "first_name", "last_name", "email")
    ordering = ("first_name", "last_name", "username")
    list_per_page = 25
    filter_horizontal = ()
    readonly_fields = ("last_login", "date_joined")
    fieldsets = (
        ("Profile", {"fields": (("first_name", "last_name"), "email", "username")}),
        ("Access", {"fields": ("is_active", "is_staff", "is_superuser")}),
        ("Roles", {"fields": ("groups",)}),
        ("Extra permissions", {"fields": ("user_permissions",)}),
        ("Password", {"fields": ("password",)}),
        ("Activity", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        ("Profile", {"fields": (("first_name", "last_name"), "email")}),
        ("Sign-in", {"fields": ("username", "usable_password", "password1", "password2")}),
    )

    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related("groups")

    def save_model(self, request, obj, form, change):
        if not change:
            obj.is_staff = True  # A new account here is a team member who signs in to this admin.
        super().save_model(request, obj, form, change)

    @admin.display(description="Name", ordering="first_name")
    def person(self, obj):
        return format_html(
            '<span class="hv-record-primary">{}</span><span class="hv-record-secondary">@{}</span>',
            obj.get_full_name() or obj.username, obj.username,
        )

    @admin.display(description="Roles")
    def role_list(self, obj):
        if obj.is_superuser:
            return format_html('<span class="hv-chip hv-chip-approved">Owner</span>')
        roles = [g.name for g in obj.groups.all()]
        if not roles:
            return format_html('<span class="hv-muted">—</span>')
        return format_html_join(" ", '<span class="hv-chip hv-chip-quiet">{}</span>', ((r,) for r in roles))

    @admin.display(description="Access", ordering="is_active")
    def access(self, obj):
        if not obj.is_active:
            return format_html('<span class="hv-chip hv-chip-rejected">Blocked</span>')
        if not obj.is_staff:
            return format_html('<span class="hv-chip hv-chip-pending">No admin sign-in</span>')
        return format_html('<span class="hv-chip hv-chip-approved">Active</span>')

    @admin.display(description="Last sign-in", ordering="last_login")
    def last_seen(self, obj):
        if not obj.last_login:
            return format_html('<span class="hv-muted">Never</span>')
        return f"{timesince(obj.last_login, timezone.now()).split(',')[0]} ago"

    def change_view(self, request, object_id, form_url="", extra_context=None):
        user = self.get_object(request, object_id)
        extra = {}
        if user is not None:
            extra["profile"] = {
                "roles": [{"name": g.name, "description": describe(g.name)} for g in user.groups.all()],
                "password_url": reverse("admin:auth_user_password_change", args=[user.pk]),
                "is_self": user.pk == request.user.pk,
            }
        return super().change_view(request, object_id, form_url, {**extra, **(extra_context or {})})


class RoleForm(forms.ModelForm):
    permissions = permission_field("What this role can do", "Tick what people with this role may see and change.")

    class Meta:
        model = Group
        fields = ("name", "permissions")
        labels = {"name": "Role name"}


@admin.register(Group)
class RoleAdmin(GroupAdmin):
    form = RoleForm
    list_title = "Roles & permissions"
    add_label = "Add role"
    list_display = ("name", "about", "member_count", "permission_count")
    search_fields = ("name",)
    ordering = ("name",)
    filter_horizontal = ()
    readonly_fields = ("members",)
    fieldsets = (
        ("Role", {"fields": ("name",)}),
        ("Permissions", {"fields": ("permissions",)}),
        ("People with this role", {"fields": ("members",)}),
    )

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            _members=Count("user", distinct=True), _permissions=Count("permissions", distinct=True)
        )

    def get_fieldsets(self, request, obj=None):
        return self.fieldsets if obj else self.fieldsets[:2]

    def change_view(self, request, object_id, form_url="", extra_context=None):
        return super().change_view(request, object_id, form_url, {"title": "Edit role", **(extra_context or {})})

    def add_view(self, request, form_url="", extra_context=None):
        return super().add_view(request, form_url, {"title": "Add role", **(extra_context or {})})

    @admin.display(description="What it is for")
    def about(self, obj):
        return describe(obj.name) or format_html('<span class="hv-muted">Custom role</span>')

    @admin.display(description="People", ordering="_members")
    def member_count(self, obj):
        return obj._members

    @admin.display(description="Permissions", ordering="_permissions")
    def permission_count(self, obj):
        return obj._permissions

    @admin.display(description="People")
    def members(self, obj):
        users = obj.user_set.order_by("first_name", "username")
        if not users:
            return "Nobody has this role yet."
        return format_html_join(
            ", ", '<a href="{}">{}</a>',
            ((reverse("admin:auth_user_change", args=[u.pk]), u.get_full_name() or u.username) for u in users),
        )
