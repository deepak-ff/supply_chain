"""
WSGI Entry Point for Production Deployment
"""
from app import create_app

app = create_app()
import os
from app import create_app, db
from app.models import Service, Event, Baseline, Score, Alert

config_name = os.environ.get('FLASK_ENV', 'production')
app = create_app(config_name)

@app.shell_context_processor
def make_shell_context():
    return {
        'db': db,
        'Service': Service,
        'Event': Event,
        'Baseline': Baseline,
        'Score': Score,
        'Alert': Alert
    }

if __name__ == "__main__":
    app.run()