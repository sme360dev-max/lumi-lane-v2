from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0005_alter_loyaltyprogram_points_for_reward_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="passwordresettoken",
            name="attempts",
            field=models.PositiveSmallIntegerField(default=0),
        ),
    ]
