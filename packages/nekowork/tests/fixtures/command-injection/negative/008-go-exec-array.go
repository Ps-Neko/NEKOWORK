// negative: Go exec.Command with a real binary + arg array (no shell)
package runner

import "os/exec"

func listing(dir string) *exec.Cmd {
	// The binary is invoked directly; args are separate strings — no shell -c.
	return exec.Command("ls", "-la", dir)
}

func checkout(branch string) *exec.Cmd {
	return exec.Command("git", "checkout", branch)
}
