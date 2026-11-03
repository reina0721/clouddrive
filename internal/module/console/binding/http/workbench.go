package httpbinding

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/reina0721/clouddrive/internal/module/console/adapter/trigger"
	"github.com/reina0721/clouddrive/pkg/execution"
	"github.com/reina0721/clouddrive/pkg/schedule"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
)

func (h *Handler) workbenchRoutes() {
	h.mux.HandleFunc("GET "+Prefix+"/api-workbench/workspace", h.workspace)
	h.mux.HandleFunc("PUT "+Prefix+"/api-workbench/workspace", h.workspace)
	h.mux.HandleFunc("DELETE "+Prefix+"/api-workbench/workspace/history", h.workspace)
	h.mux.HandleFunc("GET "+Prefix+"/api-workbench/workspace/usage", h.workspaceUsage)
	h.mux.HandleFunc("POST "+Prefix+"/api-workbench/execute", func(w http.ResponseWriter, r *http.Request) {
		if !require(w, r, "console:workbench:execute") {
			return
		}
		var input ResolvedRequest
		if !decode(w, r, &input) {
			return
		}
		reply(w, ExecuteRelay(r.Context(), input, h.relay))
	})
	h.mux.HandleFunc("GET "+Prefix+"/api-workbench/tasks", h.tasks)
	h.mux.HandleFunc("POST "+Prefix+"/api-workbench/tasks", h.tasks)
	h.mux.HandleFunc("DELETE "+Prefix+"/api-workbench/tasks/{id}", h.tasks)
}
func (h *Handler) workspace(w http.ResponseWriter, r *http.Request) {
	key := "console:workbench:read"
	if r.Method != "GET" {
		key = "console:workbench:write"
	}
	if !require(w, r, key) {
		return
	}
	owner := current(r).Identity.AccountID
	record, err := h.store.Workspace(r.Context(), owner)
	if err != nil {
		problem(w, err)
		return
	}
	if r.Method == "GET" {
		var snapshot Workspace
		if err = json.Unmarshal([]byte(record.Snapshot), &snapshot); err != nil {
			problem(w, err)
			return
		}
		tasks, e := h.taskList(r.Context(), owner)
		if e != nil {
			problem(w, e)
			return
		}
		snapshot.Tasks = tasks
		w.Header().Set("ETag", strconv.Quote(strconv.FormatUint(record.Version, 10)))
		reply(w, snapshot)
		return
	}
	var snapshot Workspace
	expected, e := strconv.ParseUint(strings.Trim(r.Header.Get("If-Match"), "\""), 10, 64)
	if e != nil || expected != record.Version {
		failure(w, 409, "conflict", "stale-version")
		return
	}
	if r.Method == "PUT" {
		if !decode(w, r, &snapshot) {
			return
		}
		if err = validateWorkspace(snapshot); err != nil {
			failure(w, 422, "validation", "")
			return
		}
	} else {
		if err = json.Unmarshal([]byte(record.Snapshot), &snapshot); err != nil {
			problem(w, err)
			return
		}
		snapshot.History = []json.RawMessage{}
	}
	snapshot.Tasks = []TaskDefinition{}
	bytes, err := json.Marshal(snapshot)
	if err != nil {
		problem(w, err)
		return
	}
	record.Snapshot = string(bytes)
	if err = h.store.SaveWorkspace(r.Context(), record); err != nil {
		problem(w, err)
		return
	}
	w.Header().Set("ETag", strconv.Quote(strconv.FormatUint(record.Version+1, 10)))
	w.WriteHeader(204)
}
func validateWorkspace(snapshot Workspace) error {
	if snapshot.Version != 1 || len(snapshot.Requests) > 2000 || len(snapshot.History) > 10000 {
		return errors.New("invalid workspace size or version")
	}
	projects := map[string]bool{}
	for _, project := range snapshot.Projects {
		if project.ID == "" || projects[project.ID] || strings.TrimSpace(project.Name) == "" || len([]rune(project.Name)) > 128 {
			return errors.New("invalid project")
		}
		projects[project.ID] = true
	}
	collections := map[string]bool{}
	for _, collection := range snapshot.Collections {
		if collection.ID == "" || collections[collection.ID] || !projects[collection.ProjectID] || strings.TrimSpace(collection.Name) == "" || len([]rune(collection.Name)) > 128 {
			return errors.New("invalid collection")
		}
		collections[collection.ID] = true
	}
	requests := map[string]bool{}
	for _, request := range snapshot.Requests {
		if request.ID == "" || requests[request.ID] || !collections[request.CollectionID] || strings.TrimSpace(request.Name) == "" || len([]rune(request.Name)) > 128 {
			return errors.New("invalid request")
		}
		requests[request.ID] = true
	}
	return nil
}
func (h *Handler) workspaceUsage(w http.ResponseWriter, r *http.Request) {
	if !require(w, r, "console:workbench:read") {
		return
	}
	record, err := h.store.Workspace(r.Context(), current(r).Identity.AccountID)
	if err != nil {
		problem(w, err)
		return
	}
	var snapshot Workspace
	if err = json.Unmarshal([]byte(record.Snapshot), &snapshot); err != nil {
		problem(w, err)
		return
	}
	reply(w, map[string]any{"dbSizeFormatted": fmt.Sprintf("%.1f KiB", float64(len(record.Snapshot))/1024), "count": len(snapshot.Requests)})
}
func (h *Handler) taskList(ctx context.Context, owner string) ([]TaskDefinition, error) {
	records, err := h.store.Tasks(ctx, owner)
	if err != nil {
		return nil, err
	}
	items := []TaskDefinition{}
	for _, record := range records {
		var task TaskDefinition
		if err = json.Unmarshal([]byte(record.Definition), &task); err != nil {
			return nil, err
		}
		task.Version = record.Version
		items = append(items, task)
	}
	return items, nil
}
func nextRun(expression string, now time.Time) (time.Time, error) {
	if duration, err := time.ParseDuration(expression); err == nil {
		if duration < time.Second || duration > 365*24*time.Hour {
			return time.Time{}, errors.New("interval outside allowed range")
		}
		return now.Add(duration), nil
	}
	return trigger.Next(expression, now)
}
func (h *Handler) tasks(w http.ResponseWriter, r *http.Request) {
	owner := current(r).Identity.AccountID
	if r.Method == "GET" {
		if !require(w, r, "console:workbench:read") {
			return
		}
		tasks, err := h.taskList(r.Context(), owner)
		if err != nil {
			problem(w, err)
			return
		}
		reply(w, tasks)
		return
	}
	if !require(w, r, "console:workbench:write") || !require(w, r, "console:workbench:execute") {
		return
	}
	if r.Method == "DELETE" {
		err := h.store.DeleteTask(r.Context(), owner, r.PathValue("id"), r.URL.Query().Get("version"))
		if err != nil {
			problem(w, err)
			return
		}
		w.WriteHeader(204)
		return
	}
	var task TaskDefinition
	if !decode(w, r, &task) {
		return
	}
	if !regexp.MustCompile("^[A-Za-z0-9][A-Za-z0-9_.:-]{0,35}$").MatchString(task.ID) || strings.TrimSpace(task.Name) == "" || len([]rune(task.Name)) > 80 {
		failure(w, 422, "validation", "")
		return
	}
	next, err := nextRun(task.CronOrInterval, time.Now())
	if err != nil {
		failure(w, 422, "validation", "")
		return
	}
	workspace, err := h.store.Workspace(r.Context(), owner)
	if err != nil {
		problem(w, err)
		return
	}
	var snapshot Workspace
	if err = json.Unmarshal([]byte(workspace.Snapshot), &snapshot); err != nil {
		problem(w, err)
		return
	}
	found := false
	for _, collection := range snapshot.Collections {
		if collection.ID == task.TargetCollectionID {
			found = true
		}
	}
	requestCount := 0
	for _, definition := range snapshot.Requests {
		if definition.CollectionID == task.TargetCollectionID {
			requestCount++
			if task.Enabled && (definition.PreScript != "" || definition.PostScript != "" || len(definition.Extractors) > 0) {
				failure(w, 422, "validation", "")
				return
			}
		}
	}
	if (task.Enabled && (!found || requestCount == 0)) || (!task.Enabled && task.Version == 0 && !found) {
		failure(w, 422, "validation", "")
		return
	}
	task.LastRun = nil
	bytes, err := json.Marshal(task)
	if err != nil {
		problem(w, err)
		return
	}
	var due *time.Time
	if task.Enabled {
		due = &next
	}
	err = h.store.UpsertTask(r.Context(), TaskRecord{ID: task.ID, OwnerID: owner, Definition: string(bytes), NextRunAt: due, Version: task.Version, UpdatedAt: time.Now().UTC()})
	if err != nil {
		problem(w, err)
		return
	}
	w.WriteHeader(204)
}

