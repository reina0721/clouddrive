package repo

import (
	"encoding/json"
	"fmt"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"io"
	"strings"
	"time"
	"unicode/utf8"
)

// entryRecord 将持久JSON和列映射留在数据库边界，不把ORM表示泄漏给Model。
type entryRecord struct {
	AccessPolicyJSON     string
	AccessPolicyRevision int64
	ID                   string `gorm:"primaryKey"`
	OwnerID              string
	ParentID             string
	Kind                 model.Kind
	Name                 string
	NormalizedName       string
	ObjectKey            string
	SizeBytes            int64
	MediaType            string
	CreatedAt            time.Time
	// 业务Clock拥有更新时间；ORM自动改写会使刚返回的CAS版本立刻失效。
	UpdatedAt          time.Time `gorm:"autoUpdateTime:false"`
	TrashedAt          *time.Time
	UploadKey          string
	ContentSHA         string
	ContentRevision    int64
	ShareToken         string
	AnnotationJSON     string
	AnnotationRevision int64
	HistoryJSON        string
	HistoryRevision    int64
}

func (entryRecord) TableName() string { return "files_entries" }

func entryRecordFromModel(entry model.Entry) (entryRecord, error) {
	if entry.AccessPolicyRevision < 0 || entry.AccessPolicyRevision > model.MaxContentRevision {
		return entryRecord{}, model.ErrInvalid
	}
	accessJSON, accessErr := encodeAccessPolicy(entry.AccessPolicy)
	if accessErr != nil {
		return entryRecord{}, accessErr
	}
	if err := model.ValidateHistory(entry); err != nil {
		return entryRecord{}, err
	}
	history, err := json.Marshal(model.CloneHistory(entry.History))
	if err != nil {
		return entryRecord{}, fmt.Errorf("encode file history: %w", err)
	}
	if len(history) > model.MaxHistoryJSONBytes {
		return entryRecord{}, model.ErrHistoryFull
	}
	if entry.AnnotationRevision < 0 || entry.AnnotationRevision > model.MaxAnnotationRevision {
		return entryRecord{}, model.ErrInvalid
	}
	if err := model.ValidateAnnotations(entry.Annotations, model.MaxAnnotationBytes); err != nil {
		return entryRecord{}, err
	}
	if entry.Kind != model.Folder && entry.Annotations.FolderColor != "" {
		return entryRecord{}, model.ErrInvalid
	}
	encoded, err := json.Marshal(entry.Annotations)
	if err != nil {
		return entryRecord{}, fmt.Errorf("encode file annotations: %w", err)
	}
	return entryRecord{AccessPolicyJSON: accessJSON, AccessPolicyRevision: entry.AccessPolicyRevision, ID: entry.ID, OwnerID: entry.OwnerID, ParentID: entry.ParentID, Kind: entry.Kind, Name: entry.Name, NormalizedName: entry.NormalizedName, ObjectKey: entry.ObjectKey, SizeBytes: entry.SizeBytes, MediaType: entry.MediaType, CreatedAt: entry.CreatedAt, UpdatedAt: entry.UpdatedAt, TrashedAt: entry.TrashedAt, UploadKey: entry.UploadKey, ContentSHA: entry.ContentSHA, ContentRevision: entry.ContentRevision, ShareToken: entry.ShareToken, AnnotationJSON: string(encoded), AnnotationRevision: entry.AnnotationRevision, HistoryJSON: string(history), HistoryRevision: entry.HistoryRevision}, nil
}

func (record entryRecord) model() (model.Entry, error) {
	if record.AccessPolicyRevision < 0 || record.AccessPolicyRevision > model.MaxContentRevision {
		return model.Entry{}, model.ErrInvalid
	}
	accessPolicy, accessErr := decodeAccessPolicy(record.AccessPolicyJSON)
	if accessErr != nil {
		return model.Entry{}, accessErr
	}
	if !utf8.ValidString(record.HistoryJSON) || len(record.HistoryJSON) > model.MaxHistoryJSONBytes || !strings.HasPrefix(strings.TrimSpace(record.HistoryJSON), "[") {
		return model.Entry{}, model.ErrInvalid
	}
	var history []model.VersionSnapshot
	historyDecoder := json.NewDecoder(strings.NewReader(record.HistoryJSON))
	historyDecoder.DisallowUnknownFields()
	if err := historyDecoder.Decode(&history); err != nil {
		return model.Entry{}, fmt.Errorf("decode file history: %w", err)
	}
	if err := historyDecoder.Decode(new(struct{})); err != io.EOF {
		return model.Entry{}, model.ErrInvalid
	}
	if err := model.ValidateHistory(model.Entry{Kind: record.Kind, ContentRevision: record.ContentRevision, History: history, HistoryRevision: record.HistoryRevision}); err != nil {
		return model.Entry{}, err
	}
	if record.AnnotationRevision < 0 || record.AnnotationRevision > model.MaxAnnotationRevision || !utf8.ValidString(record.AnnotationJSON) || len(record.AnnotationJSON) > model.MaxAnnotationBytes {
		return model.Entry{}, model.ErrInvalid
	}
	if !strings.HasPrefix(strings.TrimSpace(record.AnnotationJSON), "{") {
		return model.Entry{}, model.ErrInvalid
	}
	var annotations model.Annotations
	decoder := json.NewDecoder(strings.NewReader(record.AnnotationJSON))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&annotations); err != nil {
		return model.Entry{}, fmt.Errorf("decode file annotations: %w", err)
	}
	if err := decoder.Decode(new(struct{})); err != io.EOF {
		return model.Entry{}, model.ErrInvalid
	}
	if err := model.ValidateAnnotations(annotations, model.MaxAnnotationBytes); err != nil {
		return model.Entry{}, err
	}
	if record.Kind != model.Folder && annotations.FolderColor != "" {
		return model.Entry{}, model.ErrInvalid
	}
	return model.Entry{AccessPolicy: accessPolicy, AccessPolicyRevision: record.AccessPolicyRevision, ID: record.ID, OwnerID: record.OwnerID, ParentID: record.ParentID, Kind: record.Kind, Name: record.Name, NormalizedName: record.NormalizedName, ObjectKey: record.ObjectKey, SizeBytes: record.SizeBytes, MediaType: record.MediaType, CreatedAt: record.CreatedAt, UpdatedAt: record.UpdatedAt, TrashedAt: record.TrashedAt, UploadKey: record.UploadKey, ContentSHA: record.ContentSHA, ContentRevision: record.ContentRevision, ShareToken: record.ShareToken, Annotations: annotations, AnnotationRevision: record.AnnotationRevision, History: history, HistoryRevision: record.HistoryRevision}, nil
}

func entryModels(records []entryRecord) ([]model.Entry, error) {
	historyCount := 0
	entries := make([]model.Entry, len(records))
	for index, record := range records {
		entry, err := record.model()
		if err != nil {
			return nil, err
		}
		entries[index] = entry
		historyCount += len(entry.History)
		if historyCount > model.MaxOwnerHistory {
			return nil, model.ErrHistoryFull
		}
	}
	return entries, nil
}
