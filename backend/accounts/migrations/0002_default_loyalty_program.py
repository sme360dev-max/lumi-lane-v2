from django.db import migrations


def create_default_program(apps, schema_editor):
    LoyaltyProgram = apps.get_model("accounts", "LoyaltyProgram")
    LoyaltyProgram.objects.get_or_create(
        pk=1,
        defaults={"is_active": True, "points_per_order": 1, "points_for_reward": 8, "reward_cents": 2000},
    )


class Migration(migrations.Migration):
    dependencies = [("accounts", "0001_initial")]
    operations = [migrations.RunPython(create_default_program, migrations.RunPython.noop)]
