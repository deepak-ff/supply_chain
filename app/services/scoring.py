"""
Dynamic Trust Scoring Service
Real-time threat scoring based on behavioral deviations
"""
from datetime import datetime, timedelta
import statistics
from app import db
from app.models import Service, Event, Baseline, Score, Alert

class ScoringService:
    """Calculate Dynamic Trust Scores (DTS)"""
    
    def __init__(self, app):
        self.app = app
        self.thresholds = app.config['THRESHOLDS']
        self.deductions = app.config['DEDUCTION_POINTS']
        self.score_interval = app.config['SCORE_INTERVAL']
        
        # Scoring weights
        self.weights = {
            'network': 0.50,  # 50% weight
            'process': 0.50   # 50% weight
        }
    
    def calculate_score_for_service(self, service_id):
        """Calculate DTS for a specific service"""
        with self.app.app_context():
            try:
                service = Service.query.get(service_id)
                if not service:
                    return None
                
                # Get baselines
                network_baseline = self._get_baseline(service_id, 'network_behavior')
                process_baseline = self._get_baseline(service_id, 'process_behavior')
                
                if not network_baseline and not process_baseline:
                    # No baselines yet, return perfect score
                    self._save_score(service_id, 100, 'GREEN', [], 100, 100)
                    return 100
                
                # Get recent events (last 5 minutes)
                # Include simulated attack events so demo attacks impact scoring.
                time_threshold = datetime.utcnow() - timedelta(seconds=self.score_interval)
                recent_events = Event.query.filter(
                    Event.service_id == service_id,
                    Event.timestamp > time_threshold
                ).all()
                
                if not recent_events:
                    # No recent activity: reset to default if baselines exist.
                    if network_baseline or process_baseline:
                        self._save_score(service_id, 100, 'GREEN', [], 100, 100)
                        return 100
                    return self._get_latest_score(service_id)

                # Calculate component scores
                network_score = 100
                process_score = 100
                all_deviations = []
                
                if network_baseline:
                    network_score, net_devs = self._calculate_network_score(
                        recent_events, network_baseline
                    )
                    all_deviations.extend(net_devs)
                
                if process_baseline:
                    process_score, proc_devs = self._calculate_process_score(
                        recent_events, process_baseline
                    )
                    all_deviations.extend(proc_devs)
                
                # Calculate weighted DTS
                dts = int(
                    (network_score * self.weights['network']) +
                    (process_score * self.weights['process'])
                )
                
                # Ensure score is in valid range
                dts = max(0, min(100, dts))
                
                # Determine zone
                zone = self._get_zone(dts)
                
                # Get previous score for alert generation
                previous_score = self._get_latest_score(service_id)
                
                # Save score
                self._save_score(
                    service_id, dts, zone, all_deviations,
                    network_score, process_score
                )
                
                # Generate alert if needed
                if zone != 'GREEN' or (previous_score and abs(dts - previous_score) >= 15):
                    self._generate_alert(service, dts, zone, all_deviations, previous_score)
                
                self.app.logger.info(
                    f"Score calculated for {service.display_name}: {dts} ({zone})"
                )
                
                return dts
                
            except Exception as e:
                self.app.logger.error(f"Scoring error: {e}")
                return None
    
    def _calculate_network_score(self, events, baseline):
        """Calculate network behavior score"""
        score = 100
        deviations = []
        
        network_events = [e for e in events if e.event_type == 'network']
        if not network_events:
            return score, deviations
        
        baseline_data = baseline.baseline_data
        known_ips = set(baseline_data.get('unique_ips', []))
        known_ports = set(baseline_data.get('unique_ports', []))
        conn_stats = baseline_data.get('connection_stats', {})
        
        # Collect current behavior
        current_ips = set()
        current_ports = set()
        connection_counts = []
        
        for event in network_events:
            connections = event.event_data.get('connections', [])
            connection_counts.append(len(connections))
            
            for conn in connections:
                remote_ip = conn.get('remote_ip')
                remote_port = conn.get('remote_port')
                
                if remote_ip:
                    current_ips.add(remote_ip)
                    if remote_ip not in known_ips:
                        score += self.deductions['new_ip']
                        deviations.append({
                            'type': 'new_ip',
                            'value': remote_ip,
                            'severity': 'medium',
                            'points': self.deductions['new_ip']
                        })
                
                if remote_port:
                    current_ports.add(remote_port)
                    if remote_port not in known_ports:
                        score += self.deductions['new_port']
                        deviations.append({
                            'type': 'new_port',
                            'value': remote_port,
                            'severity': 'low',
                            'points': self.deductions['new_port']
                        })
        
        # Check connection count anomaly
        if connection_counts and conn_stats:
            avg_conns = statistics.mean(connection_counts)
            baseline_mean = conn_stats.get('mean', 0)
            baseline_stdev = conn_stats.get('stdev', 0)
            
            if baseline_stdev > 0:
                threshold = baseline_mean + (2 * baseline_stdev)
                if avg_conns > threshold:
                    score += self.deductions['connection_spike']
                    deviations.append({
                        'type': 'connection_spike',
                        'value': f"{avg_conns:.1f} (normal: {baseline_mean:.1f})",
                        'severity': 'high',
                        'points': self.deductions['connection_spike']
                    })
        
        return max(0, score), deviations
    
    def _calculate_process_score(self, events, baseline):
        """Calculate process behavior score"""
        score = 100
        deviations = []
        
        process_events = [e for e in events if e.event_type == 'process']
        if not process_events:
            return score, deviations
        
        baseline_data = baseline.baseline_data
        known_processes = set(baseline_data.get('normal_processes', []))
        cpu_stats = baseline_data.get('cpu_stats', {})
        memory_stats = baseline_data.get('memory_stats', {})
        
        # Collect current behavior
        current_processes = set()
        cpu_percentages = []
        memory_percentages = []
        
        for event in process_events:
            data = event.event_data
            
            process_name = data.get('name')
            if process_name:
                current_processes.add(process_name)
                if process_name not in known_processes:
                    score += self.deductions['new_process']
                    deviations.append({
                        'type': 'new_process',
                        'value': process_name,
                        'severity': 'high',
                        'points': self.deductions['new_process']
                    })
            
            if data.get('cpu_percent') is not None:
                cpu_percentages.append(data['cpu_percent'])
            
            if data.get('memory_percent') is not None:
                memory_percentages.append(data['memory_percent'])
        
        # Check CPU anomaly
        if cpu_percentages and cpu_stats:
            avg_cpu = statistics.mean(cpu_percentages)
            baseline_mean = cpu_stats.get('mean', 0)
            baseline_stdev = cpu_stats.get('stdev', 0)
            
            if baseline_stdev > 0:
                threshold = baseline_mean + (2 * baseline_stdev)
                if avg_cpu > threshold:
                    score += self.deductions['cpu_spike']
                    deviations.append({
                        'type': 'cpu_spike',
                        'value': f"{avg_cpu:.1f}% (normal: {baseline_mean:.1f}%)",
                        'severity': 'medium',
                        'points': self.deductions['cpu_spike']
                    })
        
        # Check memory anomaly
        if memory_percentages and memory_stats:
            avg_mem = statistics.mean(memory_percentages)
            baseline_mean = memory_stats.get('mean', 0)
            baseline_stdev = memory_stats.get('stdev', 0)
            
            if baseline_stdev > 0:
                threshold = baseline_mean + (2 * baseline_stdev)
                if avg_mem > threshold:
                    score += self.deductions['memory_spike']
                    deviations.append({
                        'type': 'memory_spike',
                        'value': f"{avg_mem:.1f}% (normal: {baseline_mean:.1f}%)",
                        'severity': 'medium',
                        'points': self.deductions['memory_spike']
                    })
        
        return max(0, score), deviations
    
    def _get_baseline(self, service_id, metric_name):
        """Get valid baseline for service"""
        return Baseline.query.filter_by(
            service_id=service_id,
            metric_name=metric_name,
            is_valid=True
        ).first()
    
    def _get_zone(self, score):
        """Determine zone based on score"""
        if score >= self.thresholds['GREEN']:
            return 'GREEN'
        elif score >= self.thresholds['YELLOW']:
            return 'YELLOW'
        elif score >= self.thresholds['ORANGE']:
            return 'ORANGE'
        else:
            return 'RED'
    
    def _get_latest_score(self, service_id):
        """Get most recent score value"""
        latest = Score.query.filter_by(
            service_id=service_id
        ).order_by(Score.timestamp.desc()).first()
        return latest.dts_score if latest else 100
    
    def _save_score(self, service_id, dts, zone, deviations, 
                    network_score, process_score):
        """Save score to database"""
        try:
            score = Score(
                service_id=service_id,
                dts_score=dts,
                zone=zone,
                network_score=network_score,
                process_score=process_score,
                deviation_count=len(deviations),
                deviations=deviations
            )
            db.session.add(score)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            self.app.logger.error(f"Error saving score: {e}")
    
    def _generate_alert(self, service, dts, zone, deviations, previous_score):
        """Generate security alert"""
        try:
            severity_map = {
                'GREEN': None,
                'YELLOW': 'YELLOW',
                'ORANGE': 'ORANGE',
                'RED': 'RED'
            }
            
            severity = severity_map.get(zone)
            if not severity:
                return
            
            # Build alert message
            score_change = dts - previous_score if previous_score else 0
            
            if score_change < 0:
                title = f"Trust Score Dropped: {service.display_name}"
                message = f"DTS dropped from {previous_score} to {dts} ({abs(score_change)} points)"
            else:
                title = f"Anomalous Behavior: {service.display_name}"
                message = f"Unusual behavior detected (DTS: {dts})"
            
            # Alert details
            details = {
                'current_score': dts,
                'previous_score': previous_score,
                'score_change': score_change,
                'zone': zone,
                'deviations': deviations,
                'deviation_count': len(deviations),
                'service_criticality': service.criticality
            }
            
            alert = Alert(
                service_id=service.id,
                severity=severity,
                title=title,
                message=message,
                details=details
            )
            db.session.add(alert)
            db.session.commit()
            
            self.app.logger.warning(f"🚨 Alert generated: {title}")
            
        except Exception as e:
            db.session.rollback()
            self.app.logger.error(f"Error generating alert: {e}")
    
    def calculate_all_scores(self):
        """Calculate scores for all monitored services"""
        with self.app.app_context():
            services = Service.query.filter_by(
                is_active=True,
                status='monitoring'
            ).all()
            
            if not services:
                self.app.logger.debug("No services in monitoring mode")
                return
            
            self.app.logger.info(f"🎯 Calculating scores for {len(services)} services")
            
            for service in services:
                try:
                    self.calculate_score_for_service(service.id)
                except Exception as e:
                    self.app.logger.error(
                        f"Error calculating score for {service.display_name}: {e}"
                    )
            
            self.app.logger.info("✅ Score calculation complete")