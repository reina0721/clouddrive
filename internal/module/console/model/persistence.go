package model

import (
	"encoding/json"
	"time"
)

type Event struct {
	NotificationCategory string    `json:"-" gorm:"-"`
	ID                   string    `json:"id"`
	ActorID              string    `json:"actorId"`
	ActorName            string    `json:"actorName"`
	ObjectID             string    `json:"objectId"`
	ObjectName           string    `json:"objectName"`
	Operation            string    `json:"operation"`
	CreatedAt            time.Time `json:"createdAt"`
	Result               string    `json:"result"`
	ErrorCode            string    `json:"errorCode,omitempty"`
}

type Notification struct {
	ID         string    `json:"id"`
	OwnerID    string    `json:"ownerId"`
	Operation  string    `json:"operation"`
	ObjectID   string    `json:"objectId"`
	ObjectName string    `json:"objectName"`
	Category   string    `json:"category"`
	CreatedAt  time.Time `json:"createdAt"`
	Read       bool      `json:"read"`
}

type Dictionary struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Code      string `json:"code"`
	Status    string `json:"status"`
	Remark    string `json:"remark"`
	UpdatedAt int64  `json:"updatedAt"`
	Version   uint64 `json:"version"`
}

type DictionaryItem struct {
	ID      string `json:"id"`
	TypeID  string `json:"typeId"`
	Label   string `json:"label"`
	Value   string `json:"value"`
	Order   int    `json:"order" gorm:"column:sort_order"`
	Status  string `json:"status"`
	Tone    string `json:"tone"`
	Version uint64 `json:"version"`
}

type WorkspaceRecord struct {
	OwnerID   string `gorm:"primaryKey"`
	Snapshot  string
	Version   uint64
	UpdatedAt time.Time
}

type KeyValue struct {
	ID          string `json:"id"`
	Key         string `json:"key"`
	Value       string `json:"value"`
	Enabled     bool   `json:"enabled"`
	Description string `json:"description,omitempty"`
}

type RequestDefinition struct {
	ID           string     `json:"id"`
	CollectionID string     `json:"collectionId"`
	Name         string     `json:"name"`
	Method       string     `json:"method"`
	URL          string     `json:"url"`
	Params       []KeyValue `json:"params"`
	Headers      []KeyValue `json:"headers"`
	Auth         struct {
		Type     string `json:"type"`
		Token    string `json:"token,omitempty"`
		Username string `json:"username,omitempty"`
		Password string `json:"password,omitempty"`
		Key      string `json:"key,omitempty"`
		Value    string `json:"value,omitempty"`
		In       string `json:"in,omitempty"`
	} `json:"auth"`
	Body struct {
		Type    string     `json:"type"`
		Content string     `json:"content,omitempty"`
		Entries []KeyValue `json:"entries,omitempty"`
	} `json:"body"`
	Disguise *struct {
		TimeoutMS   int    `json:"timeoutMs"`
		UserAgent   string `json:"userAgent,omitempty"`
		Proxy       string `json:"proxy,omitempty"`
		Fingerprint string `json:"fingerprint,omitempty"`
	} `json:"disguise"`
	Extractors []struct {
		ID         string `json:"id"`
		Variable   string `json:"variable"`
		Source     string `json:"source"`
		Expression string `json:"expression"`
		Scope      string `json:"scope"`
	} `json:"extractors"`
	PreScript  string `json:"preScript"`
	PostScript string `json:"postScript"`
}

type Workspace struct {
	Version  int `json:"version"`
	Projects []struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	} `json:"projects"`
	Collections []struct {
		ID        string `json:"id"`
		ProjectID string `json:"projectId"`
		Name      string `json:"name"`
	} `json:"collections"`
	Requests     []RequestDefinition `json:"requests"`
	Environments []struct {
		ID        string     `json:"id"`
		Name      string     `json:"name"`
		Variables []KeyValue `json:"variables"`
	} `json:"environments"`
	ActiveEnvironmentID string            `json:"activeEnvironmentId,omitempty"`
	Globals             []KeyValue        `json:"globals"`
	Tasks               []TaskDefinition  `json:"tasks"`
	History             []json.RawMessage `json:"history"`
}

type TaskDefinition struct {
	Version            uint64 `json:"version,omitempty"`
	ID                 string `json:"id"`
	Name               string `json:"name"`
	TargetCollectionID string `json:"targetCollectionId"`
	CronOrInterval     string `json:"cronOrInterval"`
	Enabled            bool   `json:"enabled"`
	LastRun            *struct {
		Time    string `json:"time"`
		Passed  bool   `json:"passed"`
		Message string `json:"message"`
	} `json:"lastRun,omitempty"`
}

type TaskRecord struct {
	ID         string
	OwnerID    string
	Definition string
	NextRunAt  *time.Time
	Version    uint64
	UpdatedAt  time.Time
}
