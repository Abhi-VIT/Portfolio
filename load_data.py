import os
import sys
import django
import json

# Add the project directory to the Python path
project_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(project_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'portfolio.settings')
django.setup()

from portfolio_app.models import Profile, Education, Skill, Project, Certification, Experience, Language, Research

# Clear existing data
Profile.objects.all().delete()
Education.objects.all().delete()
Skill.objects.all().delete()
Project.objects.all().delete()
Certification.objects.all().delete()
Experience.objects.all().delete()
Language.objects.all().delete()
Research.objects.all().delete()

# Load data from JSON
with open('resume_data.json', 'r') as f:
    data = json.load(f)

# Create Profile
profile = Profile.objects.create(
    full_name=data['full_name'],
    title=data['title'],
    phone=data['phone'],
    email=data['email'],
    photo=data['photo'],
    linkedin=data['links']['linkedin'],
    github=data['links']['github'],
    summary=data['summary']
)

# Create Education
for edu in data['education']:
    Education.objects.create(
        profile=profile,
        school=edu['school'],
        degree=edu['degree'],
        start_year=edu['start_year'],
        end_year=edu['end_year'],
        location=edu['location'],
        details=edu.get('details', '')
    )

# Create Skills
for skill in data['skills']:
    Skill.objects.create(
        profile=profile,
        name=skill['name'],
        level=skill['level'],
        logo=skill['logo']
    )

# Create Projects
for proj in data['projects']:
    Project.objects.create(
        profile=profile,
        title=proj['title'],
        description=proj['description'],
        year=proj['year'],
        tech=proj['tech'],
        link=proj.get('link', ''),
        animation_logo=proj['animation_logo']
    )

# Create Certifications
for cert in data['certifications']:
    Certification.objects.create(
        profile=profile,
        title=cert['title'],
        issuer=cert['issuer'],
        year=cert['year'],
        link=cert.get('link', '')
    )

# Create Experience
for exp in data['experience']:
    Experience.objects.create(
        profile=profile,
        title=exp['title'],
        company=exp['company'],
        location=exp['location'],
        start_date=exp['start_date'],
        end_date=exp['end_date'],
        description=exp['description']
    )

# Create Languages
for lang in data['languages']:
    Language.objects.create(
        profile=profile,
        name=lang['name'],
        level=lang['level']
    )

# Create Research Papers
for research in data['research']:
    Research.objects.create(
        profile=profile,
        title=research['title'],
        conference=research['conference'],
        year=research['year'],
        abstract=research['abstract'],
        paper_link=research['paper_link'],
        code_link=research['code_link'],
        impact_factor=research['impact_factor'],
        technologies=research['technologies']
    )

print("Data loaded successfully!")