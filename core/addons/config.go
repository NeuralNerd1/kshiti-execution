package addons

import (
	"github.com/kshiti/exec-admin-service/core/addons/browser"
	"github.com/kshiti/exec-admin-service/core/addons/logging"
)

// ExecutionConfig acts as the master umbrella struct that aggregates 
// all subsystem configurations into a flat JSON structure requested by the API.
type ExecutionConfig struct {
	// Inline the sub-structs so they serialize flat exactly like the frontend expects.
	browser.BrowserConfig
	logging.LoggingConfig
}
