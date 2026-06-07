// positive: Go //nolint suppression
package server

func unsafeRead() { //nolint:errcheck
	_, _ = readSecret()
}
