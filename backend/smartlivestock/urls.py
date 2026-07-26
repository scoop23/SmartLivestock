"""
URL configuration for smartlivestock project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView  # type: ignore
from users.views import MyTokenView  # type: ignore

# API URL routing:
#   /admin/         → Django admin panel
#   /api/users/     → User registration, health check endpoints
#   /api/token/     → Login (returns JWT access + refresh tokens)
#   /api/token/refresh → Refresh an expired access token
#
# TODO: Add routes for livestock, production, diseases, movements apps
#   e.g. path("api/livestock/", include("livestock.urls"))
urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/users/", include("users.urls")),
    path("api/token/", MyTokenView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh", TokenRefreshView.as_view(), name="token_refresh"),
    path("livestock/", include("livestock.urls")),
]
