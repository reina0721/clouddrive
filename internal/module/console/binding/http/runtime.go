package httpbinding

import "net/http"

type RuntimeField struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}
type RuntimeMetadata struct {
	Configuration []RuntimeField `json:"configuration"`
	Capabilities  []string       `json:"capabilities"`
}

func (h *Handler) runtimeMetadata(w http.ResponseWriter, r *http.Request) {
	if !require(w, r, "management:read") {
		return
	}
	reply(w, h.runtime())
}
