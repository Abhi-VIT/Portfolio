import json

from django.conf import settings
from django.contrib.staticfiles import finders
from django.test import TestCase
from django.urls import reverse


class InteractivePortfolioTests(TestCase):
    def test_home_renders_all_guided_rooms(self):
        response = self.client.get(reverse('portfolio_app:home'))

        self.assertEqual(response.status_code, 200)
        for room_id in ('welcome', 'experience', 'projects', 'skills', 'education', 'research', 'contact'):
            self.assertContains(response, f'id="{room_id}"')

    def test_home_uses_latest_resume_content(self):
        response = self.client.get(reverse('portfolio_app:home'))

        self.assertContains(response, 'TOEHO AI')
        self.assertContains(response, 'Graph Net')
        self.assertContains(response, 'CGPA: 8.65')
        self.assertContains(response, 'TCS NQT Qualified')
        self.assertContains(response, 'https://ieeexplore.ieee.org/document/11396244')

    def test_home_exposes_first_person_controls_and_presenter(self):
        response = self.client.get(reverse('portfolio_app:home'))

        self.assertContains(response, 'FIRST-PERSON TOUR')
        self.assertContains(response, 'drag to look')
        self.assertContains(response, 'ABHISHEK / YOUR GUIDE')
        self.assertContains(response, 'id="portfolio-data"')
        self.assertNotContains(response, '{{ skill.')
        self.assertNotContains(response, '{{ education.')

    def test_interactive_assets_are_discoverable(self):
        for asset in (
            'portfolio_app/css/home.css',
            'portfolio_app/js/home-3d.js',
            'portfolio_app/js/guide-model.mjs',
            'portfolio_app/js/guide-animation.mjs',
            'portfolio_app/models/shadowed-ensemble.glb',
            'portfolio_app/vendor/three/three.module.js',
            'portfolio_app/vendor/three/loaders/GLTFLoader.js',
            'portfolio_app/vendor/three/utils/BufferGeometryUtils.js',
            'portfolio_app/images/abhishek-guide.jpg',
            'portfolio_app/images/og-portfolio.png',
            'portfolio_app/images/skills/python.png',
            'portfolio_app/images/skills/tableau.png',
            'portfolio_app/images/skills/powerbi.png',
            'portfolio_app/files/Abhishek_Kumar_Resume.pdf',
        ):
            self.assertIsNotNone(finders.find(asset), asset)

    def test_every_skill_uses_a_local_png_texture(self):
        portfolio = json.loads((settings.BASE_DIR / 'resume_data.json').read_text(encoding='utf-8'))

        for skill in portfolio['skills']:
            self.assertTrue(skill['logo'].endswith('.png'), skill['name'])
            self.assertIsNotNone(finders.find(skill['logo'].removeprefix('/static/')), skill['name'])

    def test_home_loads_the_supplied_model_and_local_three_module(self):
        response = self.client.get(reverse('portfolio_app:home'))
        self.assertContains(response, 'data-guide-model="/static/portfolio_app/models/shadowed-ensemble.glb"')
        self.assertContains(response, '"three": "/static/portfolio_app/vendor/three/three.module.js"')
        self.assertContains(response, 'Retry loading guide')

    def test_classic_portfolio_stays_available(self):
        response = self.client.get(reverse('portfolio_app:index'))

        self.assertEqual(response.status_code, 200)
