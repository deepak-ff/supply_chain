package handlers

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/deepak-ff/supply_chain/internal/auth"
)

// sessionCookieName is the name of the dashboard session cookie.
const sessionCookieName = "cw_session"

// legacySessionCookieName is the pre-rebrand cookie name. It is still READ so
// that an upgrade does not log anyone out, and cleared once a new cookie is
// issued or on logout.
const legacySessionCookieName = "fg_session"

// sessionTTL is how long an issued session token is valid for.
const sessionTTL = 24 * time.Hour

// sessionToken returns the session token from either the current cw_session
// cookie or, for backward compatibility during the rebrand, the legacy
// fg_session cookie.
func (h *Handler) sessionToken(c *gin.Context) (string, error) {
	if tok, err := c.Cookie(sessionCookieName); err == nil {
		return tok, nil
	}
	return c.Cookie(legacySessionCookieName)
}

// writeSessionCookie issues the current cw_session cookie.
func (h *Handler) writeSessionCookie(c *gin.Context, value string, maxAge int) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     sessionCookieName,
		Value:    value,
		Path:     "/",
		MaxAge:   maxAge,
		Secure:   h.cfg.GetCookieSecure(),
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
	})
}

// clearSessionCookies expires both the current cw_session cookie and the
// legacy fg_session cookie, so an upgrade never leaves stale credentials in
// the browser.
func (h *Handler) clearSessionCookies(c *gin.Context) {
	for _, name := range []string{sessionCookieName, legacySessionCookieName} {
		http.SetCookie(c.Writer, &http.Cookie{
			Name:     name,
			Value:    "",
			Path:     "/",
			MaxAge:   -1,
			Secure:   h.cfg.GetCookieSecure(),
			HttpOnly: true,
			SameSite: http.SameSiteStrictMode,
		})
	}
}

// clearLegacySessionCookie expires only the old fg_session cookie. Used right
// after issuing a fresh cw_session cookie so an upgraded browser sheds the
// legacy credential without invalidating the new session.
func (h *Handler) clearLegacySessionCookie(c *gin.Context) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     legacySessionCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		Secure:   h.cfg.GetCookieSecure(),
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
	})
}

// Login authenticates the bootstrapped dashboard admin and, on success,
// sets a signed session cookie.
// POST /api/v1/auth/login   body: {"email":"...","password":"..."}
func (h *Handler) Login(c *gin.Context) {
	admin := h.cfg.GetAdminIdentity()
	if admin == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "login is not enabled on this server"})
		return
	}

	var req struct {
		Email    string `json:"email"    binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Run the password check regardless of whether the email matches, then
	// combine both checks — avoids a cheap early-exit timing tell between
	// "unknown email" and "wrong password".
	pwErr := auth.CheckPassword(admin.PasswordHash, req.Password)
	emailMatches := strings.EqualFold(req.Email, admin.Email)
	if pwErr != nil || !emailMatches {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
		return
	}

	token, err := auth.IssueToken(admin.Email, h.cfg.GetSessionSecret(), sessionTTL)
	if err != nil {
		h.log.Error("failed to issue session token", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to issue session"})
		return
	}

	h.writeSessionCookie(c, token, int(sessionTTL.Seconds()))
	h.clearLegacySessionCookie(c)
	resp := gin.H{"ok": true}
	if admin.PasswordMustChange {
		resp["password_must_change"] = true
	}
	c.JSON(http.StatusOK, resp)
}

// Logout clears the dashboard session cookie.
// POST /api/v1/auth/logout
func (h *Handler) Logout(c *gin.Context) {
	h.clearSessionCookies(c)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// ChangePassword lets the logged-in admin change their password.
// POST /api/v1/auth/password   body: {"current_password":"...","new_password":"..."}
func (h *Handler) ChangePassword(c *gin.Context) {
	admin := h.cfg.GetAdminIdentity()
	if admin == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "login is not enabled on this server"})
		return
	}

	tok, err := h.sessionToken(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}
	if _, err := auth.ParseToken(tok, h.cfg.GetSessionSecret()); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	var req struct {
		CurrentPassword string `json:"current_password" binding:"required"`
		NewPassword     string `json:"new_password"     binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := auth.UpdateAdminPassword(admin, req.CurrentPassword, req.NewPassword); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Issue a fresh token so the current session stays valid; all other
	// sessions using the old token will expire naturally within sessionTTL.
	newToken, err := auth.IssueToken(admin.Email, h.cfg.GetSessionSecret(), sessionTTL)
	if err != nil {
		h.log.Error("failed to re-issue session token after password change", "error", err)
	} else {
		h.writeSessionCookie(c, newToken, int(sessionTTL.Seconds()))
		h.clearLegacySessionCookie(c)
	}

	h.log.Info("admin password changed")
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// AuthMe reports the current session's authentication state.
// GET /api/v1/auth/me
func (h *Handler) AuthMe(c *gin.Context) {
	admin := h.cfg.GetAdminIdentity()
	if admin == nil {
		c.JSON(http.StatusOK, gin.H{"auth_enabled": false, "authenticated": false})
		return
	}

	tok, err := h.sessionToken(c)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"auth_enabled": true, "authenticated": false})
		return
	}

	claims, err := auth.ParseToken(tok, h.cfg.GetSessionSecret())
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"auth_enabled": true, "authenticated": false})
		return
	}

	resp := gin.H{"auth_enabled": true, "authenticated": true, "email": claims.Email}
	if admin.PasswordMustChange {
		resp["password_must_change"] = true
	}
	c.JSON(http.StatusOK, resp)
}
