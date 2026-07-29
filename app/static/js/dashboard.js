/**
 * Dashboard Management
 * Handles dashboard functionality and real-time updates
 */

let scoreChart = null;
let selectedServiceId = null;

$(document).ready(function() {
    console.log('Dashboard initialized');
    
    // Load initial data
    loadDashboard();
    
    // Refresh every 30 seconds
    setInterval(loadDashboard, 30000);
    
    // Handle page visibility
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            loadDashboard();
        }
    });
});

function loadDashboard() {
    $.ajax({
        url: '/api/stats',
        method: 'GET',
        timeout: 10000,
        success: function(data) {
            updateStats(data);
            updateServices(data.services);
            loadAlerts();
        },
        error: function(xhr, status, error) {
            console.error('Dashboard load error:', error);
            showNotification('error', 'Failed to load dashboard data');
        }
    });
}

function updateStats(data) {
    $('#serviceCount').text(data.total_services);
    $('#eventCount').text(data.total_events);
    $('#alertCount').text(data.unread_alerts);
}

function updateServices(services) {
    const container = $('#servicesGrid');
    
    if (services.length === 0) {
        container.html(`
            <div class="col-12 text-center py-5">
                <p class="text-muted">
                    <i class="fas fa-info-circle"></i>
                    No services detected. Ensure monitoring targets are running.
                </p>
            </div>
        `);
        return;
    }
    
    container.empty();
    
    services.forEach(function(service) {
        const zoneClass = `zone-${service.zone}`;
        const badgeClass = `badge-${service.zone}`;
        
        const html = `
            <div class="col-md-4 mb-4">
                <div class="card service-card ${zoneClass}">
                    <div class="card-body">
                        <h5 class="card-title">
                            <i class="fas fa-cube"></i> ${service.display_name}
                        </h5>
                        
                        <div class="text-center mb-3">
                            <div class="score-circle bg-${service.zone.toLowerCase()}">
                                ${service.dts_score}
                            </div>
                            <span class="badge badge-zone ${badgeClass}">${service.zone}</span>
                        </div>
                        
                        <div class="mb-3">
                            <small class="text-muted">
                                <i class="fas fa-cube"></i> Category: ${service.category || 'Uncategorized'}<br>
                                <i class="fas fa-exclamation"></i> Criticality: ${service.criticality}<br>
                                <i class="fas fa-plug"></i> Status: ${service.status}
                            </small>
                        </div>
                        
                        <div class="d-grid gap-2">
                            <button class="btn btn-sm btn-outline-primary" 
                                    onclick="showScoreHistory(${service.id}, '${service.display_name}')">
                                <i class="fas fa-chart-line"></i> Score History
                            </button>
                            ${service.baseline_count > 0 ? `
                                <button class="btn btn-sm btn-outline-secondary"
                                        onclick="showBaseline(${service.id}, '${service.display_name}')">
                                    <i class="fas fa-database"></i> Baseline
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        container.append(html);
    });
}

function loadAlerts() {
    $.ajax({
        url: '/api/alerts?limit=5',
        method: 'GET',
        success: function(alerts) {
            const unackAlerts = alerts.filter(a => !a.is_acknowledged);
            
            if (unackAlerts.length > 0) {
                displayAlerts(unackAlerts);
            } else {
                $('#alertsSection').hide();
            }
        },
        error: function() {
            console.error('Failed to load alerts');
        }
    });
}

function displayAlerts(alerts) {
    const container = $('#alertsList');
    
    $('#alertsSection').show();
    container.empty();
    
    alerts.forEach(function(alert) {
        const itemClass = `alert-item-${alert.severity}`;
        
        const html = `
            <div class="alert-item ${itemClass} animate-slide-in">
                <div class="d-flex justify-content-between">
                    <div>
                        <h6>${alert.title}</h6>
                        <p class="mb-1">${alert.message}</p>
                        <small class="text-muted">
                            <i class="fas fa-clock"></i> ${moment(alert.timestamp).fromNow()}
                        </small>
                    </div>
                    <button class="btn btn-sm btn-outline-secondary" 
                            onclick="acknowledgeAlert(${alert.id})">
                        <i class="fas fa-check"></i>
                    </button>
                </div>
            </div>
        `;
        
        container.append(html);
    });
}

function acknowledgeAlert(alertId) {
    $.ajax({
        url: `/api/alerts/${alertId}/acknowledge`,
        method: 'POST',
        success: function() {
            loadAlerts();
            showNotification('success', 'Alert acknowledged');
        },
        error: function() {
            showNotification('error', 'Failed to acknowledge alert');
        }
    });
}

