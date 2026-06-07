// positive: Go tls.Config with InsecureSkipVerify
package client

import "crypto/tls"

func config() *tls.Config {
	return &tls.Config{InsecureSkipVerify: true}
}
