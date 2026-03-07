package router

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/kshiti/exec-admin-service/internal/auth"
	"github.com/kshiti/exec-admin-service/internal/config"
	"github.com/kshiti/exec-admin-service/internal/email"
	"github.com/kshiti/exec-admin-service/internal/handlers"
)

// New creates and configures the Chi router.
func New(cfg *config.Config) *chi.Mux {
	r := chi.NewRouter()

	// ── Global Middleware ───────────────────────────────────────────────
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RealIP)

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.CORSOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Admin-Secret"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// ── Dependencies ───────────────────────────────────────────────────
	bridgeClient := auth.NewBridgeClient(cfg.BridgeAPIURL, cfg.BridgeAPIKey)
	mailer := email.NewSender(cfg.SMTPHost, cfg.SMTPPort, cfg.SMTPUser, cfg.SMTPPass, cfg.SMTPFrom)

	authHandler := &handlers.AuthHandler{
		JWTSecret:    cfg.JWTSecret,
		BridgeClient: bridgeClient,
	}

	passwordHandler := &handlers.PasswordHandler{
		JWTSecret: cfg.JWTSecret,
		Mailer:    mailer,
	}

	adminUsersHandler := &handlers.AdminUsersHandler{}
	adminPlansHandler := &handlers.AdminPlansHandler{}

	// ── Health Check ───────────────────────────────────────────────────
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok", "service": "exec-admin-service"})
	})

	// ── Auth Routes ────────────────────────────────────────────────────
	r.Route("/api/auth", func(r chi.Router) {
		// Public
		r.Post("/login", authHandler.Login)
		r.Post("/forgot-password", passwordHandler.ForgotPassword)
		r.Post("/verify-code", passwordHandler.VerifyCode)
		r.Post("/reset-password", passwordHandler.ResetPassword)
		r.Post("/bridge-login", authHandler.BridgeLogin)

		// Protected (JWT required)
		r.Group(func(r chi.Router) {
			r.Use(auth.Middleware(cfg.JWTSecret))
			r.Get("/session", authHandler.Session)
		})
	})

	// ── Bridge Proxy Routes ────────────────────────────────────────────
	r.Route("/api/bridge", func(r chi.Router) {
		r.Use(auth.Middleware(cfg.JWTSecret))
		r.Get("/project-snapshot/{id}", authHandler.ProjectSnapshot)
	})

	// ── Protected User Routes (Local Projects) ─────────────────────
	r.Route("/api/local", func(r chi.Router) {
		r.Use(auth.Middleware(cfg.JWTSecret))
		localProjectsHandler := &handlers.LocalProjectsHandler{}
		r.Get("/projects", localProjectsHandler.List)
		r.Post("/projects", localProjectsHandler.Create)
	})

	// ── Execution Services ─────────────────────────────────────────────
	r.Route("/api/execution", func(r chi.Router) {
		executionHandler := &handlers.ExecutionHandler{
			SupabaseURL: cfg.SupabaseURL,
			SupabaseKey: cfg.SupabaseKey,
		}
		r.Post("/run", executionHandler.Run)
		
		configHandler := &handlers.ExecutionConfigHandler{}
		r.Get("/config/{projectId}", configHandler.GetConfig)
		r.Post("/config/{projectId}", configHandler.SaveConfig)

		runsHandler := &handlers.ExecutionRunsHandler{}
		r.Get("/run/{runId}", runsHandler.GetRun)
		r.Get("/runs/{projectId}", runsHandler.ListRuns)
		r.Post("/run/{runId}/stop", runsHandler.StopRun)

		logBrowser := &handlers.LogBrowserHandler{
			SupabaseURL: cfg.SupabaseURL,
			SupabaseKey: cfg.SupabaseKey,
			Bucket:      "execution-logs",
		}
		r.Get("/logs/tree/{projectId}", logBrowser.ListTree)
		r.Get("/logs/file", logBrowser.GetFile)
	})

	// ── Admin Routes (protected by admin secret) ───────────────────────
	r.Route("/api/admin", func(r chi.Router) {
		r.Use(auth.AdminMiddleware(cfg.AdminSecret))

		// Users
		r.Get("/users", adminUsersHandler.ListUsers)
		r.Post("/users", adminUsersHandler.CreateUser)
		r.Put("/users/{id}/password", adminUsersHandler.ChangePassword)

		// Plans
		r.Get("/plans", adminPlansHandler.ListPlans)
		r.Put("/plans/{id}", adminPlansHandler.UpdatePlan)
	})

	return r
}
