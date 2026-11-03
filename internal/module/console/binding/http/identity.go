package httpbinding

import (
	"net/http"
	"strings"
	"time"
)

type User struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Status    string    `json:"status"`
	RoleIDs   []string  `json:"roleIds"`
	Version   uint64    `json:"version"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}
type Role struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Permissions []string  `json:"permissions"`
	Protected   bool      `json:"protected"`
	Version     uint64    `json:"version"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
	MemberCount *int64    `json:"memberCount,omitempty"`
}

func (h *Handler) user(r *http.Request, id string) (User, error) {
	detail, err := h.iam.AccountDetail(r.Context(), id)
	if err != nil {
		return User{}, err
	}
	roles := []string{}
	for _, role := range detail.Roles {
		roles = append(roles, role.ID)
	}
	a := detail.Account
	return User{a.ID, a.DisplayName, a.Username, a.Status, roles, a.Version, a.CreatedAt, a.UpdatedAt}, nil
}
func (h *Handler) role(r *http.Request, id string, summary bool) (Role, error) {
	detail, err := h.iam.RoleDetail(r.Context(), id)
	if err != nil {
		return Role{}, err
	}
	keys := []string{}
	for _, p := range detail.Permissions {
		keys = append(keys, string(p.Key))
	}
	projected := []string{}
	for name, key := range permissions {
		for _, p := range keys {
			if p == string(key) {
				projected = append(projected, name)
				break
			}
		}
	}
	a := detail.Role
	result := Role{ID: a.ID, Name: a.Name, Permissions: projected, Protected: a.System, Version: a.Version, CreatedAt: a.CreatedAt, UpdatedAt: a.UpdatedAt}
	if summary {
		count := detail.AssignedAccountCount
		result.MemberCount = &count
	}
	return result, nil
}
func (h *Handler) listUsers(w http.ResponseWriter, r *http.Request) {
	if !require(w, r, "iam:account:read") {
		return
	}
	p, size, err := page(r)
	if err != nil {
		problem(w, err)
		return
	}
	list, err := h.iam.ListAccounts(r.Context(), (p-1)*size, size, queryFilter(r.URL.Query()))
	if err != nil {
		problem(w, err)
		return
	}
	items := []User{}
	for _, a := range list.Items {
		u, e := h.user(r, a.ID)
		if e != nil {
			problem(w, e)
			return
		}
		items = append(items, u)
	}
	reply(w, map[string]any{"items": items, "total": list.Total, "page": p, "pageSize": size})
}
func targetID(r *http.Request) string {
	id := r.PathValue("id")
	if id == "" {
		id = current(r).Identity.AccountID
	}
	return id
}
func (h *Handler) readUser(w http.ResponseWriter, r *http.Request) {
	id := targetID(r)
	if id != current(r).Identity.AccountID && !require(w, r, "iam:account:read") {
		return
	}
	u, err := h.user(r, id)
	if err != nil {
		problem(w, err)
		return
	}
	reply(w, map[string]User{"user": u})
}
func (h *Handler) createUser(w http.ResponseWriter, r *http.Request) {
	if !require(w, r, "iam:account:write") {
		return
	}
	var input struct {
		Name     string   `json:"name"`
		Email    string   `json:"email"`
		Password string   `json:"password"`
		RoleIDs  []string `json:"roleIds"`
		Status   string   `json:"status"`
	}
	if !decode(w, r, &input) {
		return
	}
	a, err := h.iam.CreateConsoleAccount(r.Context(), input.Email, input.Name, input.Password, input.RoleIDs, input.Status, false)
	if err != nil {
		problem(w, err)
		return
	}
	u, err := h.user(r, a.ID)
	if err != nil {
		problem(w, err)
		return
	}
	reply(w, map[string]User{"user": u})
}
func (h *Handler) updateUser(w http.ResponseWriter, r *http.Request) {
	id := targetID(r)
	key := "iam:account:write"
	if r.PathValue("id") == "" {
		key = "iam:account:self:profile:write"
	}
	if !require(w, r, key) {
		return
	}
	var input struct {
		Name    string `json:"name"`
		Email   string `json:"email"`
		Version uint64 `json:"version"`
	}
	if !decode(w, r, &input) {
		return
	}
	if err := h.iam.UpdateConsoleProfile(r.Context(), id, input.Version, input.Name, input.Email); err != nil {
		problem(w, err)
		return
	}
	u, err := h.user(r, id)
	if err != nil {
		problem(w, err)
		return
	}
	reply(w, map[string]User{"user": u})
}
func (h *Handler) mutateUser(w http.ResponseWriter, r *http.Request) {
	if !require(w, r, "iam:account:write") {
		return
	}
	var input struct {
		Version uint64   `json:"version"`
		Status  string   `json:"status"`
		RoleIDs []string `json:"roleIds"`
	}
	if !decode(w, r, &input) {
		return
	}
	var err error
	if input.Version == 0 {
		problem(w, ErrVersionConflict)
		return
	}
	switch r.PathValue("action") {
	case "status":
		err = h.iam.SetAccountStatusVersion(r.Context(), targetID(r), input.Status, input.Version)
	case "roles":
		_, err = h.iam.ReplaceAccountRoles(r.Context(), targetID(r), input.Version, input.RoleIDs)
	default:
		failure(w, 404, "not-found", "")
		return
	}
	if err != nil {
		problem(w, err)
		return
	}
	u, err := h.user(r, targetID(r))
	if err != nil {
		problem(w, err)
		return
	}
	reply(w, map[string]User{"user": u})
}
func (h *Handler) batchStatus(w http.ResponseWriter, r *http.Request) {
	if !require(w, r, "iam:account:write") {
		return
	}
	var input struct {
		Status string `json:"status"`
		Items  []struct {
			ID      string `json:"id"`
			Version uint64 `json:"version"`
		} `json:"items"`
	}
	if !decode(w, r, &input) {
		return
	}
	if len(input.Items) < 1 || len(input.Items) > 200 || !validStatus(input.Status) {
		failure(w, 422, "validation", "")
		return
	}
	seen := map[string]bool{}
	for _, i := range input.Items {
		if seen[i.ID] || i.Version == 0 {
			failure(w, 422, "validation", "")
			return
		}
		seen[i.ID] = true
	}
	items := []any{}
	for _, i := range input.Items {
		err := h.iam.SetAccountStatusVersion(r.Context(), i.ID, input.Status, i.Version)
		if err != nil {
			items = append(items, map[string]any{"id": i.ID, "success": false, "code": "conflict"})
			continue
		}
		u, e := h.user(r, i.ID)
		if e != nil {
			problem(w, e)
			return
		}
		items = append(items, map[string]any{"id": i.ID, "success": true, "user": u})
	}
	reply(w, map[string]any{"items": items})
}
func (h *Handler) listRoles(w http.ResponseWriter, r *http.Request) {
	if r.URL.Query().Get("scope") == "self" {
		detail, err := h.iam.AccountDetail(r.Context(), current(r).Identity.AccountID)
		if err != nil {
			problem(w, err)
			return
		}
		items := []Role{}
		for _, entry := range detail.Roles {
			role, err := h.role(r, entry.ID, false)
			if err != nil {
				problem(w, err)
				return
			}
			items = append(items, role)
		}
		reply(w, map[string]any{"items": items})
		return
	}
	if !require(w, r, "iam:role:read") {
		return
	}
	items := []Role{}
	for offset := 0; ; offset += 100 {
		list, err := h.iam.ListRoles(r.Context(), offset, 100, "")
		if err != nil {
			problem(w, err)
			return
		}
		for _, a := range list.Items {
			if a.Archived || !a.Active {
				continue
			}
			role, e := h.role(r, a.ID, r.URL.Query().Get("include") == "memberCount")
			if e != nil {
				problem(w, e)
				return
			}
			items = append(items, role)
		}
		if int64(offset+100) >= list.Total {
			break
		}
	}
	reply(w, map[string]any{"items": items})
}
func (h *Handler) readRole(w http.ResponseWriter, r *http.Request) {
	if !require(w, r, "iam:role:read") {
		return
	}
	role, err := h.role(r, r.PathValue("id"), false)
	if err != nil {
		problem(w, err)
		return
	}
	reply(w, map[string]Role{"role": role})
}
func (h *Handler) writeRole(w http.ResponseWriter, r *http.Request) {
	if !require(w, r, "iam:role:write") {
		return
	}
	var input struct {
		Name        string   `json:"name"`
		Permissions []string `json:"permissions"`
		Version     uint64   `json:"version"`
	}
	if !decode(w, r, &input) {
		return
	}
	keys, err := nativePermissions(input.Permissions)
	if err != nil {
		problem(w, err)
		return
	}
	// 未由当前 UI 展示的原生权限保持原值，避免编辑角色意外撤销其它模块权限。
	if id := r.PathValue("id"); id != "" {
		snapshot, e := h.iam.RolePermissionsSnapshot(r.Context(), id)
		if e != nil {
			problem(w, e)
			return
		}
		for _, key := range snapshot.PermissionKeys {
			managed := false
			for _, value := range permissions {
				if value == key {
					managed = true
					break
				}
			}
			if !managed {
				keys = append(keys, key)
			}
		}
	}
	id, err := h.iam.WriteConsoleRole(r.Context(), r.PathValue("id"), input.Version, input.Name, keys)
	if err != nil {
		problem(w, err)
		return
	}
	role, err := h.role(r, id, false)
	if err != nil {
		problem(w, err)
		return
	}
	reply(w, map[string]Role{"role": role})
}
func (h *Handler) roleMembers(w http.ResponseWriter, r *http.Request) {
	if !require(w, r, "iam:account:read") {
		return
	}
	p, size, err := page(r)
	if err != nil {
		problem(w, err)
		return
	}
	q := r.URL.Query()
	q.Set("roleId", r.PathValue("id"))
	copy := r.Clone(r.Context())
	u := *r.URL
	copy.URL = &u
	copy.URL.RawQuery = q.Encode()
	h.listUsers(w, copy)
	_ = p
	_ = size
}
func (h *Handler) roleMember(w http.ResponseWriter, r *http.Request) {
	if !require(w, r, "iam:account:write") {
		return
	}
	var input struct {
		UserID  string `json:"userId"`
		Version uint64 `json:"version"`
	}
	if !decode(w, r, &input) {
		return
	}
	if input.UserID == "" {
		input.UserID = r.PathValue("userId")
	}
	snapshot, err := h.iam.AccountRolesSnapshot(r.Context(), input.UserID)
	if err != nil {
		problem(w, err)
		return
	}
	ids := []string{}
	for _, id := range snapshot.RoleIDs {
		if id != r.PathValue("id") {
			ids = append(ids, id)
		}
	}
	if r.Method == "POST" {
		ids = append(ids, r.PathValue("id"))
	}
	if len(ids) == 0 {
		failure(w, 422, "validation", "")
		return
	}
	_, err = h.iam.ReplaceAccountRoles(r.Context(), input.UserID, input.Version, ids)
	if err != nil {
		problem(w, err)
		return
	}
	u, err := h.user(r, input.UserID)
	if err != nil {
		problem(w, err)
		return
	}
	reply(w, map[string]User{"user": u})
}

var _ = strings.TrimSpace
