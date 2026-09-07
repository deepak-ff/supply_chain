"""
Local Development Entry Point
"""
import os
from app import create_app
from app.services.monitor import MonitoringService

if __name__ == '__main__':
    # Set development config
    os.environ['FLASK_ENV'] = 'development'
    
    # Create app
    app = create_app('development')
    
    # Start monitoring in background thread
    import threading
    
    monitor = MonitoringService(app)
    monitor_thread = threading.Thread(target=monitor.run, daemon=True)
    monitor_thread.start()
    
    # Start Flask dev server
    print("🚀 SCBTSS Starting in Development Mode")
    print("📊 Monitoring service running in background")
    print("🌐 Access at http://localhost:5000")
    
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True,
        use_reloader=False
    )