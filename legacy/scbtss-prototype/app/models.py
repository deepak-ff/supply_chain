"""
Database Models with Security and Audit Logging
"""
from datetime import datetime
from sqlalchemy import Index
from sqlalchemy.dialects.postgresql import JSONB
from app import db

class AuditMixin:
    """Mixin for audit trails"""
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by = db.Column(db.String(100), default='system')
    updated_by = db.Column(db.String(100), default='system')

class Service(db.Model, AuditMixin):
    """
    Monitored Service/Vendor Software
    Represents critical security tools or applications being monitored
    """
    __tablename__ = 'services'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False, index=True)
    display_name = db.Column(db.String(200), nullable=False)
    vendor = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(50), nullable=False, index=True)
    criticality = db.Column(db.String(20), nullable=False, index=True)
    version = db.Column(db.String(50))
    status = db.Column(db.String(20), default='learning', index=True)
    first_seen = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    last_seen = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    is_active = db.Column(db.Boolean, default=True, index=True)
    
    # Relationships
    events = db.relationship('Event', backref='service', lazy='dynamic', 
                           cascade='all, delete-orphan')
    baselines = db.relationship('Baseline', backref='service', lazy='dynamic',
                               cascade='all, delete-orphan')
    scores = db.relationship('Score', backref='service', lazy='dynamic',
                            cascade='all, delete-orphan')
    alerts = db.relationship('Alert', backref='service', lazy='dynamic',
                            cascade='all, delete-orphan')
    
    __table_args__ = (
        Index('idx_service_status_active', 'status', 'is_active'),
    )
    
    def __repr__(self):
        return f'<Service {self.display_name}>'
    
    def to_dict(self):
        """Serialize to dictionary"""
        return {
            'id': self.id,
            'name': self.name,
            'display_name': self.display_name,
            'vendor': self.vendor,
            'category': self.category,
            'criticality': self.criticality,
            'status': self.status,
            'first_seen': self.first_seen.isoformat() if self.first_seen else None,
            'last_seen': self.last_seen.isoformat() if self.last_seen else None,
            'is_active': self.is_active
        }

class Event(db.Model):
    """
    Security Event from Monitored Service
    Stores behavioral data for baseline learning and anomaly detection
    """
    __tablename__ = 'events'
    
    id = db.Column(db.Integer, primary_key=True)
    service_id = db.Column(db.Integer, db.ForeignKey('services.id', ondelete='CASCADE'), 
                          nullable=False, index=True)
    event_type = db.Column(db.String(50), nullable=False, index=True)
    event_data = db.Column(db.JSON, nullable=False)
    is_simulated = db.Column(db.Boolean, default=False, index=True)
    severity = db.Column(db.String(20), default='INFO')
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    __table_args__ = (
        Index('idx_event_service_time', 'service_id', 'timestamp'),
        Index('idx_event_type_time', 'event_type', 'timestamp'),
        Index('idx_event_simulated', 'is_simulated', 'timestamp'),
    )
    
    def __repr__(self):
        return f'<Event {self.event_type} at {self.timestamp}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'service_id': self.service_id,
            'event_type': self.event_type,
            'event_data': self.event_data,
            'is_simulated': self.is_simulated,
            'timestamp': self.timestamp.isoformat()
        }

class Baseline(db.Model, AuditMixin):
    """
    Behavioral Baseline for Service
    Statistical profile of normal behavior
    """
    __tablename__ = 'baselines'
    
    id = db.Column(db.Integer, primary_key=True)
    service_id = db.Column(db.Integer, db.ForeignKey('services.id', ondelete='CASCADE'),
                          nullable=False, index=True)
    metric_name = db.Column(db.String(100), nullable=False)
    metric_type = db.Column(db.String(50), nullable=False, index=True)
    baseline_data = db.Column(db.JSON, nullable=False)
    confidence = db.Column(db.Float, default=0.0)
    sample_size = db.Column(db.Integer, default=0)
    learning_period_days = db.Column(db.Integer, default=1)
    is_valid = db.Column(db.Boolean, default=True)
    
    __table_args__ = (
        db.UniqueConstraint('service_id', 'metric_name', name='uq_service_metric'),
        Index('idx_baseline_confidence', 'confidence'),
    )
    
    def __repr__(self):
        return f'<Baseline {self.metric_name} for service {self.service_id}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'service_id': self.service_id,
            'metric_name': self.metric_name,
            'metric_type': self.metric_type,
            'baseline_data': self.baseline_data,
            'confidence': self.confidence,
            'sample_size': self.sample_size,
            'updated_at': self.updated_at.isoformat()
        }

class Score(db.Model):
    """
    Dynamic Trust Score (DTS)
    Real-time security posture score
    """
    __tablename__ = 'scores'
    
    id = db.Column(db.Integer, primary_key=True)
    service_id = db.Column(db.Integer, db.ForeignKey('services.id', ondelete='CASCADE'),
                          nullable=False, index=True)
    dts_score = db.Column(db.Integer, nullable=False)
    zone = db.Column(db.String(20), nullable=False, index=True)
    network_score = db.Column(db.Integer, default=100)
    process_score = db.Column(db.Integer, default=100)
    deviation_count = db.Column(db.Integer, default=0)
    deviations = db.Column(db.JSON, default=list)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    __table_args__ = (
        Index('idx_score_service_time', 'service_id', 'timestamp'),
        Index('idx_score_zone_time', 'zone', 'timestamp'),
    )
    
    def __repr__(self):
        return f'<Score {self.dts_score} ({self.zone}) at {self.timestamp}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'service_id': self.service_id,
            'dts_score': self.dts_score,
            'zone': self.zone,
            'network_score': self.network_score,
            'process_score': self.process_score,
            'deviation_count': self.deviation_count,
            'deviations': self.deviations,
            'timestamp': self.timestamp.isoformat()
        }

class Alert(db.Model):
    """
    Security Alert
    Generated when anomalies detected
    """
    __tablename__ = 'alerts'
    
    id = db.Column(db.Integer, primary_key=True)
    service_id = db.Column(db.Integer, db.ForeignKey('services.id', ondelete='CASCADE'),
                          nullable=False, index=True)
    severity = db.Column(db.String(20), nullable=False, index=True)
    title = db.Column(db.String(200), nullable=False)
    message = db.Column(db.Text, nullable=False)
    details = db.Column(db.JSON, default=dict)
    is_acknowledged = db.Column(db.Boolean, default=False, index=True)
    acknowledged_at = db.Column(db.DateTime)
    acknowledged_by = db.Column(db.String(100))
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    __table_args__ = (
        Index('idx_alert_severity_ack', 'severity', 'is_acknowledged'),
        Index('idx_alert_service_time', 'service_id', 'timestamp'),
    )
    
    def __repr__(self):
        return f'<Alert {self.severity}: {self.title}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'service_id': self.service_id,
            'severity': self.severity,
            'title': self.title,
            'message': self.message,
            'details': self.details,
            'is_acknowledged': self.is_acknowledged,
            'timestamp': self.timestamp.isoformat()
        }