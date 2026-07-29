"""
Enterprise Configuration with Security Hardening
"""
import os
from datetime import timedelta

class Config:
    """Base configuration with security defaults"""
    
    # Security: Secret key from environment (REQUIRED in production)
    SECRET_KEY = os.environ.get('SECRET_KEY') or os.urandom(32).hex()
    
    # Database with connection pooling
    basedir = os.path.abspath(os.path.dirname(__file__))
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'sqlite:///' + os.path.join(basedir, '..', 'scbtss.db')
    
    # Fix for PostgreSQL URL (Railway/Heroku compatibility)
    if SQLALCHEMY_DATABASE_URI and SQLALCHEMY_DATABASE_URI.startswith('postgres://'):
        SQLALCHEMY_DATABASE_URI = SQLALCHEMY_DATABASE_URI.replace('postgres://', 'postgresql://', 1)
    
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,
        'pool_recycle': 300,
        'pool_size': 10,
        'max_overflow': 20
    }
    
    # Security Headers
    SECURITY_HEADERS = {
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'X-XSS-Protection': '1; mode=block',
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://code.jquery.com; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;"
    }
    
    # Session Security
    SESSION_COOKIE_SECURE = True  # HTTPS only
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    PERMANENT_SESSION_LIFETIME = timedelta(hours=24)
    
    # Rate Limiting
    RATELIMIT_ENABLED = True
    RATELIMIT_STORAGE_URL = "memory://"
    RATELIMIT_DEFAULT = "200 per hour"
    
    # Monitored Services (Enterprise Security Tools)
    MONITORED_SERVICES = {
        'splunk': {
            'process_names': ['splunkd', 'splunkd.exe', 'splunk'],
            'display_name': 'Splunk Enterprise',
            'category': 'SIEM',
            'criticality': 'CRITICAL',
            'vendor': 'Splunk Inc.'
        },
        'crowdstrike': {
            'process_names': ['CSFalconService', 'CSFalconContainer', 'falcon-sensor'],
            'display_name': 'CrowdStrike Falcon',
            'category': 'EDR',
            'criticality': 'CRITICAL',
            'vendor': 'CrowdStrike'
        },
        'carbonblack': {
            'process_names': ['RepMgr', 'CbDefense', 'cb.exe'],
            'display_name': 'VMware Carbon Black',
            'category': 'EDR',
            'criticality': 'CRITICAL',
            'vendor': 'VMware'
        }
    }
    
    # Fallback to common applications
    FALLBACK_SERVICES = {
        'chrome': {
            'process_names': ['chrome.exe', 'chrome', 'Google Chrome'],
            'display_name': 'Google Chrome',
            'category': 'Browser',
            'criticality': 'MEDIUM',
            'vendor': 'Google'
        },
        'vscode': {
            'process_names': ['Code.exe', 'code', 'Visual Studio Code'],
            'display_name': 'Visual Studio Code',
            'category': 'Development',
            'criticality': 'MEDIUM',
            'vendor': 'Microsoft'
        },
        'slack': {
            'process_names': ['slack.exe', 'slack', 'Slack'],
            'display_name': 'Slack',
            'category': 'Communication',
            'criticality': 'MEDIUM',
            'vendor': 'Salesforce'
        }
    }
    
    # Monitoring Configuration
    MONITOR_INTERVAL = int(os.environ.get('MONITOR_INTERVAL', 60))
    BASELINE_INTERVAL = int(os.environ.get('BASELINE_INTERVAL', 3600))
    SCORE_INTERVAL = int(os.environ.get('SCORE_INTERVAL', 300))
    
    # Scoring Thresholds
    THRESHOLDS = {
        'GREEN': 80,
        'YELLOW': 60,
        'ORANGE': 40,
        'RED': 0
    }
    
    # Baseline Learning Configuration
    BASELINE_LEARNING_DAYS = 1
    BASELINE_MIN_SAMPLES = 20
    BASELINE_CONFIDENCE_THRESHOLD = 0.7
    
    # Deduction Points for Anomalies
    DEDUCTION_POINTS = {
        'new_ip': -5,
        'new_port': -3,
        'connection_spike': -10,
        'new_process': -15,
        'cpu_spike': -8,
        'memory_spike': -8,
        'privilege_escalation': -20
    }
    
    # Logging Configuration
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')
    LOG_FILE = 'logs/scbtss.log'
    LOG_MAX_BYTES = 10 * 1024 * 1024  # 10MB
    LOG_BACKUP_COUNT = 10
    
    # Pagination
    EVENTS_PER_PAGE = 100
    SCORES_PER_PAGE = 50
    
    # API Configuration
    API_TITLE = 'SCBTSS API'
    API_VERSION = '1.0'

class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    TESTING = False
    SESSION_COOKIE_SECURE = False  # Allow HTTP in dev

class ProductionConfig(Config):
    """Production configuration with enhanced security"""
    DEBUG = False
    TESTING = False
    
    # Force all security features
    SESSION_COOKIE_SECURE = True
    
    # Production logging
    LOG_LEVEL = 'WARNING'
    
    @classmethod
    def init_app(cls, app):
        Config.init_app(app)
        
        # Production-specific initialization
        import logging
        from logging.handlers import SysLogHandler
        syslog_handler = SysLogHandler()
        syslog_handler.setLevel(logging.WARNING)
        app.logger.addHandler(syslog_handler)

class TestingConfig(Config):
    """Testing configuration"""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    WTF_CSRF_ENABLED = False

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}