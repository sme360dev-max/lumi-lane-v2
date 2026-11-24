from django import forms
from django.contrib import admin
from django.db import models
from django.db.models import Count

from .models import MenuCategory, MenuItem, MenuSection, PriceOption

SHORT_TEXT = {models.TextField: {"widget": forms.Textarea(attrs={"rows": 2, "cols": 52})}}


class SectionInline(admin.TabularInline):
    model = MenuSection
    fields = ("title", "kind", "order", "is_active")
    extra = 0
    show_change_link = True


@admin.register(MenuCategory)
class MenuCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "price_style", "section_count", "order", "is_active")
    list_editable = ("order", "is_active")
    prepopulated_fields = {"slug": ("name",)}
    fields = ("name", "slug", "price_style", "order", "is_active")
    inlines = (SectionInline,)

    @admin.display(description="Sections", ordering="_sections")
    def section_count(self, obj):
        return obj._sections

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(_sections=Count("sections"))


class ItemInline(admin.TabularInline):
    model = MenuItem
    extra = 1
    formfield_overrides = SHORT_TEXT


class StandardItemInline(ItemInline):
    fields = ("name", "description", "price", "order", "is_available")


class AcaiItemInline(ItemInline):
    fields = ("name", "description", "order", "is_available")


class WineItemInline(ItemInline):
    fields = ("name", "region", "glass_price", "bottle_price", "order", "is_available")


class PriceOptionInline(admin.TabularInline):
    model = PriceOption
    fields = ("group", "label", "price", "order")
    extra = 1


# Each section type edits only the columns the website shows for it.
INLINES_BY_KIND = {
    MenuSection.Kind.STANDARD: (StandardItemInline,),
    MenuSection.Kind.ACAI: (AcaiItemInline,),
    MenuSection.Kind.WINE: (WineItemInline,),
    MenuSection.Kind.PRICING: (PriceOptionInline,),
}


@admin.register(MenuSection)
class MenuSectionAdmin(admin.ModelAdmin):
    list_display = ("section_title", "category", "kind", "item_count", "order", "is_active")
    list_display_links = ("section_title",)
    list_editable = ("order", "is_active")
    list_filter = ("category", "kind", "is_active")
    list_select_related = ("category",)
    search_fields = ("title", "note")
    fields = ("category", "kind", "title", "note", "order", "is_active")
    formfield_overrides = SHORT_TEXT
    list_per_page = 100

    @admin.display(description="Section", ordering="title")
    def section_title(self, obj):
        return obj.title or obj.get_kind_display()

    @admin.display(description="Items", ordering="_items")
    def item_count(self, obj):
        return obj._items

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(_items=Count("items"))

    def get_inlines(self, request, obj):
        # A new section is saved first, then its items appear for its type.
        return INLINES_BY_KIND.get(obj.kind, ()) if obj else ()


@admin.register(MenuItem)
class MenuItemAdmin(admin.ModelAdmin):
    """The everyday screen: find an item and change its price or availability right in the list."""

    list_display = ("name", "section", "price", "glass_price", "bottle_price", "is_available")
    list_editable = ("price", "glass_price", "bottle_price", "is_available")
    list_filter = ("section__category", "section", "is_available")
    list_select_related = ("section__category",)
    search_fields = ("name", "description", "region")
    list_per_page = 25
    list_title = "Menu items & prices"
    add_label = "Add menu item"
    formfield_overrides = {models.TextField: {"widget": forms.Textarea(attrs={"rows": 3, "cols": 60})}}
    readonly_fields = ("updated_at",)

    def get_fieldsets(self, request, obj=None):
        return (
            (None, {"fields": ("section", "name", "description")}),
            ("Price", {"fields": ("price", ("glass_price", "bottle_price"), "region")}),
            ("Display", {"fields": ("is_available", "order", "slug", "updated_at")}),
        )