// ScheduleBinding 把持久化任务派发交给已有调度生命周期，不创建独立后台线程。
func (h *Handler) ScheduleBinding() (schedule.Binding, error) {
	trigger, err := schedule.FixedDelay(time.Second, time.Second)
	if err != nil {
		return schedule.Binding{}, err
	}
	return schedule.Bind(schedule.Spec{ID: "console.workbench.dispatch", Trigger: trigger, Concurrency: schedule.SerialSkip(), Coordination: schedule.Local()}, h.dispatchTasks)
}
func (h *Handler) dispatchTasks(ctx context.Context) error {
	now := time.Now().UTC()
	records, err := h.store.DueTasks(ctx, now, 16)
	if err != nil {
		return err
	}
	for _, record := range records {
		var task TaskDefinition
		if err := json.Unmarshal([]byte(record.Definition), &task); err != nil {
			return err
		}
		next, err := nextRun(task.CronOrInterval, now)
		if err != nil {
			return err
		}
		claimed, err := h.store.ClaimTask(ctx, record.ID, record.Version, now, next)
		if err != nil {
			return err
		}
		if !claimed {
			continue
		}
		_, runErr := h.executor.Execute(ctx, execution.Execution{Key: execution.Key("console-task:" + record.ID + ":" + record.NextRunAt.Format(time.RFC3339Nano)), Policy: execution.RetryPolicy{MaxAttempts: 1}, Trigger: "scheduler", RetentionTTL: 24 * time.Hour, Operation: func(ctx context.Context) (any, error) {
			return nil, h.runCollection(ctx, record.OwnerID, task.TargetCollectionID)
		}})
		task.LastRun = &struct {
			Time    string `json:"time"`
			Passed  bool   `json:"passed"`
			Message string `json:"message"`
		}{Time: now.Format(time.RFC3339), Passed: runErr == nil, Message: "completed"}
		if runErr != nil {
			task.LastRun.Message = "execution failed"
		}
		bytes, err := json.Marshal(task)
		if err != nil {
			return err
		}
		if err = h.store.TaskResult(ctx, record.ID, record.Version+1, string(bytes)); err != nil {
			return err
		}
		result, category := "success", "task"
		if runErr != nil {
			result, category = "failure", "warning"
		}
		if err = h.store.Record(ctx, Event{ActorID: record.OwnerID, ActorName: task.Name, ObjectID: task.ID, ObjectName: task.Name, Operation: "workbench.task", Result: result, NotificationCategory: category}); err != nil {
			return err
		}
	}
	return nil
}
func (h *Handler) runCollection(ctx context.Context, owner, collection string) error {
	if err := h.iam.RequireConsolePermission(ctx, owner, "console:workbench:execute"); err != nil {
		return err
	}
	record, err := h.store.Workspace(ctx, owner)
	if err != nil {
		return err
	}
	var snapshot Workspace
	if err = json.Unmarshal([]byte(record.Snapshot), &snapshot); err != nil {
		return err
	}
	count := 0
	variables := map[string]string{}
	for _, entry := range snapshot.Globals {
		if entry.Enabled {
			variables[entry.Key] = entry.Value
		}
	}
	for _, env := range snapshot.Environments {
		if env.ID == snapshot.ActiveEnvironmentID {
			for _, entry := range env.Variables {
				if entry.Enabled {
					variables[entry.Key] = entry.Value
				}
			}
		}
	}
	for _, definition := range snapshot.Requests {
		if definition.CollectionID != collection {
			continue
		}
		count++
		request, err := resolveDefinition(definition, variables)
		if err != nil {
			return err
		}
		result := ExecuteRelay(ctx, request, h.relay)
		if !result.OK || result.Response == nil || result.Response.Status < 200 || result.Response.Status >= 400 {
			return errors.New("scheduled request failed")
		}
	}
	if count == 0 {
		return errors.New("collection has no requests")
	}
	return nil
}
