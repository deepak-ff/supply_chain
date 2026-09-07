package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/deepak-ff/supply_chain/internal/trust"
)

// trustStore opens the local Dynamic Trust Score ledger. The ledger is
// deliberately file-backed (not in Postgres) so that `cwctl trust` on a
// developer laptop and the dashboard served by `cwctl serve` read exactly the
// same data with no database dependency.
func trustStore() (*trust.Store, error) {
	return trust.NewStore("")
}

// ListTrust returns a trust summary for every tracked package.
// GET /api/v1/trust
func (h *Handler) ListTrust(c *gin.Context) {
	store, err := trustStore()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	items, err := store.List()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	states := map[string]int{
		trust.StateLearning: 0,
		trust.StateGreen:    0,
		trust.StateAmber:    0,
		trust.StateRed:      0,
	}
	total := 0
	for _, it := range items {
		states[it.State]++
		total += it.Score
	}
	average := 100
	if len(items) > 0 {
		average = total / len(items)
	}

	if items == nil {
		items = []trust.Summary{}
	}
	c.JSON(http.StatusOK, gin.H{
		"packages":      items,
		"tracked":       len(items),
		"average_score": average,
		"states":        states,
		"store":         store.Root(),
	})
}

// GetTrust returns the baseline plus the latest score for one package.
// GET /api/v1/trust/:ecosystem/:name
func (h *Handler) GetTrust(c *gin.Context) {
	ecosystem := c.Param("ecosystem")
	name := strings.TrimPrefix(c.Param("name"), "/")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "package name is required"})
		return
	}

	store, err := trustStore()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ledger, err := store.Load(ecosystem, name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if len(ledger.Observations) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "no trust observations for " + trust.Key(ecosystem, name)})
		return
	}

	baseline, score, err := store.Assess(ecosystem, name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"baseline":     baseline,
		"score":        score,
		"observations": ledger.Observations,
	})
}

// RecordTrustObservation appends a behavioural observation and returns the
// resulting score. Used by CI jobs and by the dashboard's manual entry form.
// POST /api/v1/trust/observe
func (h *Handler) RecordTrustObservation(c *gin.Context) {
	var obs trust.Observation
	if err := c.ShouldBindJSON(&obs); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid observation: " + err.Error()})
		return
	}
	if strings.TrimSpace(obs.Package) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "package is required"})
		return
	}
	if obs.Source == "" {
		obs.Source = "api"
	}

	store, err := trustStore()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	score, err := store.Record(obs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	h.log.Info("trust observation recorded",
		"package", obs.Key(), "version", obs.Version, "score", score.Score, "state", score.State)

	c.JSON(http.StatusOK, gin.H{"score": score})
}

// SimulateTrust scores a synthetic compromise scenario without touching the
// ledger — it powers the "Run simulation" button on the Trust page and makes
// the engine demonstrable on a fresh install.
// POST /api/v1/trust/simulate
func (h *Handler) SimulateTrust(c *gin.Context) {
	var req struct {
		Scenario  string `json:"scenario"`
		Ecosystem string `json:"ecosystem"`
		Package   string `json:"package"`
		Releases  int    `json:"releases"`
	}
	_ = c.ShouldBindJSON(&req)

	if req.Scenario == "" {
		req.Scenario = string(trust.ScenarioHijack)
	}
	if req.Package == "" {
		req.Package = "demo-lib"
	}
	if req.Ecosystem == "" {
		req.Ecosystem = "npm"
	}
	if req.Releases <= 0 {
		req.Releases = 8
	}

	sim, err := trust.Simulate(req.Ecosystem, req.Package, trust.SimulationScenario(req.Scenario), req.Releases)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, sim)
}
