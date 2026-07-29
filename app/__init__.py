"""
Application Factory with Security Middleware
"""
from flask import Flask, request, make_response
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
import os
import logging
from logging.handlers import RotatingFileHandler

db = SQLAlchemy()
migrate = Migrate()

def create_app(config_name=None):
    """Create and configure the Flask application"""
    
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'production')
    
    app = Flask(__name__, instance_relative_config=True)
    
    # Load configuration
    from app.config import config
    app.config.from_object(config[config_name])
    
    # Ensure instance folder exists
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass
    
    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    
    # Setup logging
    setup_logging(app)
    
    # Register security middleware
    register_security_middleware(app)
    
    # Register blueprints
    from app.routes.main import main_bp
    from app.routes.api import api_bp
    
    app.register_blueprint(main_bp)
    app.register_blueprint(api_bp, url_prefix='/api')
    
    # Create database tables
    with app.app_context():
        db.create_all()
        app.logger.info('Database initialized')
    
    # Register error handlers
    register_error_handlers(app)
    
    app.logger.info(f'SCBTSS started in {config_name} mode')
    
    return app

def setup_logging(app):
    """Configure application logging"""
    if not os.path.exists('logs'):
        os.mkdir('logs')
    
    file_handler = RotatingFileHandler(
        app.config['LOG_FILE'],
        maxBytes=app.config['LOG_MAX_BYTES'],
        backupCount=app.config['LOG_BACKUP_COUNT']
    )
    
    file_handler.setFormatter(logging.Formatter(
        '[%(asctime)s] %(levelname)s in %(module)s: %(message)s'
    ))
    
    file_handler.setLevel(getattr(logging, app.config['LOG_LEVEL']))
    app.logger.addHandler(file_handler)
    app.logger.setLevel(getattr(logging, app.config['LOG_LEVEL']))

def register_security_middleware(app):
    """Register security middleware"""
    
    @app.after_request
    def set_security_headers(response):
        """Add security headers to all responses"""
        for header, value in app.config['SECURITY_HEADERS'].items():
            response.headers[header] = value
        return response
    
    @app.before_request
    def log_request():
        """Log all incoming requests"""
        app.logger.info(f'{request.method} {request.path} from {request.remote_addr}')
    
    @app.after_request
    def log_response(response):
        """Log all responses"""
        app.logger.info(f'Response: {response.status_code}')
        return response

def register_error_handlers(app):
    """Register error handlers"""
    
    @app.errorhandler(400)
    def bad_request(error):
        app.logger.warning(f'Bad request: {error}')
        return {'error': 'Bad request'}, 400
    
    @app.errorhandler(404)
    def not_found(error):
        app.logger.warning(f'Not found: {request.url}')
        return {'error': 'Resource not found'}, 404
    
    @app.errorhandler(500)
    def internal_error(error):
        app.logger.error(f'Internal error: {error}')
        db.session.rollback()
        return {'error': 'Internal server error'}, 500