// negative: normal Go test, no skip / no nolint
package widget

import "testing"

func TestAdd(t *testing.T) {
	if add(2, 3) != 5 {
		t.Fatalf("expected 5")
	}
}
