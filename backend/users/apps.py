from django.apps import AppConfig


# Handles authentication, user roles, and account status workflow (PENDING → APPROVED/REJECTED).
# Also manages user document uploads (RSBSA, government IDs) for farmer verification.
class UsersConfig(AppConfig):
    name = 'users'
