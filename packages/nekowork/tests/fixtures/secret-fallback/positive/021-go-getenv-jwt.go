// positive: Go JWT secret read from env with hardcoded fallback
package auth

import "os"

func jwtSecret() string {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "change-me-in-prod"
	}
	return secret
}
