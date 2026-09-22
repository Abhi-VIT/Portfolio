# Abhishek Kumar - Interactive FPP Portfolio

This Django portfolio presents the resume as a first-person walkthrough. Scroll or use the arrow/WASD controls to move between rooms, drag to look around, and follow the animated 3D presenter through experience, projects, skills, education, research, and contact sections.

## Launch the website

The project virtual environment is already available at `.venv`. From PowerShell in this folder, run:

```powershell
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py runserver
```

Then open http://127.0.0.1:8000/.

You can also double-click `start_portfolio.bat`, which checks the environment, applies migrations, and starts the server for you.

## Recreate the environment

If `.venv` is removed or the project is copied to another computer, run:

```powershell
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py runserver
```

If PowerShell activation is preferred, use:

```powershell
.\.venv\Scripts\Activate.ps1
python manage.py runserver
```

## Presenter model

The 3D guide uses the supplied `Shadowed Ensemble.glb`, stored locally at
`portfolio_app/static/portfolio_app/models/shadowed-ensemble.glb`. Its textures
are embedded; no external model or texture service is needed. Three.js 0.169.0
and its GLTF loader are vendored under `static/portfolio_app/vendor/three/`
with the upstream MIT license.

The supplied GLB has no skeleton or animation clips. `guide-animation.mjs` adds
a lightweight runtime hip/knee/ankle rig with blended vertex weights. Steps are
driven by distance traveled, ease to a stop at gates and presentation spots,
and respect reduced-motion preferences. Shoe-sole sampling keeps the feet at
floor level. The animated footprint is included in the navigation clearance.
The guided tour waits for the presenter to arrive before advancing again.

A clothing-only material treatment adds a matte navy suit, white shirt, lapels
and burgundy tie while preserving the original face, hair and hand textures.
The source GLB is unchanged. This is a procedural walking rig, not a complete
motion-captured character; seated poses and articulated hand gestures are not
implemented. Projects are presented standing beside the workstation.

Checks: `node tests/guide-model.test.mjs`, `node tests/guide-animation.test.mjs`,
`node tests/guide-navigation.test.mjs`,
and `.\.venv\Scripts\python.exe manage.py test`.

## Updating resume data

The interactive home page reads directly from `resume_data.json`. The classic database-backed pages can be refreshed with:

```powershell
.\.venv\Scripts\python.exe manage.py load_resume_data
```
