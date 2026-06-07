// positive: Go exec.Command routes a dynamic command through sh -c
package runner

import (
	"fmt"
	"os/exec"
)

func archive(name string) *exec.Cmd {
	return exec.Command("sh", "-c", fmt.Sprintf("tar czf %s.tgz ./src", name))
}
