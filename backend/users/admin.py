from django.contrib import admin
from .models import User, Role, UserDocument

admin.site.register(User)
admin.site.register(Role)
# NOTE: UserDocument is not registered here yet — uncomment when document management
# via admin interface is needed:
# admin.site.register(UserDocument)
