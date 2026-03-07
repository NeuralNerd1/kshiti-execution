package logging

// LoggingConfig represents the logging and observability settings.
type LoggingConfig struct {
	LoggingLevel                string `json:"loggingLevel"`
	CaptureConsoleLogsOnFailure bool   `json:"captureConsoleLogsOnFailure"`
}
