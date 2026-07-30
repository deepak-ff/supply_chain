"""
Attack Simulation Service
Simulate supply chain attacks for testing and demonstration
"""
import random
from datetime import datetime
from app import db
from app.models import Service, Event

class AttackSimulator:
    """Simulate supply chain attacks"""
    
    def __init__(self, app):
        self.app = app
        
        # Attack scenarios based on real-world threats
        self.scenarios = {
            'solarwinds': {
                'name': 'SolarWinds Supply Chain Attack',
                'description': 'Simulates the 2020 SolarWinds Orion attack',
                'malicious_domains': [
                    'avsvmcloud.com',
                    'freescanonline.com',
                    'deftsecurity.com',
                    'thedoccloud.com',
                    'virtualoffice.lk'
                ],
                'malicious_ips': [
                    '13.59.205.66',
                    '54.193.127.66',
                    '139.99.115.204',
                    '185.220.101.45',
                    '162.247.74.27'
                ],
                'suspicious_processes': [
                    'cmd.exe',
                    'powershell.exe',
                    'rundll32.exe',
                    'wmic.exe'
                ]
            },
            'codecov': {
                'name': 'Codecov Supply Chain Attack',
                'description': 'Simulates the 2021 Codecov Bash Uploader attack',
                'malicious_domains': [
                    'api.codecov.io.amazonaws.com',
                    'uploader.codecov.io-alternate.com',
                    'codecov-analytics.herokuapp.com'
                ],
                'malicious_ips': [
                    '52.1.1.1',
                    '54.2.2.2',
                    '35.3.3.3'
                ],
                'suspicious_processes': [
                    'bash',
                    'sh',
                    'curl',
                    'wget'
                ]
            },
            'kaseya': {
                'name': 'Kaseya VSA Supply Chain Attack',
                'description': 'Simulates the 2021 Kaseya VSA REvil attack',
                'malicious_domains': [
                    'kaseya-updates.com',
                    'vsa.kaseya-update.net',
                    'agent-update.kaseya.com'
                ],
                'malicious_ips': [
                    '66.70.209.164',
                    '103.145.45.97'
                ],
                'suspicious_processes': [
                    'agent.exe',
                    'KaseyaClientService.exe',
                    'SystemTrayIcon.exe'
                ]
            },
            '3cx': {
                'name': '3CX Supply Chain Attack',
                'description': 'Simulates the 2023 3CX Desktop App attack',
                'malicious_domains': [
                    'msstatic.net',
                    '3cxupdate.com',
                    'graphiti-updates.com'
                ],
                'malicious_ips': [
                    '185.225.73.0',
                    '149.7.4.144'
                ],
                'suspicious_processes': [
                    '3CXDesktopApp.exe',
                    'ThumbsUp.exe',
                    'WinUtil.exe'
                ]
            }
        }
    
    def simulate_attack(self, service_name='chrome', attack_type='solarwinds'):
        """
        Simulate an attack on a specific service
        
        Args:
            service_name: Name of service to attack
            attack_type: Type of attack scenario
        """
        with self.app.app_context():
            try:
                # Validate inputs
                if attack_type not in self.scenarios:
                    self.app.logger.error(f"Unknown attack type: {attack_type}")
                    return False
                
                # Get or create service
                service = self._get_or_create_service(service_name)
                if not service:
                    self.app.logger.error(f"Service {service_name} could not be created")
                    return False

                self._ensure_baselines(service)
                scenario = self.scenarios[attack_type]
                
                self.app.logger.info(f"🚨 ATTACK SIMULATION STARTING")
                self.app.logger.info(f"Target: {service.display_name}")
                self.app.logger.info(f"Attack: {scenario['name']}")
                self.app.logger.info(f"Description: {scenario['description']}")
                
                # Phase 1: Initial Compromise
                self.app.logger.info("📍 Phase 1: Initial network reconnaissance")
                self._inject_network_events(
                    service.id,
                    scenario['malicious_domains'][:2],
                    scenario['malicious_ips'][:2],
                    count=5
                )
                
                # Phase 2: Privilege Escalation
                self.app.logger.info("📍 Phase 2: Privilege escalation and C2 beacon")
                self._inject_process_events(
                    service.id,
                    scenario['suspicious_processes'][:2],
                    count=3
                )
                
                # Phase 3: Lateral Movement
                self.app.logger.info("📍 Phase 3: Lateral movement and data exfiltration")
                self._inject_network_events(
                    service.id,
                    scenario['malicious_domains'],
                    scenario['malicious_ips'],
                    count=15
                )
                
                # Propagate to connected demo services
                self._propagate_attack_to_connected_services(service_name, scenario)

                self.app.logger.info(f"✅ Attack simulation complete!")
                self.app.logger.info(f"⚠️  DTS score should drop significantly")
                self.app.logger.info(f"💡 Scores are updated in the dashboard and demo service panel")
                
                return True
                
            except Exception as e:
                self.app.logger.error(f"Attack simulation error: {e}")
                return False

    def _get_or_create_service(self, service_name):
        """Retrieve or create a service from configured demo and monitored definitions."""
        service = Service.query.filter_by(name=service_name).first()
        if service:
            return service

        from app.config import Config
        all_services = {**Config.MONITORED_SERVICES, **Config.FALLBACK_SERVICES}
        info = all_services.get(service_name)
        if not info:
            return None

        service = Service(
            name=service_name,
            display_name=info['display_name'],
            vendor=info.get('vendor', 'Unknown'),
            category=info['category'],
            criticality=info['criticality'],
            status='monitoring',
            is_active=True
        )
        db.session.add(service)
        db.session.commit()
        return service

    def _ensure_baselines(self, service):
        """Ensure a baseline exists for a service so scoring can evaluate anomalies."""
        from app.models import Baseline
        try:
            network_baseline = Baseline.query.filter_by(
                service_id=service.id,
                metric_name='network_behavior'
            ).first()
            process_baseline = Baseline.query.filter_by(
                service_id=service.id,
                metric_name='process_behavior'
            ).first()

            if not network_baseline:
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

            if not process_baseline:
                db.session.add(
                    Baseline(
                        service_id=service.id,
                        metric_name='process_behavior',
                        metric_type='process',
                        baseline_data={
                            'normal_processes': [
                                service.name + '.exe',
                                service.name,
                                service.display_name
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
        except Exception as e:
            db.session.rollback()
            self.app.logger.error(f"Error ensuring baselines for {service.name}: {e}")

    def _propagate_attack_to_connected_services(self, service_name, scenario):
        """Inject smaller attack anomalies into connected services to simulate internal spread."""
        try:
            relations = self.app.config.get('SERVICE_RELATIONS', {})
            connected = relations.get(service_name, [])
            if not connected:
                return

            for related_name in connected:
                related_service = self._get_or_create_service(related_name)
                if not related_service:
                    continue

                self._ensure_baselines(related_service)
                self.app.logger.info(f"➡️ Propagating attack to connected service: {related_service.display_name}")

                self._inject_network_events(
                    related_service.id,
                    scenario['malicious_domains'][:1],
                    scenario['malicious_ips'][:1],
                    count=4
                )
                self._inject_process_events(
                    related_service.id,
                    scenario['suspicious_processes'][:1],
                    count=2
                )
        except Exception as e:
            self.app.logger.error(f"Error propagating attack: {e}")
    
    def _inject_network_events(self, service_id, domains, ips, ports=[443, 80, 53], count=10):
        """Inject malicious network events"""
        try:
            for i in range(count):
                domain = random.choice(domains) if domains else None
                ip = random.choice(ips) if ips else None
                port = random.choice(ports) if ports else 443
                
                connections = [{
                    'remote_ip': ip,
                    'remote_port': port,
                    'local_port': random.randint(50000, 60000),
                    'status': 'ESTABLISHED',
                    'family': 'AF_INET'
                }]
                
                # Add extra connections for large transfers
                if random.random() > 0.7:
                    connections.extend([
                        {
                            'remote_ip': ip,
                            'remote_port': port,
                            'local_port': random.randint(50000, 60000),
                            'status': 'ESTABLISHED',
                            'family': 'AF_INET'
                        }
                        for _ in range(random.randint(3, 8))
                    ])
                
                event_data = {
                    'pid': random.randint(5000, 9000),
                    'connection_count': len(connections),
                    'connections': connections,
                    'domain': domain
                }
                
                event = Event(
                    service_id=service_id,
                    event_type='network',
                    event_data=event_data,
                    is_simulated=True,
                    severity='HIGH'
                )
                db.session.add(event)
            
            db.session.commit()
            self.app.logger.info(f"  ✓ Injected {count} malicious network events")
            
        except Exception as e:
            db.session.rollback()
            self.app.logger.error(f"Error injecting network events: {e}")
    
    def _inject_process_events(self, service_id, processes, count=5):
        """Inject malicious process events"""
        try:
            for i in range(count):
                process_name = random.choice(processes) if processes else 'unknown.exe'
                
                # Simulate suspicious resource usage
                cpu_percent = random.uniform(45.0, 95.0)  # High CPU
                memory_percent = random.uniform(15.0, 50.0)  # High memory
                
                event_data = {
                    'pid': random.randint(5000, 9000),
                    'name': process_name,
                    'cpu_percent': round(cpu_percent, 2),
                    'memory_percent': round(memory_percent, 2),
                    'num_threads': random.randint(20, 100),
                    'username': 'SYSTEM'
                }
                
                event = Event(
                    service_id=service_id,
                    event_type='process',
                    event_data=event_data,
                    is_simulated=True,
                    severity='HIGH'
                )
                db.session.add(event)
            
            db.session.commit()
            self.app.logger.info(f"  ✓ Injected {count} malicious process events")
            
        except Exception as e:
            db.session.rollback()
            self.app.logger.error(f"Error injecting process events: {e}")
    
    def simulate_multi_vendor_attack(self, attack_type='solarwinds'):
        """Simulate coordinated attack across multiple services"""
        with self.app.app_context():
            try:
                services = Service.query.filter_by(is_active=True).all()
                
                if not services:
                    self.app.logger.error("No services found to attack")
                    return False
                
                self.app.logger.info(f"🔥 SUPPLY CHAIN ATTACK ACROSS {len(services)} SERVICES")
                self.app.logger.info(f"Attack Type: {attack_type}")
                self.app.logger.info("=" * 60)
                
                for service in services:
                    self.app.logger.info(f"🎯 Attacking {service.display_name}...")
                    self.simulate_attack(service.name, attack_type)
                
                self.app.logger.info("=" * 60)
                self.app.logger.info("✅ Multi-vendor attack simulation complete")
                self.app.logger.info("💡 All services should show anomalies")
                
                return True
                
            except Exception as e:
                self.app.logger.error(f"Multi-vendor attack error: {e}")
                return False
    
    def get_available_scenarios(self):
        """Get list of available attack scenarios"""
        return [
            {
                'id': key,
                'name': scenario['name'],
                'description': scenario['description']
            }
            for key, scenario in self.scenarios.items()
        ]