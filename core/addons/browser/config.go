package browser

// BrowserConfig represents the browser and runtime execution settings.
type BrowserConfig struct {
	DefaultBrowser  string `json:"defaultBrowser"`
	HeadlessDefault bool   `json:"headlessDefault"`
}
