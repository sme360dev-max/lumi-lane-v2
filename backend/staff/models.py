# No tables of its own: staff uses Django's User, Group and Permission models.
# The module exists so Django sends this app the post_migrate signal (see apps.py).
