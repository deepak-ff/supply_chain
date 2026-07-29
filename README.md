# 🛡️ SCBTSS - Supply Chain Attack Detection System

Enterprise-grade real-time monitoring and threat detection for vendor software supply chains.

## 🎯 Overview

SCBTSS monitors critical security tools and applications for signs of compromise through behavioral analysis and dynamic trust scoring.

### Key Features

- ✅ **Real-time Monitoring**: Continuous tracking of network, process, and system behavior
- ✅ **Statistical Baselines**: Automatic learning of normal behavior patterns
- ✅ **Dynamic Trust Scoring**: 0-100 score indicating software trustworthiness
- ✅ **Attack Simulation**: Test detection capabilities with realistic attack scenarios
- ✅ **Enterprise Security**: Production-ready with hardened security controls
- ✅ **Web Dashboard**: Real-time visualization and alert management

## 🚀 Quick Start

### Prerequisites

- Python 3.9+
- pip package manager
- 256MB RAM minimum
- Internet connection (for CDN resources)

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/scbtss.git
cd scbtss

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Initialize database
python -c "from app import create_app; app = create_app(); app.app_context().push()"

# Run application
python run.py