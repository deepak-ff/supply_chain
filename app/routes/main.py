"""
Main routes for web interface
Secure rendering with CSRF protection
"""
from flask import Blueprint, render_template, current_app
from app.models import Service, Score, Alert
from sqlalchemy import func

main_bp = Blueprint('main', __name__)

@main_bp.route('/')
def index():
    """Main dashboard"""
    try:
        # Get basic stats
        total_services = Service.query.filter_by(is_active=True).count()
        total_alerts = Alert.query.filter_by(is_acknowledged=False).count()
        
        # Get latest scores
        latest_scores = db.session.query(
            Service, Score
        ).join(Score).filter(
            Service.is_active == True
        ).order_by(Score.timestamp.desc()).limit(10).all()
        
        return render_template('index.html',
                             total_services=total_services,
                             total_alerts=total_alerts)
    except Exception as e:
        current_app.logger.error(f'Dashboard error: {e}')
        return render_template('index.html',
                             total_services=0,
                             total_alerts=0)

@main_bp.route('/demo')
def demo():
    """Attack simulation demo page"""
    return render_template('demo.html')

@main_bp.route('/health')
def health():
    """Health check endpoint for monitoring"""
    try:
        # Check database connectivity
        db.session.execute('SELECT 1')
        return {'status': 'healthy', 'database': 'connected'}, 200
    except Exception as e:
        current_app.logger.error(f'Health check failed: {e}')
        return {'status': 'unhealthy', 'error': str(e)}, 503