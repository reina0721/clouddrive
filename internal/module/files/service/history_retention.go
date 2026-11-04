package service

import (
	"encoding/json"
	"github.com/reina0721/clouddrive/internal/module/files/model"
)

// retainCurrent 将当前内容加入独立历史slice；调用方仍负责在同一owner事务内发布新当前。
func (s *Service) retainCurrent(entries []model.Entry, entry model.Entry) (model.Entry, error) {
	if len(entry.History) >= s.policy.HistoryPerFile || model.HistoryCount(entries) >= s.policy.HistoryPerOwner {
		return model.Entry{}, model.ErrHistoryFull
	}
	return appendCurrentSnapshot(entry)
}

// appendCurrentSnapshot 验证持久化硬边界；恢复提升不增加关联数，不受已调低的新增保留配额阻碍。
func appendCurrentSnapshot(entry model.Entry) (model.Entry, error) {
	if entry.Kind != model.File || entry.ContentRevision < 1 || entry.ContentRevision >= model.MaxContentRevision || entry.HistoryRevision >= model.MaxHistoryRevision {
		return model.Entry{}, model.ErrInvalid
	}
	entry.History = append(model.CloneHistory(entry.History), model.CurrentSnapshot(entry))
	entry.HistoryRevision++
	probe := entry
	probe.ContentRevision++
	if err := model.ValidateHistory(probe); err != nil {
		return model.Entry{}, err
	}
	encoded, err := json.Marshal(entry.History)
	if err != nil {
		return model.Entry{}, err
	}
	if len(encoded) > model.MaxHistoryJSONBytes {
		return model.Entry{}, model.ErrHistoryFull
	}
	return entry, nil
}

func (s *Service) replacementGrowth(original model.Entry, size int64) int64 {
	if s.policy.HistoryEnabled {
		return size
	}
	return max(int64(0), size-original.SizeBytes)
}

func (s *Service) replacementUsed(entries []model.Entry, original model.Entry) int64 {
	used := model.Used(entries)
	if !s.policy.HistoryEnabled {
		used -= original.SizeBytes
	}
	return used
}
