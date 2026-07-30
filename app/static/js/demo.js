/**
 * Attack Simulation Demo
 */

$(document).ready(function () {
    loadAttackScenarios();
});


function loadAttackScenarios() {
    $.ajax({
        url: "/api/attack-scenarios",
        method: "GET",

        success: function (scenarios) {
            const container = $("#scenariosContainer");
            container.empty();

            if (!scenarios || scenarios.length === 0) {
                container.html(
                    '<div class="col-12">' +
                    '<div class="alert alert-info">' +
                    'No attack scenarios are available.' +
                    '</div>' +
                    '</div>'
                );
                return;
            }

            scenarios.forEach(function (scenario) {
                container.append(createScenarioCard(scenario));
            });

            loadServices();
        },

        error: function (xhr) {
            console.error("Failed to load attack scenarios:", xhr);

            $("#scenariosContainer").html(
                '<div class="col-12">' +
                '<div class="alert alert-danger">' +
                'Could not load attack scenarios. Check the API configuration.' +
                '</div>' +
                '</div>'
            );

            logAttack("❌ Could not load attack scenarios.");
        }
    });
}


function createScenarioCard(scenario) {
    const icons = {
        solarwinds: "fa-satellite-dish",
        codecov: "fa-code-branch",
        kaseya: "fa-server",
        "3cx": "fa-phone",
        cryptominer: "fa-coins",
        data_exfiltration: "fa-database",
        backdoor: "fa-door-open"
    };

    const icon = icons[scenario.id] || "fa-bug";

    return `
        <div class="col-md-6 mb-4">
            <div class="card h-100">
                <div class="card-header bg-primary text-white">
                    <h6 class="mb-0">
                        <i class="fas ${icon}"></i>
                        ${scenario.name}
                    </h6>
                </div>

                <div class="card-body">
                    <p class="text-muted">${scenario.description}</p>

                    <div class="mb-3">
                        <label class="form-label small">
                            Target Service:
                        </label>

                        <select
                            class="form-select form-select-sm"
                            id="service-${scenario.id}"
                        >
                            <option>Loading services...</option>
                        </select>
                    </div>

                    <button
                        class="btn btn-danger w-100"
                        onclick="simulateAttack('${scenario.id}')"
                    >
                        <i class="fas fa-bolt"></i>
                        Simulate
                    </button>
                </div>
            </div>
        </div>
    `;
}


function loadServices() {
    $.ajax({
        url: "/api/services",
        method: "GET",

        success: function (services) {
            if (!services || services.length === 0) {
                seedDemoServices();
                return;
            }

            $(".form-select").each(function () {
                const select = $(this);
                select.empty();
                select.prop("disabled", false);

                services.forEach(function (service) {
                    const vendorLabel = service.vendor ? ` (${service.vendor})` : '';
                    select.append(
                        `<option value="${service.name}">
                            ${service.display_name}${vendorLabel}
                        </option>`
                    );
                });
            });
        },

        error: function (xhr) {
            console.error("Failed to load services:", xhr);
            logAttack("❌ Could not load monitored services.");
            showNotification("error", "Could not load monitored services. Retrying...");
            setTimeout(loadServices, 1500);
        }
    });
}

function seedDemoServices() {
    logAttack("🔧 No demo services found. Seeding demo environment...");
    showNotification("info", "Seeding demo services. Please wait...");

    $.ajax({
        url: "/api/demo/seed-services",
        method: "POST",

        success: function (response) {
            logAttack("✅ Demo services seeded successfully.");
            showNotification("success", "Demo services are ready. Reloading demo...");
            loadAttackScenarios();
        },

        error: function (xhr) {
            const errorMessage = xhr.responseJSON?.error || "Failed to seed demo services.";
            console.error("Demo seed error:", xhr);
            logAttack(`❌ ${errorMessage}`);
            showNotification("error", errorMessage);
        }
    });
}


function simulateAttack(attackType) {
    const serviceName = $(`#service-${attackType}`).val();

    if (!serviceName) {
        alert("Please select a service first.");
        return;
    }

    logAttack(`🎯 Starting ${attackType} attack on ${serviceName}...`);

    $.ajax({
        url: "/api/simulate-attack",
        method: "POST",
        contentType: "application/json",

        data: JSON.stringify({
            service: serviceName,
            attack_type: attackType
        }),

        success: function (response) {
            logAttack(`✅ ${response.message}`);
            logAttack("⏱️ Wait a few seconds, then calculate scores.");
            showNotification("success", response.message);
        },

        error: function (xhr) {
            const errorMessage =
                xhr.responseJSON?.error || "Attack simulation failed.";

            console.error("Attack simulation error:", xhr);
            logAttack(`❌ ${errorMessage}`);
            showNotification("error", errorMessage);
        }
    });
}


function runFullSystemAttack() {
    if (!confirm("Simulate a SolarWinds-style attack on all demo services?")) {
        return;
    }

    logAttack("");
    logAttack("🔥 FULL SYSTEM ATTACK INITIATED");
    logAttack("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    logAttack("🎯 Targeting Chrome, Zoom, and Slack...");

    $.ajax({
        url: "/api/simulate-system-attack",
        method: "POST",
        contentType: "application/json",

        data: JSON.stringify({
            attack_type: "solarwinds"
        }),

        success: function (response) {
            logAttack(`✅ ${response.message}`);
            logAttack("⏱️ Wait a few seconds for simulated events.");
            logAttack("📊 Go to Dashboard and click Calculate Scores.");
            showNotification("success", response.message);
        },

        error: function (xhr) {
            const errorMessage =
                xhr.responseJSON?.error || "Full system attack failed.";

            logAttack(`❌ ${errorMessage}`);
            console.error(xhr);
            showNotification("error", errorMessage);
        }
    });
}


function clearSimulatedEvents() {
    if (!confirm("Clear all simulated events?")) {
        return;
    }

    logAttack("🔄 Clearing simulated events...");

    $.ajax({
        url: "/api/clear-simulated-events",
        method: "POST",

        success: function (response) {
            logAttack(`✅ ${response.message}`);
            logAttack("🔄 Recalculating scores...");
            showNotification("success", response.message);

            $.post("/api/calculate-all-scores", function () {
                logAttack("✅ Scores recalculated.");
            });
        },

        error: function (xhr) {
            const errorMessage =
                xhr.responseJSON?.error || "Could not clear simulations.";

            logAttack(`❌ ${errorMessage}`);
            showNotification("error", errorMessage);
        }
    });
}


function showNotification(type, message) {
    const alertClass =
        type === "success"
            ? "success"
            : type === "warning"
            ? "warning"
            : type === "info"
            ? "info"
            : "danger";

    const notification = `
        <div class="position-fixed top-0 end-0 p-3" style="z-index: 9999;">
            <div class="alert alert-${alertClass} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        </div>
    `;

    $("body").append(notification);

    setTimeout(function () {
        $(".alert-dismissible").fadeOut(function () {
            $(this).remove();
        });
    }, 4000);
}


function logAttack(message) {
    const log = $("#attackLog");
    const timestamp = new Date().toLocaleTimeString();

    if (message === "") {
        log.append("<br>");
    } else {
        const line = $("<div>");
        line.text(`[${timestamp}] ${message}`);
        log.append(line);
    }

    if (log.length > 0) {
        log.scrollTop(log[0].scrollHeight);
    }
}