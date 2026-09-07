/**
 * SCBTSS Dashboard
 * Loads service cards, alerts, score history, and baseline details.
 */

let scoreChart = null;


$(document).ready(function () {
    console.log("Dashboard initialized");

    loadDashboard();

    setInterval(loadDashboard, 30000);

    document.addEventListener("visibilitychange", function () {
        if (!document.hidden) {
            loadDashboard();
        }
    });
});


function loadDashboard() {
    $.ajax({
        url: "/api/stats",
        method: "GET",
        timeout: 10000,

        success: function (data) {
            updateStats(data);
            updateServices(data.services || []);
            loadAlerts();
        },

        error: function (xhr, status, error) {
            console.error("Dashboard load error:", error);

            $("#servicesGrid").html(`
                <div class="col-12">
                    <div class="alert alert-danger">
                        Could not load dashboard data.
                        Check whether the API is running.
                    </div>
                </div>
            `);
        }
    });
}


function updateStats(data) {
    $("#serviceCount").text(data.total_services || 0);
    $("#eventCount").text(data.total_events || 0);
    $("#alertCount").text(data.unread_alerts || 0);
}


function updateServices(services) {
    const container = $("#servicesGrid");

    if (!services || services.length === 0) {
        container.html(`
            <div class="col-12 text-center py-5">
                <p class="text-muted">
                    <i class="fas fa-info-circle"></i>
                    No monitored services available.
                </p>
            </div>
        `);

        return;
    }

    container.empty();

    services.forEach(function (service) {
        const zone = service.zone || "GREEN";
        const zoneLower = zone.toLowerCase();

        const html = `
            <div class="col-md-4 mb-4">
                <div class="card service-card zone-${zone}">
                    <div class="card-body">
                        <h5 class="card-title">
                            <i class="fas fa-cube"></i>
                            ${service.display_name || service.name}
                        </h5>

                        <div class="text-center mb-3">
                            <div class="score-circle score-${zoneLower}">
                                ${service.dts_score ?? 100}
                            </div>

                            <span class="badge badge-zone badge-${zoneLower}">
                                ${zone}
                            </span>
                        </div>

                        <div class="mb-3">
                            <small class="text-muted">
                                <i class="fas fa-cube"></i>
                                Category: ${service.category || "Uncategorized"}
                                <br>

                                <i class="fas fa-exclamation"></i>
                                Criticality: ${service.criticality || "Unknown"}
                                <br>

                                <i class="fas fa-plug"></i>
                                Status: ${service.status || "Unknown"}
                            </small>
                        </div>

                        <div class="d-grid gap-2">
                            <button
                                class="btn btn-sm btn-outline-primary"
                                onclick="showScoreHistory(
                                    ${service.id},
                                    '${escapeSingleQuotes(service.display_name || service.name)}'
                                )"
                            >
                                <i class="fas fa-chart-line"></i>
                                Score History
                            </button>

                            <button
                                class="btn btn-sm btn-outline-secondary"
                                onclick="showBaseline(
                                    ${service.id},
                                    '${escapeSingleQuotes(service.display_name || service.name)}'
                                )"
                            >
                                <i class="fas fa-database"></i>
                                Baseline
                            </button>
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
        url: "/api/alerts?limit=5",
        method: "GET",

        success: function (alerts) {
            const unacknowledgedAlerts = (alerts || []).filter(function (alert) {
                return !alert.is_acknowledged;
            });

            if (unacknowledgedAlerts.length > 0) {
                displayAlerts(unacknowledgedAlerts);
            } else {
                $("#alertsSection").hide();
            }
        },

        error: function () {
            console.error("Failed to load alerts");
        }
    });
}


function displayAlerts(alerts) {
    const container = $("#alertsList");

    $("#alertsSection").show();
    container.empty();

    alerts.forEach(function (alert) {
        const timestamp = formatDateTime(alert.timestamp);

        const html = `
            <div class="alert alert-warning mb-2">
                <div class="d-flex justify-content-between">
                    <div>
                        <h6>${alert.title || "Security Alert"}</h6>
                        <p class="mb-1">${alert.message || "Anomaly detected"}</p>

                        <small class="text-muted">
                            <i class="fas fa-clock"></i>
                            ${timestamp}
                        </small>
                    </div>

                    <button
                        class="btn btn-sm btn-outline-secondary"
                        onclick="acknowledgeAlert(${alert.id})"
                        title="Acknowledge alert"
                    >
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
        method: "POST",

        success: function () {
            showNotification("success", "Alert acknowledged");
            loadDashboard();
        },

        error: function () {
            showNotification("error", "Could not acknowledge alert");
        }
    });
}


function showScoreHistory(serviceId, serviceName) {
    $("#scoreModalTitle").text(`${serviceName} - Score History`);

    $("#scoreDetails").html(`
        <p class="text-muted">
            Loading score history...
        </p>
    `);

    $.ajax({
        url: `/api/scores/${serviceId}?hours=24`,
        method: "GET",

        success: function (scores) {
            if (!scores || scores.length === 0) {
                $("#scoreDetails").html(`
                    <p class="text-muted">
                        No score history available yet.
                        Run an attack simulation and click Calculate Scores.
                    </p>
                `);

                return;
            }

            renderScoreChart(scores);
            renderScoreDetails(scores);
        },

        error: function () {
            $("#scoreDetails").html(`
                <p class="text-danger">
                    Failed to load score history.
                </p>
            `);
        }
    });

    const modalElement = document.getElementById("scoreModal");

    if (modalElement && window.bootstrap) {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    }
}


