// positive: Go exec.Command git push
package deploy

import "os/exec"

func Push() error {
	cmd := exec.Command("git", "push", "origin", "HEAD")
	return cmd.Run()
}
