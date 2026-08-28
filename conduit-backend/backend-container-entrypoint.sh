#!/bin/sh
python manage.py migrate
gunicorn conduit.wsgi:application --bind 0.0.0.0:8000
