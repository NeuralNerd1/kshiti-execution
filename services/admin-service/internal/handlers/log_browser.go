package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"

	"github.com/go-chi/chi/v5"
)

// LogBrowserHandler serves log tree and file content from Supabase Storage
type LogBrowserHandler struct {
	SupabaseURL string
	SupabaseKey string
	Bucket      string
}

// ListTree returns the folder tree for a project's logs
// GET /api/execution/logs/tree/{projectId}
func (h *LogBrowserHandler) ListTree(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "projectId")
	if projectID == "" {
		h.jsonError(w, "Project ID is required", http.StatusBadRequest)
		return
	}

	// List all objects in the bucket with the project prefix
	// Supabase Storage API: POST /storage/v1/object/list/{bucket}
	reqURL := fmt.Sprintf("%s/storage/v1/object/list/%s", h.SupabaseURL, h.Bucket)

	// Body: { "prefix": "{projectId}", "limit": 1000, "offset": 0 }
	// We need to search broadly — the prefix could include company dirs
	// So we list from root and filter client-side, OR list with empty prefix
	body := fmt.Sprintf(`{"prefix":"","limit":1000,"offset":0,"search":"%s"}`, projectID)

	req, err := http.NewRequest("POST", reqURL, io.NopCloser(
		io.Reader(jsonReader(body)),
	))
	if err != nil {
		h.jsonError(w, "Failed to create request", http.StatusInternalServerError)
		return
	}
	req.Header.Set("Authorization", "Bearer "+h.SupabaseKey)
	req.Header.Set("apikey", h.SupabaseKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		h.jsonError(w, "Failed to list storage: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		h.jsonError(w, "Supabase error: "+string(respBody), resp.StatusCode)
		return
	}

	// The Supabase list API returns flat objects and folders
	// We need to do recursive listing by prefix
	// Let's take a simpler approach: list ALL objects recursively
	allObjects, err := h.listAllObjects("")
	if err != nil {
		h.jsonError(w, "Failed to list objects: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Filter to only objects containing this projectId
	var filtered []string
	for _, obj := range allObjects {
		if containsProjectPath(obj, projectID) {
			filtered = append(filtered, obj)
		}
	}

	// Build tree structure from flat paths
	log.Printf("Found %d objects in Supabase for project %s", len(filtered), projectID)
	tree := buildTreeFromPaths(filtered)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(tree)
}

// listAllObjects recursively lists all objects in the bucket
func (h *LogBrowserHandler) listAllObjects(prefix string) ([]string, error) {
	reqURL := fmt.Sprintf("%s/storage/v1/object/list/%s", h.SupabaseURL, h.Bucket)

	bodyStr := fmt.Sprintf(`{"prefix":"%s","limit":1000,"offset":0}`, prefix)
	req, err := http.NewRequest("POST", reqURL, jsonReader(bodyStr))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+h.SupabaseKey)
	req.Header.Set("apikey", h.SupabaseKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("Supabase List Error [%d]: %s", resp.StatusCode, string(body))
		return nil, fmt.Errorf("supabase error: %d", resp.StatusCode)
	}

	var items []struct {
		Name string `json:"name"`
		ID   string `json:"id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&items); err != nil {
		return nil, err
	}

	log.Printf("Supabase listed %d items for prefix: '%s'", len(items), prefix)

	var results []string
	for _, item := range items {
		fullPath := item.Name
		if prefix != "" {
			fullPath = prefix + "/" + item.Name
		}

		if item.ID == "" {
			// It's a folder — recurse
			subItems, err := h.listAllObjects(fullPath)
			if err != nil {
				continue
			}
			results = append(results, subItems...)
		} else {
			// It's a file
			results = append(results, fullPath)
		}
	}
	return results, nil
}

// GetFile returns the content of a specific log file
// GET /api/execution/logs/file?path=...
func (h *LogBrowserHandler) GetFile(w http.ResponseWriter, r *http.Request) {
	filePath := r.URL.Query().Get("path")
	if filePath == "" {
		h.jsonError(w, "File path is required", http.StatusBadRequest)
		return
	}

	// Download file from Supabase Storage
	encodedPath := url.PathEscape(filePath)
	// Replace %2F back to / for Supabase path
	reqURL := fmt.Sprintf("%s/storage/v1/object/%s/%s", h.SupabaseURL, h.Bucket, filePath)

	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		h.jsonError(w, "Failed to create request", http.StatusInternalServerError)
		return
	}
	req.Header.Set("Authorization", "Bearer "+h.SupabaseKey)
	req.Header.Set("apikey", h.SupabaseKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		h.jsonError(w, "Failed to fetch file: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == 404 {
		h.jsonError(w, "File not found", http.StatusNotFound)
		return
	}

	content, _ := io.ReadAll(resp.Body)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"path":    filePath,
		"content": string(content),
	})

	_ = encodedPath // suppress unused warning
}

// Helper: build a nested tree from flat file paths
type TreeNode struct {
	ID       string      `json:"id"`
	Name     string      `json:"name"`
	Type     string      `json:"type"`
	Path     string      `json:"path,omitempty"`
	Children []*TreeNode `json:"children,omitempty"`
}

func buildTreeFromPaths(paths []string) []*TreeNode {
	root := &TreeNode{Children: []*TreeNode{}}

	for _, path := range paths {
		parts := splitPath(path)
		current := root
		for i, part := range parts {
			isFile := i == len(parts)-1
			found := false
			for _, child := range current.Children {
				if child.Name == part {
					current = child
					found = true
					break
				}
			}
			if !found {
				node := &TreeNode{
					ID:   path + "-" + part,
					Name: part,
					Type: "folder",
				}
				if isFile {
					node.Type = "file"
					node.Path = path
				} else {
					node.Children = []*TreeNode{}
				}
				current.Children = append(current.Children, node)
				current = node
			}
		}
	}
	return root.Children
}

func splitPath(path string) []string {
	parts := []string{}
	for _, p := range split(path, "/") {
		if p != "" {
			parts = append(parts, p)
		}
	}
	return parts
}

func split(s string, sep string) []string {
	result := []string{}
	current := ""
	for _, c := range s {
		if string(c) == sep {
			if current != "" {
				result = append(result, current)
			}
			current = ""
		} else {
			current += string(c)
		}
	}
	if current != "" {
		result = append(result, current)
	}
	return result
}

func containsProjectPath(path, projectID string) bool {
	parts := splitPath(path)
	for _, p := range parts {
		if p == projectID {
			return true
		}
	}
	return false
}

func jsonReader(s string) io.Reader {
	return io.NopCloser(io.Reader(stringReader(s)))
}

type stringReader string

func (s stringReader) Read(p []byte) (n int, err error) {
	n = copy(p, string(s))
	return n, io.EOF
}

func (h *LogBrowserHandler) jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
