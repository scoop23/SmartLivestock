from django.urls import path
from . import community_views as views

urlpatterns = [
    path("announcements/", views.announcements),
    path("announcements/<int:pk>/", views.announcement_detail),
    path("schedules/", views.schedules),
    path("schedules/<int:pk>/", views.schedule_detail),
    path("bookings/", views.bookings),
    path("bookings/<int:pk>/", views.booking_detail),
]
