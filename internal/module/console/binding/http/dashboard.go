package httpbinding

import (
	"net/http"
	"time"
)

func (h *Handler) dashboardRoutes() {
	h.mux.HandleFunc("GET "+Prefix+"/dashboard", h.dashboard)
	h.mux.HandleFunc("GET "+Prefix+"/todos", func(w http.ResponseWriter, r *http.Request) {
		if !require(w, r, "todos:read") {
			return
		}
		p, size, err := page(r)
		if err != nil {
			problem(w, err)
			return
		}
		offset := (p - 1) * size
		value, err := h.todos.ListTodos(r.Context(), ListTodosParams{Offset: &offset, Limit: &size})
		if err != nil {
			problem(w, err)
			return
		}
		reply(w, value)
	})
	h.mux.HandleFunc("POST "+Prefix+"/todos", func(w http.ResponseWriter, r *http.Request) {
		if !require(w, r, "todos:write") {
			return
		}
		var input CreateTodoRequest
		if !decode(w, r, &input) {
			return
		}
		value, err := h.todos.CreateTodo(r.Context(), input)
		if err != nil {
			problem(w, err)
			return
		}
		reply(w, value)
	})
	h.mux.HandleFunc("PATCH "+Prefix+"/todos/{id}/complete", func(w http.ResponseWriter, r *http.Request) {
		if !require(w, r, "todos:write") {
			return
		}
		value, err := h.todos.CompleteTodo(r.Context(), r.PathValue("id"))
		if err != nil {
			problem(w, err)
			return
		}
		reply(w, value)
	})
}

func (h *Handler) dashboard(w http.ResponseWriter, r *http.Request) {
	var users, roles *int64
	if allowed(r, "iam:account:read") {
		archived := false
		list, err := h.iam.ListAccounts(r.Context(), 0, 1, AccountFilter{Archived: &archived})
		if err != nil {
			problem(w, err)
			return
		}
		users = &list.Total
	}
	if allowed(r, "iam:role:read") {
		list, err := h.iam.ListRoles(r.Context(), 0, 1, "")
		if err != nil {
			problem(w, err)
			return
		}
		roles = &list.Total
	}
	now := time.Now().UTC()
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC).AddDate(0, 0, -29)
	owner := ""
	if !allowed(r, "auth:audit:read") {
		owner = current(r).Identity.AccountID
	}
	daily, err := h.store.DailyCounts(r.Context(), owner, start, 30)
	if err != nil {
		problem(w, err)
		return
	}
	reply(w, map[string]any{"users": users, "roles": roles, "dailyOperations": daily, "generatedAt": now})
}
