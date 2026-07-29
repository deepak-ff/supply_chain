/**
 * Attack Simulation Demo
 */

$(document).ready(function() {
    loadAttackScenarios();
});

function loadAttackScenarios() {
    $.ajax({
        url: '/api/attack-scenarios',
        method: 'GET',
        success: function(scenarios) {
            const container = $('#scenariosContainer');
            container.empty();
            
            scenarios.forEach(function(scenario) {
                const card = createScenarioCard(scenario);
                container.append(card);
            });
            
            loadServices();
        },
        error: function() {
            console.error('Failed to load scenarios');
        }
    });
}

function createScenarioCard(scenario) {
    const icons = {
        'solarwinds': 'fa-satellite-dish',
        'codecov': 'fa-code-branch',
        'kaseya': 'fa-server',
        '3cx': 'fa-phone'
    };
    
    const icon = icons[scenario.id] || 'fa-bug';
    
    return `
        <div class="col-md-6 mb-4">
            <div class="card h-100">
                <div class="card-header bg-primary text-white">
                    <h6 class="mb-0">
                        <i class="fas ${icon}"></i> ${scenario.name}
                    </h6>
                </div>
                <div class="card-body">
                    <p class="text-muted">${scenario.description}</p>
                    
                    <div class="mb-3">
                        <label class="form-label small">Target Service:</label>
                        <select class="form-select form-select-sm" id="service-${scenario.id}">
                            <!-- Services loaded here -->
                        </select>
                    </div>
                    
                    <button class="btn btn-danger w-100"
                            onclick="simulateAttack('${scenario.id}')">
                        <i class="fas fa-bolt"></i> Simulate
                    </button>
                </div>
            </div>
        </div>
    `;
}

function loadServices() {
    $.ajax({
        url: '/api/services',
        method: 'GET',
        success: function(services) {
            $('.form-select').each(function() {
                const select = $(this);
                select.empty();
                
                if (services.length === 0) {
                    select.append('<option>No services available</option>');
                    select.prop('disabled', true);
                } else {
                    services.forEach(function(service) {
                        select.append(`<option value="${service.name}">${service.display_name}</option>`);
                    });
                }
            });
        }
    });
}

function simulateAttack(attackType) {
    const serviceName = $(`#service-${attackType}`).val();
    
    if (!serviceName) {
        alert('Please select a service');
        return;
    }
    
    logAttack(`🎯 Starting ${attackType} attack on ${serviceName}...`);
    
    $.ajax({
        url: '/api/simulate-attack',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            service: serviceName,
            attack_type: attackType
        }),
        success: function() {
            logAttack('✅ Attack simulation in progress');
            logAttack('⏱️  Wait 10 seconds, then click "Calculate Scores" on Dashboard');
        },
        error: function(xhr) {
            logAttack('❌ Attack simulation failed');
            console.error('Error:', xhr);
        }
    });
}

function runFullSystemAttack() {
    if (!confirm('Attack ALL monitored services?')) return;
    
    logAttack('');
    logAttack('🔥 FULL SYSTEM ATTACK INITIATED');
    logAttack('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    $.ajax({
        url: '/api/simulate-attack',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            service: 'all',
            attack_type: 'solarwinds'
        }),
        success: function() {
            logAttack('✅ Full system attack simulation complete');
            logAttack('📊 Go to Dashboard and click "Calculate Scores"');
        },
        error: function() {
            logAttack('❌ Attack failed');
        }
    });
}

function clearSimulatedEvents() {
    if (!confirm('Clear all simulated events?')) return;
    
    logAttack('🔄 Clearing simulated events...');
    
    $.ajax({
        url: '/api/clear-simulated-events',
        method: 'POST',
        success: function(response) {
            logAttack(`✅ ${response.message}`);
            logAttack('🔄 Recalculating scores...');
            
            $.post('/api/calculate-all-scores', function() {
                logAttack('✅ Scores reset - system returned to normal');
            });
        },
        error: function() {
            logAttack('❌ Failed to clear events');
        }
    });
}

function logAttack(message) {
    const log = $('#attackLog');
    const timestamp = moment().format('HH:mm:ss');
    
    if (message === '') {
        log.append('<br>');
    } else {
        log.append(`<div>[${timestamp}] ${message}</div>`);
    }
    
    log.scrollTop(log[0].scrollHeight);
}