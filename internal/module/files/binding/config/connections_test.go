package configbinding

import "testing"

func TestConnectionPublicOriginRejectsCredentialsPathsAndAmbiguity(t *testing.T) {
	for _, origin := range []string{"https://files.example.test", "http://127.0.0.1:8123", ""} {
		config := Config{Connections: ConnectionConfig{PublicOrigin: origin}}
		if err := config.validateConnectionOrigin(); err != nil {
			t.Fatal("拒绝有效origin", err)
		}
	}
	for _, origin := range []string{"//files.example.test", "https://user:secret@example.test", "https://files.example.test/", "https://files.example.test?", "https://files.example.test#", "https://files.example.test?q=1", "https://:", "file:///server"} {
		config := Config{Connections: ConnectionConfig{PublicOrigin: origin}}
		if err := config.validateConnectionOrigin(); err == nil {
			t.Fatal("错误origin被接受")
		}
	}
}
