// positive: Go os.Getenv then if-empty hardcoded secret default
package config

import "os"

func AuthToken() string {
	token := os.Getenv("AUTH_TOKEN")
	if token == "" {
		token = "hardcoded-fallback-token"
	}
	return token
}
