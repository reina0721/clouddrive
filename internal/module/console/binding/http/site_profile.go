package httpbinding

import (
	"net/http"
	"strings"

	"github.com/reina0721/clouddrive/internal/module/console/model"
)

const (
	publicSiteProfilePath = "/site-profile"
	adminSiteProfilePath  = "/system/site-profile"
)

func (h *Handler) siteProfileRoutes() {
	h.mux.HandleFunc("GET "+Prefix+publicSiteProfilePath, func(w http.ResponseWriter, r *http.Request) {
		value, err := h.store.SiteProfile(r.Context())
		if err != nil {
			problem(w, err)
			return
		}
		reply(w, value.Profile)
	})
	h.mux.HandleFunc("GET "+Prefix+adminSiteProfilePath, func(w http.ResponseWriter, r *http.Request) {
		if !require(w, r, "console:settings:read") {
			return
		}
		value, err := h.store.SiteProfile(r.Context())
		if err != nil {
			problem(w, err)
			return
		}
		reply(w, value)
	})
	h.mux.HandleFunc("PUT "+Prefix+adminSiteProfilePath, func(w http.ResponseWriter, r *http.Request) {
		if !require(w, r, "console:settings:write") {
			return
		}
		var body struct {
			Revision int64              `json:"revision"`
			Profile  *model.SiteProfile `json:"profile"`
		}
		if !decode(w, r, &body) {
			return
		}
		if body.Profile == nil || body.Revision < 1 || body.Revision >= model.MaxSiteProfileRevision {
			problem(w, ErrInvalidQuery)
			return
		}
		body.Profile.Name = strings.TrimSpace(body.Profile.Name)
		body.Profile.Description = strings.TrimSpace(strings.ReplaceAll(body.Profile.Description, "\r\n", "\n"))
		if !body.Profile.Valid() {
			problem(w, ErrInvalidQuery)
			return
		}
		value, err := h.store.SaveSiteProfile(r.Context(), model.SiteProfileVersion{Revision: body.Revision, Profile: *body.Profile})
		if err != nil {
			problem(w, err)
			return
		}
		reply(w, value)
	})
}
