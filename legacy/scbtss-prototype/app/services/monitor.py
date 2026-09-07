"""
Production Monitoring Service
Secure process monitoring with error handling
"""
import psutil
import time
from datetime import datetime
from app import db
from app.models import Service, Event

class MonitoringService:
    """Monitor services and collect security events"""
    
    def __init__(self, app):
        self.app = app
        self.services_config = {
            **app.config['MONITORED_SERVICES'],
            **app.config['FALLBACK_SERVICES']
        }
        self.collection_interval = app.config['MONITOR_INTERVAL']
    
    def discover_services(self):
        """
        Discover running services on the system
        Returns list of discovered services with process info
        """
        discovered = []
        seen_services = set()
        
        try:
            for service_key, service_info in self.services_config.items():
                # Skip if already found
                if service_key in seen_services:
                    continue
                
                for proc in psutil.process_iter(['pid', 'name', 'username']):
                    try:
                        proc_name = proc.info['name']
                        
                        # Check if process matches any of the configured names
                        if any(pname.lower() in proc_name.lower() 
                              for pname in service_info['process_names']):
                            discovered.append({
                                'key': service_key,
                                'info': service_info,
                                'process': proc
                            })
                            seen_services.add(service_key)
                            break  # Found this service, move to next
                            
                    except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                        continue
                    except Exception as e:
                        self.app.logger.error(f"Error checking process: {e}")
                        continue
                        
        except Exception as e:
            self.app.logger.error(f"Error discovering services: {e}")
        
        return discovered
    
    def register_or_update_service(self, service_key, service_info):
        """
        Register new service or update existing one in database
        """
        try:
            service = Service.query.filter_by(name=service_key).first()
            
            if not service:
                # Create new service
                service = Service(
                    name=service_key,
                    display_name=service_info['display_name'],
                    vendor=service_info.get('vendor', 'Unknown'),
                    category=service_info['category'],
                    criticality=service_info['criticality'],
                    status='learning',
                    is_active=True
                )
                db.session.add(service)
                self.app.logger.info(f"✓ Registered new service: {service_info['display_name']}")
            else:
                # Update last seen timestamp
                service.last_seen = datetime.utcnow()
                service.is_active = True
            
            db.session.commit()
            return service
            
        except Exception as e:
            db.session.rollback()
            self.app.logger.error(f"Error registering service {service_key}: {e}")
            return None
    
    def collect_network_events(self, service, process):
        """
        Collect network connection events
        Secure: Only collects ESTABLISHED connections
        """
        try:
            connections = process.connections(kind='inet')
            
            if not connections:
                return
            
            established_conns = []
            for conn in connections:
                try:
                    # Only track ESTABLISHED connections with remote address
                    if conn.status == 'ESTABLISHED' and conn.raddr:
                        established_conns.append({
                            'remote_ip': conn.raddr.ip,
                            'remote_port': conn.raddr.port,
                            'local_port': conn.laddr.port,
                            'status': conn.status,
                            'family': str(conn.family)
                        })
                except Exception:
                    continue
            
            if established_conns:
                event_data = {
                    'pid': process.pid,
                    'connection_count': len(established_conns),
                    'connections': established_conns
                }
                
                event = Event(
                    service_id=service.id,
                    event_type='network',
                    event_data=event_data,
                    is_simulated=False
                )
                db.session.add(event)
                db.session.commit()
                
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
        except Exception as e:
            self.app.logger.debug(f"Network collection error for {service.name}: {e}")
    
    def collect_process_events(self, service, process):
        """
        Collect process behavior events
        Secure: Handles exceptions and validates data
        """
        try:
            with process.oneshot():
                # Collect process metrics safely
                try:
                    cpu_percent = process.cpu_percent(interval=0.1)
                except:
                    cpu_percent = 0.0
                
                try:
                    memory_percent = process.memory_percent()
                except:
                    memory_percent = 0.0
                
                try:
                    num_threads = process.num_threads()
                except:
                    num_threads = 0
                
                try:
                    username = process.username()
                except:
                    username = 'unknown'
                
                event_data = {
                    'pid': process.pid,
                    'name': process.name(),
                    'cpu_percent': round(cpu_percent, 2),
                    'memory_percent': round(memory_percent, 2),
                    'num_threads': num_threads,
                    'username': username
                }
                
                event = Event(
                    service_id=service.id,
                    event_type='process',
                    event_data=event_data,
                    is_simulated=False
                )
                db.session.add(event)
                db.session.commit()
                
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
        except Exception as e:
            self.app.logger.debug(f"Process collection error for {service.name}: {e}")
    
    def collect_events(self):
        """
        Main event collection routine
        Runs continuously in background
        """
        with self.app.app_context():
            try:
                discovered = self.discover_services()
                
                if not discovered:
                    self.app.logger.debug("No services discovered in this cycle")
                    return
                
                for item in discovered:
                    try:
                        service = self.register_or_update_service(
                            item['key'], 
                            item['info']
                        )
                        
                        if service:
                            self.collect_network_events(service, item['process'])
                            self.collect_process_events(service, item['process'])
                            
                    except Exception as e:
                        self.app.logger.error(
                            f"Error collecting events for {item['key']}: {e}"
                        )
                        continue
                        
            except Exception as e:
                self.app.logger.error(f"Collection cycle error: {e}")
    
    def run(self):
        """Run the monitoring loop."""
        with self.app.app_context():
            self.app.logger.info("Monitoring service started")
            while True:
                try:
                    self.collect_events()
                except Exception as e:
                    self.app.logger.error(f"Monitoring loop error: {e}")
                time.sleep(self.collection_interval)
        