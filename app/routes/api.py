"""
API routes with input validation and rate limiting
"""
from flask import Blueprint, jsonify, request, current_app
from app import db
from app.config import Config
from app.models import Service, Event, Baseline, Score, Alert
from datetime import datetime, timedelta
from sqlalchemy import func, desc
import traceback

api_bp = Blueprint('api', __name__)

# Input validation helpers
def validate_service_id(service_id):
    """Validate service ID"""
    try:
        service_id = int(service_id)
        if service_id <= 0:
            return None
        return service_id
    except (ValueError, TypeError):
        return None

def sanitize_limit(limit, default=100, max_limit=1000):
    """Sanitize pagination limit"""
    try:
        limit = int(limit)
        return min(max(1, limit), max_limit)
    except (ValueError, TypeError):
        return default

@api_bp.route('/services', methods=['GET'])
def get_services():
    """Get all monitored services with latest scores"""
    try:
        services = Service.query.filter_by(is_active=True).all()
        
        result = []
        for service in services:
            # Get latest score
            latest_score = Score.query.filter_by(
                service_id=service.id
            ).order_by(desc(Score.timestamp)).first()
            
            # Get event count
            event_count = Event.query.filter_by(
                service_id=service.id
            ).count()
            
            # Get baseline count
            baseline_count = Baseline.query.filter_by(
                service_id=service.id,
                is_valid=True
            ).count()
            
            service_dict = service.to_dict()
            service_dict['dts_score'] = latest_score.dts_score if latest_score else 100
            service_dict['zone'] = latest_score.zone if latest_score else 'GREEN'
            service_dict['event_count'] = event_count
            service_dict['baseline_count'] = baseline_count
            
            result.append(service_dict)
        
        if not result:
            # If no services exist yet, return demo fallback services for the demo page.
            demo_services = {
                'chrome': {
                    'display_name': 'Google Chrome',
                    'vendor': 'Google',
                    'category': 'Browser',
                    'criticality': 'HIGH'
                },
                'zoom': {
                    'display_name': 'Zoom',
                    'vendor': 'Zoom Video Communications',
                    'category': 'Communication',
                    'criticality': 'HIGH'
                },
                'slack': {
                    'display_name': 'Slack',
                    'vendor': 'Salesforce',
                    'category': 'Communication',
                    'criticality': 'MEDIUM'
                }
            }
            for name, info in demo_services.items():
                result.append({
                    'id': None,
                    'name': name,
                    'display_name': info['display_name'],
                    'vendor': info['vendor'],
                    'category': info['category'],
                    'criticality': info['criticality'],
                    'status': 'demo',
                    'is_active': True,
                    'dts_score': 100,
                    'zone': 'GREEN',
                    'event_count': 0,
                    'baseline_count': 0
                })
        
        return jsonify(result), 200
        
    except Exception as e:
        current_app.logger.error(f'Error fetching services: {e}\n{traceback.format_exc()}')
        return jsonify({'error': 'Failed to fetch services'}), 500

@api_bp.route('/services/<int:service_id>', methods=['GET'])
def get_service(service_id):
    """Get specific service details"""
    try:
        service_id = validate_service_id(service_id)
        if not service_id:
            return jsonify({'error': 'Invalid service ID'}), 400
        
        service = Service.query.get_or_404(service_id)
        return jsonify(service.to_dict()), 200
        
    except Exception as e:
        current_app.logger.error(f'Error fetching service: {e}')
        return jsonify({'error': 'Service not found'}), 404

@api_bp.route('/events/<int:service_id>', methods=['GET'])
def get_events(service_id):
    """Get events for a service with pagination"""
    try:
        service_id = validate_service_id(service_id)
        if not service_id:
            return jsonify({'error': 'Invalid service ID'}), 400
        
        # Pagination parameters
        limit = sanitize_limit(request.args.get('limit', 100))
        offset = sanitize_limit(request.args.get('offset', 0), default=0)
        
        # Time filter
        hours = sanitize_limit(request.args.get('hours', 24), default=24, max_limit=168)
        time_threshold = datetime.utcnow() - timedelta(hours=hours)
        
        # Query events
        events = Event.query.filter(
            Event.service_id == service_id,
            Event.timestamp > time_threshold
        ).order_by(desc(Event.timestamp)).limit(limit).offset(offset).all()
        
        return jsonify([e.to_dict() for e in events]), 200
        
    except Exception as e:
        current_app.logger.error(f'Error fetching events: {e}')
        return jsonify({'error': 'Failed to fetch events'}), 500