function renderScoreChart(scores) {
    const canvas = document.getElementById("scoreChart");

    if (!canvas) {
        return;
    }

    if (typeof Chart === "undefined") {
        $("#scoreDetails").prepend(`
            <div class="alert alert-warning">
                Chart.js is not loaded. Add the Chart.js CDN script to index.html.
            </div>
        `);

        return;
    }

    const context = canvas.getContext("2d");

    if (scoreChart) {
        scoreChart.destroy();
    }

    const labels = scores.map(function (score) {
        return formatChartTime(score.timestamp);
    });

    const values = scores.map(function (score) {
        return score.dts_score;
    });

    scoreChart = new Chart(context, {
        type: "line",

        data: {
            labels: labels,

            datasets: [
                {
                    label: "DTS Score",
                    data: values,
                    borderColor: "#0d6efd",
                    backgroundColor: "rgba(13, 110, 253, 0.15)",
                    fill: true,
                    tension: 0.35,
                    pointRadius: 5,
                    pointHoverRadius: 7
                }
            ]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            scales: {
                y: {
                    min: 0,
                    max: 100,

                    ticks: {
                        stepSize: 20
                    },

                    title: {
                        display: true,
                        text: "Trust Score"
                    }
                },

                x: {
                    title: {
                        display: true,
                        text: "Time"
                    }
                }
            },

            plugins: {
                legend: {
                    display: true,
                    position: "top"
                }
            }
        }
    });
}


function renderScoreDetails(scores) {
    const values = scores.map(function (score) {
        return score.dts_score;
    });

    const current = values[values.length - 1];
    const lowest = Math.min(...values);
    const highest = Math.max(...values);

    const average = (
        values.reduce(function (total, value) {
            return total + value;
        }, 0) / values.length
    ).toFixed(1);

    $("#scoreDetails").html(`
        <div class="row text-center border-top pt-3">
            <div class="col-3">
                <h5>${current}</h5>
                <small class="text-muted">Current</small>
            </div>

            <div class="col-3">
                <h5>${highest}</h5>
                <small class="text-muted">Highest</small>
            </div>

            <div class="col-3">
                <h5>${lowest}</h5>
                <small class="text-muted">Lowest</small>
            </div>

            <div class="col-3">
                <h5>${average}</h5>
                <small class="text-muted">Average</small>
            </div>
        </div>
    `);
}


function showBaseline(serviceId, serviceName) {
    $("#baselineContent").html(`
        <p class="text-muted">
            Loading baseline for ${serviceName}...
        </p>
    `);

    $.ajax({
        url: `/api/baselines/${serviceId}`,
        method: "GET",

        success: function (baselines) {
            if (!baselines || baselines.length === 0) {
                $("#baselineContent").html(`
                    <p class="text-muted">
                        No baseline is available for this service.
                    </p>
                `);

                return;
            }

            let html = "";

            baselines.forEach(function (baseline) {
                html += renderBaselineCard(baseline);
            });

            $("#baselineContent").html(html);
        },

        error: function () {
            $("#baselineContent").html(`
                <p class="text-danger">
                    Failed to load baseline data.
                </p>
            `);
        }
    });

    const modalElement = document.getElementById("baselineModal");

    if (modalElement && window.bootstrap) {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    }
}


function renderBaselineCard(baseline) {
    const data = baseline.baseline_data || {};
    const confidence = ((baseline.confidence || 0) * 100).toFixed(0);

    return `
        <div class="card mb-3">
            <div class="card-header">
                <strong>${baseline.metric_name || "Baseline"}</strong>

                <span class="badge bg-info float-end">
                    Confidence: ${confidence}%
                </span>
            </div>

            <div class="card-body">
                <p>
                    <strong>Type:</strong>
                    ${baseline.metric_type || "Unknown"}
                </p>

                <p>
                    <strong>Sample size:</strong>
                    ${baseline.sample_size || 0}
                </p>

                <pre class="small bg-light p-2 rounded mb-0">${JSON.stringify(data, null, 2)}</pre>
            </div>
        </div>
    `;
}


function calculateAllBaselines(button) {
    const btn = button;
    const originalText = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = `
        <i class="fas fa-spinner fa-spin"></i>
        Calculating...
    `;

    $.ajax({
        url: "/api/calculate-all-baselines",
        method: "POST",

        success: function () {
            showNotification("success", "Baselines calculated");
            loadDashboard();
        },

        error: function () {
            showNotification("error", "Failed to calculate baselines");
        },

        complete: function () {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
}


function calculateAllScores(button) {
    const btn = button;
    const originalText = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = `
        <i class="fas fa-spinner fa-spin"></i>
        Calculating...
    `;

    $.ajax({
        url: "/api/calculate-all-scores",
        method: "POST",

        success: function () {
            showNotification("success", "Scores calculated");

            setTimeout(function () {
                loadDashboard();
            }, 500);
        },

        error: function () {
            showNotification("error", "Failed to calculate scores");
        },

        complete: function () {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
}


function showNotification(type, message) {
    const alertClass = type === "success" ? "success" : "danger";

    const notification = `
        <div class="position-fixed top-0 end-0 p-3" style="z-index: 9999;">
            <div class="alert alert-${alertClass} alert-dismissible fade show">
                ${message}

                <button
                    type="button"
                    class="btn-close"
                    data-bs-dismiss="alert"
                ></button>
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


function formatDateTime(timestamp) {
    if (!timestamp) {
        return "Unknown time";
    }

    return new Date(timestamp).toLocaleString();
}


function formatChartTime(timestamp) {
    if (!timestamp) {
        return "";
    }

    return new Date(timestamp).toLocaleTimeString();
}


function escapeSingleQuotes(value) {
    return String(value || "").replace(/'/g, "\\'");
}