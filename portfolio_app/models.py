from django.db import models


class Profile(models.Model):
    full_name = models.CharField(max_length=200)
    title = models.CharField(max_length=200, blank=True)
    phone = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    summary = models.TextField(blank=True)
    photo = models.URLField(blank=True)
    github = models.URLField(blank=True)
    linkedin = models.URLField(blank=True)

    def __str__(self):
        return self.full_name


class Education(models.Model):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='educations')
    school = models.CharField(max_length=255)
    degree = models.CharField(max_length=255, blank=True)
    start_year = models.CharField(max_length=20, blank=True)
    end_year = models.CharField(max_length=20, blank=True)
    details = models.TextField(blank=True)
    location = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return f"{self.school} - {self.degree}"


class Skill(models.Model):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='skills')
    name = models.CharField(max_length=100)
    level = models.CharField(max_length=50, blank=True)
    logo = models.URLField(blank=True, help_text='URL to the skill logo')

    def __str__(self):
        return self.name


class Project(models.Model):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='projects')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    link = models.URLField(blank=True)
    tech = models.CharField(max_length=255, blank=True)
    year = models.CharField(max_length=4, blank=True)
    animation_logo = models.URLField(blank=True, help_text='URL to the animated logo/gif for the project')

    def __str__(self):
        return self.title


class Certification(models.Model):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='certifications')
    title = models.CharField(max_length=255)
    issuer = models.CharField(max_length=255, blank=True)
    year = models.CharField(max_length=20, blank=True)
    link = models.URLField(blank=True)

    def __str__(self):
        return self.title


class Experience(models.Model):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='experiences')
    title = models.CharField(max_length=255)
    company = models.CharField(max_length=255)
    location = models.CharField(max_length=255, blank=True)
    start_date = models.CharField(max_length=50)
    end_date = models.CharField(max_length=50)
    description = models.TextField(blank=True)

    def __str__(self):
        return f"{self.title} at {self.company}"


class Language(models.Model):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='languages')
    name = models.CharField(max_length=100)
    level = models.CharField(max_length=50)

    def __str__(self):
        return f"{self.name} - {self.level}"


class Research(models.Model):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='research')
    title = models.CharField(max_length=255)
    conference = models.CharField(max_length=255, blank=True)
    year = models.CharField(max_length=4, blank=True)
    abstract = models.TextField(blank=True)
    paper_link = models.URLField(blank=True)
    code_link = models.URLField(blank=True)
    technologies = models.CharField(max_length=255, blank=True)
    impact_factor = models.CharField(max_length=50, blank=True)

    def __str__(self):
        return self.title
