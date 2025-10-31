import json
from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
from portfolio_app.models import Profile, Education, Skill, Project, Certification, Experience, Language
from pathlib import Path


class Command(BaseCommand):
    help = 'Load resume data from resume_data.json into the database'

    def add_arguments(self, parser):
        parser.add_argument('--file', help='Path to resume json file', default=str(Path(settings.BASE_DIR) / 'resume_data.json'))

    def handle(self, *args, **options):
        path = Path(options['file'])
        if not path.exists():
            raise CommandError(f'File not found: {path}')

        with path.open('r', encoding='utf-8') as f:
            data = json.load(f)

        # Clear all existing data
        Profile.objects.all().delete()

        links = data.get('links', {})
        p = Profile.objects.create(
            full_name=data.get('full_name', 'Your Name'),
            title=data.get('title', ''),
            phone=data.get('phone', ''),
            email=data.get('email', ''),
            summary=data.get('summary', ''),
            photo=data.get('photo', ''),
            github=links.get('github', ''),
            linkedin=links.get('linkedin', ''),
        )

        for ed in data.get('education', []):
            Education.objects.create(
                profile=p,
                school=ed.get('school', ''),
                degree=ed.get('degree', ''),
                start_year=ed.get('start_year', ''),
                end_year=ed.get('end_year', ''),
                details=ed.get('details', '')
            )

        for s in data.get('skills', []):
            Skill.objects.create(
                profile=p,
                name=s.get('name', ''),
                level=s.get('level', ''),
                logo=s.get('logo', '')
            )

        for pr in data.get('projects', []):
            Project.objects.create(
                profile=p,
                title=pr.get('title', ''),
                description=pr.get('description', ''),
                link=pr.get('link', ''),
                tech=pr.get('tech', ''),
                animation_logo=pr.get('animation_logo', '')
            )

        for c in data.get('certifications', []):
            Certification.objects.create(
                profile=p,
                title=c.get('title', ''),
                issuer=c.get('issuer', ''),
                year=c.get('year', ''),
                link=c.get('link', '')
            )

        for exp in data.get('experience', []):
            Experience.objects.create(
                profile=p,
                title=exp.get('title', ''),
                company=exp.get('company', ''),
                location=exp.get('location', ''),
                start_date=exp.get('start_date', ''),
                end_date=exp.get('end_date', ''),
                description=exp.get('description', '')
            )

        for lang in data.get('languages', []):
            Language.objects.create(
                profile=p,
                name=lang.get('name', ''),
                level=lang.get('level', '')
            )

        self.stdout.write(self.style.SUCCESS('Resume data loaded successfully'))