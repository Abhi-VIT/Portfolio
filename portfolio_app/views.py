import json

from django.conf import settings
from django.shortcuts import render
from django.templatetags.static import static

from .mongo import get_portfolio_data


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_data():
    """Return portfolio data from MongoDB, falling back to resume_data.json."""
    data = get_portfolio_data()
    if data:
        return data
    # Fallback: read the bundled JSON file (always available locally & on Vercel).
    try:
        with open(settings.BASE_DIR / 'resume_data.json', encoding='utf-8') as fh:
            return json.load(fh)
    except FileNotFoundError:
        return None


def _build_profile(data):
    """Extract a profile dict (matching the ORM model fields) from raw data."""
    if data is None:
        return None
    return {
        'full_name': data.get('full_name', ''),
        'title': data.get('title', ''),
        'phone': data.get('phone', ''),
        'email': data.get('email', ''),
        'summary': data.get('summary', ''),
        'photo': data.get('photo', ''),
        'github': data.get('links', {}).get('github', ''),
        'linkedin': data.get('links', {}).get('linkedin', ''),
    }


# ---------------------------------------------------------------------------
# Views
# ---------------------------------------------------------------------------

def index(request):
    data = _get_data()
    if not data:
        return render(request, 'portfolio_app/index.html', {'no_data': True})
    context = {
        'profile': _build_profile(data),
        'educations': data.get('education', []),
        'skills': data.get('skills', []),
        'projects': data.get('projects', []),
        'certifications': data.get('certifications', []),
        'experiences': data.get('experience', []),
        'languages': data.get('languages', []),
        'research': data.get('research', []),
    }
    return render(request, 'portfolio_app/index.html', context)


def home(request):
    data = _get_data()
    if not data:
        return render(request, 'portfolio_app/home.html', {'no_data': True})
    return render(request, 'portfolio_app/home.html', {
        'profile': _build_profile(data),
        'portfolio': data,
        'og_image_url': f"{settings.SITE_ORIGIN}{static('portfolio_app/images/og-portfolio.png')}",
    })


def about(request):
    data = _get_data()
    if not data:
        return render(request, 'portfolio_app/about.html', {'no_data': True})
    context = {
        'profile': _build_profile(data),
        'educations': data.get('education', []),
        'languages': data.get('languages', []),
    }
    return render(request, 'portfolio_app/about.html', context)


def experience(request):
    data = _get_data()
    if not data:
        return render(request, 'portfolio_app/experience.html', {'no_data': True})
    experiences = sorted(
        data.get('experience', []),
        key=lambda x: x.get('start_date', ''),
        reverse=True,
    )
    context = {
        'profile': _build_profile(data),
        'experiences': experiences,
    }
    return render(request, 'portfolio_app/experience.html', context)


def skills(request):
    data = _get_data()
    if not data:
        return render(request, 'portfolio_app/skills.html', {'no_data': True})
    context = {
        'profile': _build_profile(data),
        'skills': data.get('skills', []),
    }
    return render(request, 'portfolio_app/skills.html', context)


def projects(request):
    data = _get_data()
    if not data:
        return render(request, 'portfolio_app/projects.html', {'no_data': True})
    project_list = sorted(
        data.get('projects', []),
        key=lambda x: x.get('year', ''),
        reverse=True,
    )
    context = {
        'profile': _build_profile(data),
        'projects': project_list,
    }
    return render(request, 'portfolio_app/projects.html', context)


def publications(request):
    data = _get_data()
    if not data:
        return render(request, 'portfolio_app/publications.html', {'no_data': True})
    pubs = sorted(
        data.get('research', []),
        key=lambda x: x.get('year', ''),
        reverse=True,
    )
    context = {
        'profile': _build_profile(data),
        'publications': pubs,
    }
    return render(request, 'portfolio_app/publications.html', context)


def certifications(request):
    data = _get_data()
    if not data:
        return render(request, 'portfolio_app/certifications.html', {'no_data': True})
    certs = sorted(
        data.get('certifications', []),
        key=lambda x: x.get('year', ''),
        reverse=True,
    )
    context = {
        'profile': _build_profile(data),
        'certifications': certs,
    }
    return render(request, 'portfolio_app/certifications.html', context)
