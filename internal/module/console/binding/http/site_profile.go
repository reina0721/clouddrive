package httpbinding

import (
	"net/http"
	"slices"
	"strings"

	"github.com/reina0721/clouddrive/internal/module/console/model"
)

const (
	publicSiteProfilePath = "/site-profile"
	adminSiteProfilePath  = "/system/site-profile"
)

type siteProfileManagement struct {
	model.SiteProfileVersion
	PublicationOrigins []string `json:"publicationOrigins,omitempty"`
}

func (h *Handler) publishedSiteAddresses(saved *model.SiteAddresses) *model.SiteAddresses {
	if saved == nil || !slices.Contains(h.siteOrigins, saved.Primary) {
		return nil
	}
	active := &model.SiteAddresses{Primary: saved.Primary, Alternatives: make([]string, 0, len(saved.Alternatives))}
	for _, origin := range saved.Alternatives {
		if slices.Contains(h.siteOrigins, origin) {
			active.Alternatives = append(active.Alternatives, origin)
		}
	}
	return active
}

func (h *Handler) siteProfileRoutes() {
	h.mux.HandleFunc("GET "+Prefix+publicSiteProfilePath, func(w http.ResponseWriter, r *http.Request) {
		value, err := h.store.SiteProfile(r.Context())
		if err != nil {
			problem(w, err)
			return
		}
		value.Profile.SiteAddresses = h.publishedSiteAddresses(value.Profile.SiteAddresses)
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
		reply(w, siteProfileManagement{SiteProfileVersion: value, PublicationOrigins: h.siteOrigins})
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
		addresses, valid := model.NormalizeSiteAddresses(body.Profile.SiteAddresses)
		if !valid || !body.Profile.Valid() {
			problem(w, ErrInvalidQuery)
			return
		}
		body.Profile.SiteAddresses = addresses
		if addresses != nil {
			active := h.publishedSiteAddresses(addresses)
			if active == nil || len(active.Alternatives) != len(addresses.Alternatives) {
				failure(w, http.StatusUnprocessableEntity, "validation", "site-origin-not-allowed")
				return
			}
		}
		value, err := h.store.SaveSiteProfile(r.Context(), model.SiteProfileVersion{Revision: body.Revision, Profile: *body.Profile})
		if err != nil {
			problem(w, err)
			return
		}
		reply(w, siteProfileManagement{SiteProfileVersion: value, PublicationOrigins: h.siteOrigins})
	})
}
