#!/bin/bash
# Vercel build script — installs dependencies and collects static files.

echo ">>> Installing Python dependencies..."
pip install -r requirements.txt

echo ">>> Collecting static files..."
python manage.py collectstatic --noinput

echo ">>> Build complete."
