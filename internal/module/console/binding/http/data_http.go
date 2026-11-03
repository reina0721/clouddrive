package httpbinding

import (
	"context"
	consolemodel "github.com/reina0721/clouddrive/internal/module/console/model"
	"github.com/reina0721/clouddrive/pkg/logger"
	"net/http"
	"regexp"
	"strings"
	"time"
)

type responseStatus struct {
	http.ResponseWriter
	status int
}

func (w *responseStatus) WriteHeader(status int) {
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}
func (h *Handler) record(r *http.Request, status int) {
	session := current(r)
	if session.Identity.AccountID == "" {
		return
	}
	path := strings.TrimPrefix(r.URL.Path, Prefix)
	operation := ""
	switch {
	case path == "/auth/password":
		operation = "account.password"
	case strings.HasPrefix(path, "/auth/sessions"):
		operation = "account.sessions"
	case path == "/me":
		operation = "account.update"
	case path == "/system/registration":
		operation = "settings.update"
	case strings.HasPrefix(path, "/roles"):
		operation = "roles.update"
		if r.Method == "POST" && path == "/roles" {
			operation = "roles.create"
		}
	case strings.HasPrefix(path, "/users"):
		operation = "users.update"
		if r.Method == "POST" && path == "/users" {
			operation = "users.create"
		}
		if strings.HasSuffix(path, "/status") || strings.HasSuffix(path, "/batch-status") {
			operation = "users.status"
		}
		if strings.HasSuffix(path, "/roles") {
			operation = "users.roles"
		}
	}
	if operation == "" {
		return
	}
	result := "success"
	errorCode := ""
	if status >= 400 {
		result = "failure"
		errorCode = "unavailable"
	}
	objectID := r.PathValue("id")
	if objectID == "" {
		objectID = session.Identity.AccountID
	}
	ctx, cancel := context.WithTimeout(context.WithoutCancel(r.Context()), 2*time.Second)
	defer cancel()
	if err := h.store.Record(ctx, Event{ActorID: session.Identity.AccountID, ActorName: session.Identity.DisplayName, ObjectID: objectID, ObjectName: objectID, Operation: operation, Result: result, ErrorCode: errorCode}); err != nil {
		h.logger.Error("console event persistence failed", logger.String("owner", "console"), logger.String("phase", "record"))
	}
}

func (h *Handler) dataRoutes() {
	h.mux.HandleFunc("GET "+Prefix+"/notifications", h.notifications)
	h.mux.HandleFunc("GET "+Prefix+"/notifications/{id}", h.notifications)
	h.mux.HandleFunc("PATCH "+Prefix+"/notifications/{action}", h.readNotifications)
	h.mux.HandleFunc("GET "+Prefix+"/audit-logs", h.audit)
	h.mux.HandleFunc("GET "+Prefix+"/audit-logs/{id}", h.audit)
	h.mux.HandleFunc("GET "+Prefix+"/dictionaries", h.dictionaries)
	h.mux.HandleFunc("POST "+Prefix+"/dictionaries", h.writeDictionary)
	h.mux.HandleFunc("PATCH "+Prefix+"/dictionaries/{id}", h.writeDictionary)
	h.mux.HandleFunc("DELETE "+Prefix+"/dictionaries/{id}", h.writeDictionary)
	h.mux.HandleFunc("POST "+Prefix+"/dictionaries/{id}/items", h.writeDictionaryItem)
	h.mux.HandleFunc("PATCH "+Prefix+"/dictionary-items/{id}", h.writeDictionaryItem)
	h.mux.HandleFunc("DELETE "+Prefix+"/dictionary-items/{id}", h.writeDictionaryItem)
}
func (h *Handler) notifications(w http.ResponseWriter, r *http.Request) {
	owner := current(r).Identity.AccountID
	if id := r.PathValue("id"); id != "" {
		item, err := h.store.Notification(r.Context(), owner, id)
		if err != nil {
			problem(w, err)
			return
		}
		reply(w, map[string]any{"item": item})
		return
	}
	p, size, err := page(r)
	if err != nil {
		problem(w, err)
		return
	}
	v := r.URL.Query()
	items, total, unread, err := h.store.Notifications(r.Context(), owner, consolemodel.NotificationQuery{Query: v.Get("q"), Category: v.Get("category"), Read: v.Get("read"), Offset: (p - 1) * size, Limit: size})
	if err != nil {
		problem(w, err)
		return
	}
	reply(w, map[string]any{"items": items, "total": total, "unread": unread, "page": p, "pageSize": size})
}
func (h *Handler) readNotifications(w http.ResponseWriter, r *http.Request) {
	var input struct {
		IDs []string `json:"ids"`
	}
	if !decode(w, r, &input) {
		return
	}
	all := r.PathValue("action") == "read-all"
	if !all && (r.PathValue("action") != "read" || len(input.IDs) == 0 || len(input.IDs) > 200) {
		failure(w, 422, "validation", "")
		return
	}
	err := h.store.ReadNotifications(r.Context(), current(r).Identity.AccountID, input.IDs, all)
	if err != nil {
		problem(w, err)
		return
	}
	w.WriteHeader(204)
}
func (h *Handler) audit(w http.ResponseWriter, r *http.Request) {
	if !require(w, r, "auth:audit:read") {
		return
	}
	if id := r.PathValue("id"); id != "" {
		event, err := h.store.Event(r.Context(), id)
		if err != nil {
			problem(w, err)
			return
		}
		reply(w, map[string]any{"record": event})
		return
	}
	p, size, err := page(r)
	if err != nil {
		problem(w, err)
		return
	}
	v := r.URL.Query()
	filter := consolemodel.EventQuery{Query: v.Get("q"), Operation: v.Get("operation"), Result: v.Get("result"), Actor: v.Get("actor"), Object: v.Get("object"), Offset: (p - 1) * size, Limit: size}
	for key, target := range map[string]**time.Time{"from": &filter.From, "to": &filter.To} {
		if value := v.Get(key); value != "" {
			parsed, e := time.Parse(time.RFC3339, value)
			if e != nil {
				failure(w, 422, "validation", "")
				return
			}
			*target = &parsed
		}
	}
	if filter.From != nil && filter.To != nil && filter.From.After(*filter.To) {
		failure(w, 422, "validation", "")
		return
	}
	items, total, err := h.store.Events(r.Context(), filter)
	if err != nil {
		problem(w, err)
		return
	}
	reply(w, map[string]any{"items": items, "total": total, "page": p, "pageSize": size})
}

