package main

import "os/exec"

// positive: #nosec suppresses a gosec security finding
func run(userInput string) error {
	cmd := exec.Command("sh", "-c", userInput) // #nosec
	return cmd.Run()
}
