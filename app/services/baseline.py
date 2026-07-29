"""
Baseline Learning Service
Statistical analysis of normal behavior
"""
from datetime import datetime, timedelta
from collections import defaultdict
import statistics
from app import db
from app.models import Service, Event, Baseline

class BaselineService:
    """Calculate and manage behavioral baselines"""
    
    def __init__(self, app):
        self.app = app
        self.learning_days = app.config['BASELINE_LEARNING_DAYS']
        self.min_samples = app.config['BASELINE_MIN_SAMPLES']
        self.confidence_threshold = app.config['BASELINE_CONFIDENCE_THRESHOLD']
    
    def calculate_baseline_for_service(self, service_id):
        """Calculate all baselines for a specific service"""
        with self.app.app_context():
            try:
                service = Service.query.get(service_id)
                if not service:
                    self.app.logger.error(f"Service {service_id} not found")
                    return
                
                self.app.logger.info(f"📊 Calculating baselines for {service.display_name}")
                
                # Calculate network baseline
                network_baseline = self._calculate_network_baseline(service_id)
                if network_baseline:
                    self._save_baseline(
                        service_id, 
                        'network_behavior', 
                        'network', 
                        network_baseline
                    )
                    self.app.logger.info(f"  ✓ Network baseline calculated")
                
                # Calculate process baseline
                process_baseline = self._calculate_process_baseline(service_id)
                if process_baseline:
                    self._save_baseline(
                        service_id,
                        'process_behavior',
                        'process',
                        process_baseline
                    )
                    self.app.logger.info(f"  ✓ Process baseline calculated")
                
                # Update service status
                if network_baseline or process_baseline:
                    service.status = 'monitoring'
                    db.session.commit()
                    self.app.logger.info(f"✅ {service.display_name} is now in monitoring mode")
                
            except Exception as e:
                self.app.logger.error(f"Baseline calculation error: {e}")
                db.session.rollback()
    
    def _calculate_network_baseline(self, service_id):
        """Calculate network behavior baseline"""
        time_threshold = datetime.utcnow() - timedelta(days=self.learning_days)
        
        events = Event.query.filter(
            Event.service_id == service_id,
            Event.event_type == 'network',
            Event.is_simulated == False,
            Event.timestamp > time_threshold
        ).all()
        
        if len(events) < self.min_samples:
            self.app.logger.warning(
                f"Not enough network events ({len(events)}/{self.min_samples})"
            )
            return None
        
        # Extract network data
        unique_ips = set()
        unique_ports = set()
        connection_counts = []
        
        for event in events:
            data = event.event_data
            connections = data.get('connections', [])
            connection_counts.append(len(connections))
            
            for conn in connections:
                if conn.get('remote_ip'):
                    unique_ips.add(conn['remote_ip'])
                if conn.get('remote_port'):
                    unique_ports.add(conn['remote_port'])
        
        # Calculate statistics
        baseline = {
            'unique_ips': list(unique_ips)[:100],  # Limit to 100 IPs
            'unique_ports': list(unique_ports)[:50],
            'ip_count': len(unique_ips),
            'port_count': len(unique_ports),
            'connection_stats': {
                'mean': statistics.mean(connection_counts) if connection_counts else 0,
                'stdev': statistics.stdev(connection_counts) if len(connection_counts) > 1 else 0,
                'min': min(connection_counts) if connection_counts else 0,
                'max': max(connection_counts) if connection_counts else 0
            },
            'sample_size': len(events),
            'learning_period_days': self.learning_days
        }
        
        return baseline
    
    def _calculate_process_baseline(self, service_id):
        """Calculate process behavior baseline"""
        time_threshold = datetime.utcnow() - timedelta(days=self.learning_days)
        
        events = Event.query.filter(
            Event.service_id == service_id,
            Event.event_type == 'process',
            Event.is_simulated == False,
            Event.timestamp > time_threshold
        ).all()
        
        if len(events) < self.min_samples:
            self.app.logger.warning(
                f"Not enough process events ({len(events)}/{self.min_samples})"
            )
            return None
        
        # Extract process data
        process_names = set()
        cpu_percentages = []
        memory_percentages = []
        thread_counts = []
        
        for event in events:
            data = event.event_data
            
            if data.get('name'):
                process_names.add(data['name'])
            
            if data.get('cpu_percent') is not None:
                cpu_percentages.append(data['cpu_percent'])
            
            if data.get('memory_percent') is not None:
                memory_percentages.append(data['memory_percent'])
            
            if data.get('num_threads') is not None:
                thread_counts.append(data['num_threads'])
        
        baseline = {
            'normal_processes': list(process_names),
            'cpu_stats': {
                'mean': statistics.mean(cpu_percentages) if cpu_percentages else 0,
                'stdev': statistics.stdev(cpu_percentages) if len(cpu_percentages) > 1 else 0,
                'max': max(cpu_percentages) if cpu_percentages else 0,
                'p95': statistics.quantiles(cpu_percentages, n=20)[18] if len(cpu_percentages) > 20 else 0
            },
            'memory_stats': {
                'mean': statistics.mean(memory_percentages) if memory_percentages else 0,
                'stdev': statistics.stdev(memory_percentages) if len(memory_percentages) > 1 else 0,
                'max': max(memory_percentages) if memory_percentages else 0,
                'p95': statistics.quantiles(memory_percentages, n=20)[18] if len(memory_percentages) > 20 else 0
            },
            'thread_stats': {
                'mean': statistics.mean(thread_counts) if thread_counts else 0,
                'max': max(thread_counts) if thread_counts else 0
            },
            'sample_size': len(events),
            'learning_period_days': self.learning_days
        }
        
        return baseline
    
    def _save_baseline(self, service_id, metric_name, metric_type, baseline_data):
        """Save or update baseline in database"""
        try:
            # Check if baseline exists
            existing = Baseline.query.filter_by(
                service_id=service_id,
                metric_name=metric_name
            ).first()
            
            # Calculate confidence
            sample_size = baseline_data.get('sample_size', 0)
            confidence = min(sample_size / 100.0, 1.0)
            
            if existing:
                # Update existing
                existing.baseline_data = baseline_data
                existing.confidence = confidence
                existing.sample_size = sample_size
                existing.is_valid = confidence >= self.confidence_threshold
                existing.updated_at = datetime.utcnow()
            else:
                # Create new
                baseline = Baseline(
                    service_id=service_id,
                    metric_name=metric_name,
                    metric_type=metric_type,
                    baseline_data=baseline_data,
                    confidence=confidence,
                    sample_size=sample_size,
                    is_valid=confidence >= self.confidence_threshold,
                    learning_period_days=self.learning_days
                )
                db.session.add(baseline)
            
            db.session.commit()
            
        except Exception as e:
            db.session.rollback()
            self.app.logger.error(f"Error saving baseline: {e}")
    
    def calculate_all_baselines(self):
        """Calculate baselines for all active services"""
        with self.app.app_context():
            services = Service.query.filter_by(is_active=True).all()
            
            if not services:
                self.app.logger.warning("No active services found")
                return
            
            self.app.logger.info(f"🔄 Calculating baselines for {len(services)} services")
            
            for service in services:
                try:
                    self.calculate_baseline_for_service(service.id)
                except Exception as e:
                    self.app.logger.error(
                        f"Error calculating baseline for {service.display_name}: {e}"
                    )
            
            self.app.logger.info("✅ Baseline calculation complete")