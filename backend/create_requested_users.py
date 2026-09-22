import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "smartlivestock.settings")
django.setup()

from users.models import User, Role

# Ensure roles exist
mao_role, _ = Role.objects.get_or_create(role_name="MAO")
sibat_role, _ = Role.objects.get_or_create(role_name="SIBAT")

DEFAULT_PASSWORD = "Password123!"

admins = [
    {"username": "emmanuel_admin", "email": "emmanuel@smartlivestock.gov.ph", "first_name": "Emmanuel", "last_name": "Admin"},
    {"username": "shantel-kun", "email": "shantel@smartlivestock.gov.ph", "first_name": "Shantel", "last_name": "Admin"},
    {"username": "alexa_admin", "email": "alexa@smartlivestock.gov.ph", "first_name": "Alexa", "last_name": "Admin"},
]

sibats = [
    {"username": "emmanuel_sibat", "email": "emmanuel.sibat@smartlivestock.gov.ph", "first_name": "Emmanuel", "last_name": "Sibat"},
    {"username": "shantel_sibat", "email": "shantel.sibat@smartlivestock.gov.ph", "first_name": "Shantel", "last_name": "Sibat"},
    {"username": "alexa_sibat", "email": "alexa.sibat@smartlivestock.gov.ph", "first_name": "Alexa", "last_name": "Sibat"},
]

print("\n--- CREATING ADMIN (MAO) ACCOUNTS ---")
for data in admins:
    user, created = User.objects.get_or_create(
        email=data["email"],
        defaults={
            "username": data["username"],
            "first_name": data["first_name"],
            "last_name": data["last_name"],
            "role": mao_role,
            "account_status": User.AccountStatus.APPROVED,
            "is_staff": True,
            "is_superuser": True,
            "is_active": True,
        }
    )
    user.username = data["username"]
    user.role = mao_role
    user.account_status = User.AccountStatus.APPROVED
    user.is_staff = True
    user.is_superuser = True
    user.is_active = True
    user.set_password(DEFAULT_PASSWORD)
    user.save()
    status = "Created" if created else "Updated"
    print(f"[{status}] Admin: {user.email} (Username: {user.username})")

print("\n--- CREATING SIBAT ACCOUNTS ---")
for data in sibats:
    user, created = User.objects.get_or_create(
        email=data["email"],
        defaults={
            "username": data["username"],
            "first_name": data["first_name"],
            "last_name": data["last_name"],
            "role": sibat_role,
            "account_status": User.AccountStatus.APPROVED,
            "is_staff": False,
            "is_superuser": False,
            "is_active": True,
        }
    )
    user.username = data["username"]
    user.role = sibat_role
    user.account_status = User.AccountStatus.APPROVED
    user.is_staff = False
    user.is_superuser = False
    user.is_active = True
    user.set_password(DEFAULT_PASSWORD)
    user.save()
    status = "Created" if created else "Updated"
    print(f"[{status}] Sibat: {user.email} (Username: {user.username})")

print(f"\nAll accounts ready! Default password for all is: {DEFAULT_PASSWORD}")
