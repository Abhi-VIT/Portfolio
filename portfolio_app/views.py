from django.shortcuts import render
from .models import Profile


def index(request):
    profile = Profile.objects.first()
    if not profile:
        return render(request, 'portfolio_app/index.html', {'no_data': True})
    context = {
        'profile': profile,
        'educations': profile.educations.all(),
        'skills': profile.skills.all(),
        'projects': profile.projects.all(),
        'certifications': profile.certifications.all(),
        'experiences': profile.experiences.all(),
        'languages': profile.languages.all(),
        'research': profile.research.all(),
    }
    return render(request, 'portfolio_app/index.html', context)


def home(request):
    profile = Profile.objects.first()
    if not profile:
        return render(request, 'portfolio_app/home.html', {'no_data': True})
    return render(request, 'portfolio_app/home.html', {'profile': profile})


def about(request):
    profile = Profile.objects.first()
    if not profile:
        return render(request, 'portfolio_app/about.html', {'no_data': True})
    context = {
        'profile': profile,
        'educations': profile.educations.all(),
        'languages': profile.languages.all(),
    }
    return render(request, 'portfolio_app/about.html', context)


def experience(request):
    profile = Profile.objects.first()
    if not profile:
        return render(request, 'portfolio_app/experience.html', {'no_data': True})
    context = {
        'profile': profile,
        'experiences': profile.experiences.all().order_by('-start_date'),
    }
    return render(request, 'portfolio_app/experience.html', context)


def skills(request):
    profile = Profile.objects.first()
    if not profile:
        return render(request, 'portfolio_app/skills.html', {'no_data': True})
    context = {
        'profile': profile,
        'skills': profile.skills.all(),
    }
    return render(request, 'portfolio_app/skills.html', context)


def projects(request):
    profile = Profile.objects.first()

    if not profile:
        return render(request, 'portfolio_app/projects.html', {'no_data': True})
    context = {
        'profile': profile,
        'projects': profile.projects.all().order_by('-year'),
    }
    return render(request, 'portfolio_app/projects.html', context)


def publications(request):
    profile = Profile.objects.first()
    if not profile:
        return render(request, 'portfolio_app/publications.html', {'no_data': True})
    context = {
        'profile': profile,
        'publications': profile.research.all().order_by('-year'),
    }
    return render(request, 'portfolio_app/publications.html', context)


def certifications(request):
    profile = Profile.objects.first()
    if not profile:
        return render(request, 'portfolio_app/certifications.html', {'no_data': True})
    context = {
        'profile': profile,
        'certifications': profile.certifications.all().order_by('-year'),
    }
    return render(request, 'portfolio_app/certifications.html', context)