func (h *Handler) dictionaries(w http.ResponseWriter, r *http.Request) {
	if !require(w, r, "console:dictionary:read") {
		return
	}
	h.dictionariesResult(w, r)
}

var dictionaryCode = regexp.MustCompile(`^[A-Z][A-Z0-9_]{1,39}$`)

func validStatus(status string) bool { return status == "active" || status == "disabled" }
func (h *Handler) writeDictionary(w http.ResponseWriter, r *http.Request) {
	if !require(w, r, "console:dictionary:write") {
		return
	}
	var input Dictionary
	if !decode(w, r, &input) {
		return
	}
	id := r.PathValue("id")
	if r.Method != "DELETE" && (!dictionaryCode.MatchString(input.Code) || len([]rune(input.Name)) < 2 || len([]rune(input.Name)) > 40 || len([]rune(input.Remark)) > 200 || !validStatus(input.Status)) {
		failure(w, 422, "validation", "")
		return
	}
	var err error
	if r.Method == "DELETE" {
		err = h.store.DeleteDictionary(r.Context(), id, input.Version)
	} else {
		err = h.store.SaveDictionary(r.Context(), id, input)
	}
	if err != nil {
		problem(w, err)
		return
	}
	h.dictionariesResult(w, r)
}
func (h *Handler) dictionariesResult(w http.ResponseWriter, r *http.Request) {
	types, items, err := h.store.Dictionaries(r.Context())
	if err != nil {
		problem(w, err)
		return
	}
	reply(w, map[string]any{"types": types, "items": items})
}
func (h *Handler) writeDictionaryItem(w http.ResponseWriter, r *http.Request) {
	if !require(w, r, "console:dictionary:write") {
		return
	}
	var input DictionaryItem
	if !decode(w, r, &input) {
		return
	}
	id := r.PathValue("id")
	tones := map[string]bool{"default": true, "primary": true, "success": true, "warning": true, "danger": true}
	if r.Method != "DELETE" && (strings.TrimSpace(input.Label) == "" || len([]rune(input.Label)) > 40 || strings.TrimSpace(input.Value) == "" || len([]rune(input.Value)) > 200 || input.Order < 0 || input.Order > 999 || !validStatus(input.Status) || !tones[input.Tone]) {
		failure(w, 422, "validation", "")
		return
	}
	var err error
	if r.Method == "DELETE" {
		err = h.store.DeleteDictionaryItem(r.Context(), id, input.Version)
	} else if r.Method == "POST" {
		err = h.store.SaveDictionaryItem(r.Context(), id, "", input)
	} else {
		err = h.store.SaveDictionaryItem(r.Context(), "", id, input)
	}
	if err != nil {
		problem(w, err)
		return
	}
	h.dictionariesResult(w, r)
}
