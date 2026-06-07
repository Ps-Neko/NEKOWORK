// negative: Go env read with non-secret fallback (port) and fail-closed secret
package config

import (
	"log"
	"os"
)

func Port() string {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	return port
}

func MustSecret() string {
	s := os.Getenv("API_SECRET")
	if s == "" {
		log.Fatal("API_SECRET must be set")
	}
	return s
}
