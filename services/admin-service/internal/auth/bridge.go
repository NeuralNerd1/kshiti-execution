package auth

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// BridgeClient calls the Planning app's bridge API.
type BridgeClient struct {
	BaseURL string
	APIKey  string
	Client  *http.Client
}

// BridgeAuthResponse is the response from /bridge/auth/verify/.
type BridgeAuthResponse struct {
	Authenticated bool            `json:"authenticated"`
	Mode          string          `json:"mode"`
	User          *BridgeUser     `json:"user"`
	Company       *BridgeCompany  `json:"company"`
	Projects      []BridgeProject `json:"projects"`
	Error         string          `json:"error,omitempty"`
}

type BridgeUser struct {
	ID          int    `json:"id"`
	Email       string `json:"email"`
	FirstName   string `json:"first_name"`
	LastName    string `json:"last_name"`
	DisplayName string `json:"display_name"`
	AvatarURL   *string `json:"avatar_url"`
}

type BridgeCompany struct {
	ID     int    `json:"id"`
	Name   string `json:"name"`
	Slug   string `json:"slug"`
	Status string `json:"status"`
}

type BridgeProject struct {
	ID          int                    `json:"id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Status      string                 `json:"status"`
	Role        string                 `json:"role"`
	Permissions map[string]interface{} `json:"permissions"`
}

// NewBridgeClient creates a new bridge API client.
func NewBridgeClient(baseURL, apiKey string) *BridgeClient {
	return &BridgeClient{
		BaseURL: baseURL,
		APIKey:  apiKey,
		Client: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

// VerifyJWT calls the planning bridge to verify a JWT token.
func (b *BridgeClient) VerifyJWT(jwtToken string) (*BridgeAuthResponse, error) {
	req, err := http.NewRequest("POST", b.BaseURL+"/auth/verify/", bytes.NewBuffer([]byte("{}")))
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+jwtToken)

	resp, err := b.Client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("bridge request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading response: %w", err)
	}

	var result BridgeAuthResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("parsing response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return &result, fmt.Errorf("bridge returned %d: %s", resp.StatusCode, result.Error)
	}

	return &result, nil
}

// VerifyAPIKey calls bridge with API key + user_id.
func (b *BridgeClient) VerifyAPIKey(userID int) (*BridgeAuthResponse, error) {
	payload, _ := json.Marshal(map[string]int{"user_id": userID})

	req, err := http.NewRequest("POST", b.BaseURL+"/auth/verify/", bytes.NewBuffer(payload))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Bridge-Api-Key", b.APIKey)

	resp, err := b.Client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var result BridgeAuthResponse
	json.Unmarshal(body, &result)

	if resp.StatusCode != http.StatusOK {
		return &result, fmt.Errorf("bridge error %d", resp.StatusCode)
	}

	return &result, nil
}

// GetProjectSnapshot fetches the full project snapshot from the planning app.
func (b *BridgeClient) GetProjectSnapshot(projectID string, userID int) (map[string]interface{}, error) {
	reqURL := fmt.Sprintf("%s/project-snapshot/%s/?user_id=%d", b.BaseURL, projectID, userID)
	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Bridge-Api-Key", b.APIKey)

	resp, err := b.Client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("bridge request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("bridge returned %d", resp.StatusCode)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("parsing response: %w", err)
	}

	return result, nil
}

