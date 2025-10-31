# Minimal Django Portfolio

This is a minimal, modern, responsive personal portfolio built with Django. It displays content dynamically from models and can import resume data from a JSON file.

Quick start (Windows PowerShell):

1. Create and activate a virtual environment

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

2. Install dependencies

```powershell
pip install -r requirements.txt
```

3. Run migrations

```powershell
python manage.py migrate
```

4. Load sample resume data (or provide your own `resume_data.json` at the project root)

```powershell
python manage.py load_resume
```

5. Create a superuser (optional, to edit via admin)

```powershell
python manage.py createsuperuser
```

6. Run the dev server

```powershell
python manage.py runserver
```

Then open http://127.0.0.1:8000/ to view the portfolio.

Notes and assumptions:
- The original PDF resume file was not attached; instead this project provides a JSON import mechanism. Replace fields in `resume_data.json` with contents from your resume, or use the Django admin to enter data.
- Replace `SECRET_KEY` in `portfolio_project/settings.py` before deploying to production and set `DEBUG=False`.

Next steps (optional):
- Parse the PDF programmatically and map fields into `resume_data.json`.
- Add contact form with email sending (requires SMTP configuration).