@api_bp.route('/baselines/<int:service_id>', methods=['GET'])
def get_baselines(service_id):
    """Get baselines for a service"""
    try:
        service_id = validate_service_id(service_id)
        if not service_id:
            return jsonify({'error': 'Invalid service ID'}), 400
        
        baselines = Baseline.query.filter_by(
            service_id=service_id,
            is_valid=True
        ).all()
        
        return jsonify([b.to_dict() for b in baselines]), 200
        
    except Exception as e:
        current_app.logger.error(f'Error fetching baselines: {e}')
        return jsonify({'error': 'Failed to fetch baselines'}), 500

@api_bp.route('/scores/<int:service_id>', methods=['GET'])
def get_scores(service_id):
    """Get score history for a service"""
    try:
        service_id = validate_service_id(service_id)
        if not service_id:
            return jsonify({'error': 'Invalid service ID'}), 400
        
        # Time filter
        hours = sanitize_limit(request.args.get('hours', 24), default=24, max_limit=168)
        time_threshold = datetime.utcnow() - timedelta(hours=hours)
        
        scores = Score.query.filter(
            Score.service_id == service_id,
            Score.timestamp > time_threshold
        ).order_by(Score.timestamp.asc()).all()
        
        return jsonify([s.to_dict() for s in scores]), 200
        
    except Exception as e:
        current_app.logger.error(f'Error fetching scores: {e}')
        return jsonify({'error': 'Failed to fetch scores'}), 500

@api_bp.route('/alerts', methods=['GET'])
def get_alerts():
    """Get recent alerts"""
    try:
        limit = sanitize_limit(request.args.get('limit', 50))
        unacknowledged_only = request.args.get('unacknowledged', 'false').lower() == 'true'
        
        query = Alert.query
        
        if unacknowledged_only:
            query = query.filter_by(is_acknowledged=False)
        
        alerts = query.order_by(desc(Alert.timestamp)).limit(limit).all()
        
        result = []
        for alert in alerts:
            alert_dict = alert.to_dict()
            # Add service name
            service = Service.query.get(alert.service_id)
            alert_dict['service_name'] = service.display_name if service else 'Unknown'
            result.append(alert_dict)
        
        return jsonify(result), 200
        
    except Exception as e:
        current_app.logger.error(f'Error fetching alerts: {e}')
        return jsonify({'error': 'Failed to fetch alerts'}), 500

@api_bp.route('/alerts/<int:alert_id>/acknowledge', methods=['POST'])
def acknowledge_alert(alert_id):
    """Acknowledge an alert"""
    try:
        alert_id = validate_service_id(alert_id)
        if not alert_id:
            return jsonify({'error': 'Invalid alert ID'}), 400
        
        alert = Alert.query.get_or_404(alert_id)
        alert.is_acknowledged = True
        alert.acknowledged_at = datetime.utcnow()
        alert.acknowledged_by = request.remote_addr  # In production, use actual user
        
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Alert acknowledged'}), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error acknowledging alert: {e}')
        return jsonify({'error': 'Failed to acknowledge alert'}), 500

