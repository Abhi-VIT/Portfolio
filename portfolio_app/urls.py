from django.urls import path
from . import views

app_name = 'portfolio_app'

urlpatterns = [
    path('', views.home, name='home'),
    path('classic/', views.index, name='index'),
    path('about/', views.about, name='about'),
    path('experience/', views.experience, name='experience'),
    path('skills/', views.skills, name='skills'),
    path('projects/', views.projects, name='projects'),
    path('publications/', views.publications, name='publications'),
    path('certifications/', views.certifications, name='certifications'),
]