function showScoreHistory(serviceId, serviceName) {
    selectedServiceId = serviceId;
    
    $('#scoreModalTitle').text(
    `${serviceName} - Score History (24h)`
);
    
    $.ajax({
        url: `/api/scores/${serviceId}?hours=24`,
        method: 'GET',
        success: function(scores) {
            if (scores.length === 0) {
                $('#scoreDetails').html('<p class="text-muted">No score history available</p>');
                return;
            }
            
            renderScoreChart(scores);
            renderScoreDetails(scores);
        },
        error: function() {
            showNotification('error', 'Failed to load score history');
        }
    });
    
    new bootstrap.Modal(document.getElementById('scoreModal')).show();
}

function renderScoreChart(scores) {
    const ctx = document.getElementById('scoreChart').getContext('2d');
    
    if (scoreChart) {
        scoreChart.destroy();
    }
    
    const labels = scores.map(s => moment(s.timestamp).format('HH:mm'));
    const data = scores.map(s => s.dts_score);
    
    scoreChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'DTS Score',
                data: data,
                borderColor: '#0d6efd',
                backgroundColor: 'rgba(13, 110, 253, 0.1)',
                tension: 0.4,
                fill: true,
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        stepSize: 20
                    }
                }
            }
        }
    });
}

function renderScoreDetails(scores) {
    const allScores = scores.map(s => s.dts_score);
    const current = allScores[allScores.length - 1];
    const min = Math.min(...allScores);
    const max = Math.max(...allScores);
    const avg = (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1);
    
    const html = `
        <div class="row text-center border-top pt-3">
            <div class="col-3">
                <h5>${current}</h5>
                <small class="text-muted">Current</small>
            </div>
            <div class="col-3">
                <h5>${max}</h5>
                <small class="text-muted">Peak</small>
            </div>
            <div class="col-3">
                <h5>${min}</h5>
                <small class="text-muted">Lowest</small>
            </div>
            <div class="col-3">
                <h5>${avg}</h5>
                <small class="text-muted">Average</small>
            </div>
        </div>
    `;
    
    $('#scoreDetails').html(html);
}

function showBaseline(serviceId, serviceName) {
    $.ajax({
        url: `/api/baselines/${serviceId}`,
        method: 'GET',
        success: function(baselines) {
            if (baselines.length === 0) {
                $('#baselineContent').html('<p class="text-muted">No baselines available</p>');
            } else {
                let html = '';
                baselines.forEach(function(baseline) {
                    html += renderBaselineCard(baseline);
                });
                $('#baselineContent').html(html);
            }
        },
        error: function() {
            showNotification('error', 'Failed to load baseline');
        }
    });
    
    new bootstrap.Modal(document.getElementById('baselineModal')).show();
}

function renderBaselineCard(baseline) {
    const data = baseline.baseline_data;
    const confidence = (baseline.confidence * 100).toFixed(0);
    
    let html = `
        <div class="card mb-3">
            <div class="card-header">
                <strong>${baseline.metric_name}</strong>
                <span class="badge bg-info float-end">Confidence: ${confidence}%</span>
            </div>
            <div class="card-body">
    `;
    
    if (baseline.metric_type === 'network') {
        html += `
            <h6>Known IPs: ${data.ip_count}</h6>
            <p>Mean Connections: ${data.connection_stats.mean.toFixed(2)}</p>
            <p>Connection Range: ${data.connection_stats.min} - ${data.connection_stats.max}</p>
        `;
    } else if (baseline.metric_type === 'process') {
        html += `
            <h6>Normal Processes: ${data.normal_processes.length}</h6>
            <p>Mean CPU: ${data.cpu_stats.mean.toFixed(2)}%</p>
            <p>Mean Memory: ${data.memory_stats.mean.toFixed(2)}%</p>
        `;
    }
    
    html += `
            </div>
        </div>
    `;
    
    return html;
}

function calculateAllBaselines() {
    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Calculating...';
    
    $.ajax({
        url: '/api/calculate-all-baselines',
        method: 'POST',
        success: function() {
            showNotification('success', 'Baselines calculated');
            loadDashboard();
        },
        error: function() {
            showNotification('error', 'Failed to calculate baselines');
        },
        complete: function() {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
}

function calculateAllScores() {
    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Calculating...';
    
    $.ajax({
        url: '/api/calculate-all-scores',
        method: 'POST',
        success: function() {
            showNotification('success', 'Scores calculated');
            setTimeout(loadDashboard, 1000);
        },
        error: function() {
            showNotification('error', 'Failed to calculate scores');
        },
        complete: function() {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
}

function showNotification(type, message) {
    const bgClass = type === 'success' ? 'bg-success' : 'bg-danger';
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    
    const html = `
        <div class="position-fixed top-0 end-0 p-3" style="z-index: 999;">
            <div class="alert alert-${type === 'success' ? 'success' : 'danger'} alert-dismissible fade show" role="alert">
                <i class="fas ${icon}"></i> ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        </div>
    `;
    
    $('body').append(html);
    
    setTimeout(function() {
        $('body').find('.alert').fadeOut(function() {
            $(this).remove();
        });
    }, 4000);
}