@api_bp.route('/stats', methods=['GET'])
def get_stats():
    """Get overall system statistics"""
    try:
        # Get active services count
        total_services = Service.query.filter_by(is_active=True).count()
        
        # Get total events count
        total_events = Event.query.count()
        
        # Get unacknowledged alerts
        unack_alerts = Alert.query.filter_by(is_acknowledged=False).count()
        
        # Get services with latest scores
        services = Service.query.filter_by(is_active=True).all()
        service_stats = []
        
        for service in services:
            latest_score = Score.query.filter_by(
                service_id=service.id
            ).order_by(desc(Score.timestamp)).first()
            
            event_count = Event.query.filter_by(service_id=service.id).count()
            baseline_count = Baseline.query.filter_by(
                service_id=service.id,
                is_valid=True
            ).count()
            
            service_stats.append({
                'id': service.id,
                'name': service.name,
                'display_name': service.display_name,
                'status': service.status,
                'criticality': service.criticality,
                'dts_score': latest_score.dts_score if latest_score else 100,
                'zone': latest_score.zone if latest_score else 'GREEN',
                'event_count': event_count,
                'baseline_count': baseline_count
            })
        
        return jsonify({
            'total_services': total_services,
            'total_events': total_events,
            'unread_alerts': unack_alerts,
            'services': service_stats
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error fetching stats: {e}\n{traceback.format_exc()}')
        return jsonify({'error': 'Failed to fetch statistics'}), 500

@api_bp.route('/calculate-baseline/<int:service_id>', methods=['POST'])
def calculate_baseline(service_id):
    """Manually trigger baseline calculation"""
    try:
        from app.services.baseline import BaselineService
        
        service_id = validate_service_id(service_id)
        if not service_id:
            return jsonify({'error': 'Invalid service ID'}), 400
        
        service = Service.query.get_or_404(service_id)
        
        baseline_service = BaselineService(current_app._get_current_object())
        baseline_service.calculate_baseline_for_service(service.id)
        
        return jsonify({
            'success': True,
            'message': f'Baseline calculated for {service.display_name}'
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error calculating baseline: {e}')
        return jsonify({'error': str(e)}), 500

@api_bp.route('/calculate-score/<int:service_id>', methods=['POST'])
def calculate_score(service_id):
    """Manually trigger score calculation"""
    try:
        from app.services.scoring import ScoringService
        
        service_id = validate_service_id(service_id)
        if not service_id:
            return jsonify({'error': 'Invalid service ID'}), 400
        
        service = Service.query.get_or_404(service_id)
        
        scoring_service = ScoringService(current_app._get_current_object())
        score = scoring_service.calculate_score_for_service(service.id)
        
        return jsonify({
            'success': True,
            'score': score,
            'message': f'Score calculated: {score}'
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error calculating score: {e}')
        return jsonify({'error': str(e)}), 500

@api_bp.route('/calculate-all-baselines', methods=['POST'])
def calculate_all_baselines():
    """Calculate baselines for all services"""
    try:
        from app.services.baseline import BaselineService
        
        baseline_service = BaselineService(current_app._get_current_object())
        baseline_service.calculate_all_baselines()
        
        return jsonify({
            'success': True,
            'message': 'Baselines calculated for all services'
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error calculating baselines: {e}')
        return jsonify({'error': str(e)}), 500

@api_bp.route('/calculate-all-scores', methods=['POST'])
def calculate_all_scores():
    """Calculate scores for all services"""
    try:
        from app.services.scoring import ScoringService
        
        scoring_service = ScoringService(current_app._get_current_object())
        scoring_service.calculate_all_scores()
        
        return jsonify({
            'success': True,
            'message': 'Scores calculated for all services'
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error calculating scores: {e}')
        return jsonify({'error': str(e)}), 500

@api_bp.route('/simulate-attack', methods=['POST'])
def simulate_attack():
    """Simulate supply chain attack"""
    try:
        from app.services.simulator import AttackSimulator
        from app.services.scoring import ScoringService

        data = request.get_json() or {}
        service_name = data.get('service', 'chrome')
        attack_type = data.get('attack_type', 'solarwinds')

        # Validate input
        if not isinstance(service_name, str) or len(service_name) > 50:
            return jsonify({'error': 'Invalid service name'}), 400

        if not isinstance(attack_type, str) or len(attack_type) > 50:
            return jsonify({'error': 'Invalid attack type'}), 400

        simulator = AttackSimulator(current_app._get_current_object())

        # Run attack and then calculate score so demo shows correct results.
        success = simulator.simulate_attack(service_name, attack_type)
        if not success:
            return jsonify({'error': 'Attack simulation failed'}), 500

        service = Service.query.filter_by(name=service_name).first()
        if service:
            scoring_service = ScoringService(current_app._get_current_object())
            score = scoring_service.calculate_score_for_service(service.id)
        else:
            score = None

        response = {
            'success': True,
            'message': f'Attack simulation completed on {service_name}'
        }
        if score is not None:
            response['score'] = score
        
        return jsonify(response), 200

    except Exception as e:
        current_app.logger.error(f'Error simulating attack: {e}')
        return jsonify({'error': str(e)}), 500

@api_bp.route('/clear-simulated-events', methods=['POST'])
def clear_simulated_events():
    """Clear all simulated attack events"""
    try:
        deleted = Event.query.filter_by(is_simulated=True).delete()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Cleared {deleted} simulated events'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error clearing events: {e}')
        return jsonify({'error': str(e)}), 500
@api_bp.route('/demo/seed-services', methods=['POST'])
def seed_demo_services():
    """Create sample services for the hosted demo environment."""

    try:
        demo_services = [
            {
                'name': 'chrome',
                'display_name': 'Google Chrome',
                'vendor': 'Google',
                'category': 'Browser',
                'criticality': 'HIGH',
                'status': 'monitoring'
            },
            {
                'name': 'zoom',
                'display_name': 'Zoom',
                'vendor': 'Zoom Video Communications',
                'category': 'Communication',
                'criticality': 'HIGH',
                'status': 'monitoring'
            },
            {
                'name': 'slack',
                'display_name': 'Slack',
                'vendor': 'Salesforce',
                'category': 'Communication',
                'criticality': 'MEDIUM',
                'status': 'monitoring'
            }
        ]

        created_services = []

        for service_data in demo_services:
            service = Service.query.filter_by(
                name=service_data['name']
            ).first()

            if not service:
                service = Service(**service_data)
                db.session.add(service)
                created_services.append(service_data['name'])

        db.session.commit()

        # Ensure seeded services have a default green score and baseline to allow demo attacks to affect scoring.
        for service_data in demo_services:
            service = Service.query.filter_by(name=service_data['name']).first()
            if service:
                if not Score.query.filter_by(service_id=service.id).first():
                    db.session.add(
                        Score(
                            service_id=service.id,
                            dts_score=100,
                            zone='GREEN',
                            network_score=100,
                            process_score=100,
                            deviation_count=0,
                            deviations=[]
                        )
                    )

                # Create default baseline entries if missing
                from app.models import Baseline
                if not Baseline.query.filter_by(service_id=service.id, metric_name='network_behavior').first():
                    db.session.add(
                        Baseline(
                            service_id=service.id,
                            metric_name='network_behavior',
                            metric_type='network',
                            baseline_data={
                                'unique_ips': [],
                                'unique_ports': [443, 80, 53],
                                'connection_stats': {
                                    'mean': 2,
                                    'stdev': 1,
                                    'min': 1,
                                    'max': 3
                                },
                                'sample_size': 20,
                                'learning_period_days': 1
                            },
                            confidence=1.0,
                            sample_size=20,
                            is_valid=True
                        )
                    )

                if not Baseline.query.filter_by(service_id=service.id, metric_name='process_behavior').first():
                    db.session.add(
                        Baseline(
                            service_id=service.id,
                            metric_name='process_behavior',
                            metric_type='process',
                            baseline_data={
                                'normal_processes': [
                                    'chrome.exe',
                                    'zoom.exe',
                                    'slack.exe',
                                    'explorer.exe'
                                ],
                                'cpu_stats': {
                                    'mean': 5,
                                    'stdev': 2,
                                    'max': 8,
                                    'p95': 7
                                },
                                'memory_stats': {
                                    'mean': 5,
                                    'stdev': 2,
                                    'max': 10,
                                    'p95': 9
                                },
                                'thread_stats': {
                                    'mean': 10,
                                    'max': 20
                                },
                                'sample_size': 20,
                                'learning_period_days': 1
                            },
                            confidence=1.0,
                            sample_size=20,
                            is_valid=True
                        )
                    )

        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Demo services are ready',
            'created_services': created_services
        }), 200

    except Exception as error:
        db.session.rollback()
        current_app.logger.error(f'Error seeding demo services: {error}')
        return jsonify({
            'success': False,
            'error': 'Could not create demo services'
        }), 500
@api_bp.route('/simulate-system-attack', methods=['POST'])
def simulate_system_attack():
    """Simulate an attack across every active demo service."""

    try:
        from app.services.simulator import AttackSimulator
        from app.services.scoring import ScoringService

        data = request.get_json() or {}
        attack_type = data.get('attack_type', 'solarwinds')

        simulator = AttackSimulator(
            current_app._get_current_object()
        )

        success = simulator.simulate_multi_vendor_attack(attack_type)

        if not success:
            return jsonify({
                'success': False,
                'error': 'Full system attack simulation failed'
            }), 500

        scoring_service = ScoringService(current_app._get_current_object())
        scoring_service.calculate_all_scores()

        return jsonify({
            'success': True,
            'message': 'Full system attack simulation completed',
            'attack_type': attack_type
        }), 200

    except Exception as error:
        current_app.logger.error(
            f'Full system simulation error: {error}'
        )

        return jsonify({
            'success': False,
            'error': 'Could not start full system simulation'
        }), 500
@api_bp.route('/attack-scenarios', methods=['GET'])
def get_attack_scenarios():
    """Return all attack scenarios supported by the simulator."""

    try:
        from app.services.simulator import AttackSimulator

        simulator = AttackSimulator(
            current_app._get_current_object()
        )

        return jsonify(simulator.get_available_scenarios()), 200

    except Exception as error:
        current_app.logger.error(
            f'Error loading attack scenarios: {error}'
        )

        return jsonify({
            'error': 'Could not load attack scenarios'
        }), 500
