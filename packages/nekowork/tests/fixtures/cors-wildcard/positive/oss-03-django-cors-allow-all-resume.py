# ── urls.py ──────────────────────────────────────────────────────────────────
# resume_screener/urls.py

from django.urls import path
from backend.views import (
    ScreenResumeView,
    ResultsListView,
    ResultDetailView,
    PowerBIExportView,
)

urlpatterns = [
    path("api/screen/",          ScreenResumeView.as_view(),  name="screen"),
    path("api/results/",         ResultsListView.as_view(),   name="results-list"),
    path("api/results/<int:pk>/", ResultDetailView.as_view(), name="result-detail"),
    path("api/powerbi-export/",  PowerBIExportView.as_view(), name="powerbi-export"),
]


# ── settings snippet ──────────────────────────────────────────────────────────
# Add these to your settings.py

SETTINGS_SNIPPET = """
INSTALLED_APPS = [
    ...
    'rest_framework',
    'corsheaders',
    'backend',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    ...
]

CORS_ALLOW_ALL_ORIGINS = True   # tighten for production

MEDIA_URL  = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Anthropic key
import os
ANTHROPIC_API_KEY = os.environ['ANTHROPIC_API_KEY']
"""
