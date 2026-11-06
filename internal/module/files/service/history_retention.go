package service

import (
	"encoding/json"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"slices"
)

// prepareReplacement 在副本上计算新历史；调用方只在同一owner事务成功发布时保存。
func (s *Service) prepareReplacement(entries []model.Entry, entry model.Entry, preferences model.HistoryPreferences) (model.Entry, error) {
	if err := preferences.Validate(); err != nil {
		return model.Entry{}, err
	}
	if !s.historyMatches(preferences, entry.Name) {
		return entry, nil
	}
	originalCount := len(entry.History)
	entry.History = model.CloneHistory(entry.History)
	if preferences.MaxVersions > 0 && len(entry.History) >= preferences.MaxVersions {
		slices.SortFunc(entry.History, func(a, b model.VersionSnapshot) int {
			if a.Revision < b.Revision {
				return -1
			}
			if a.Revision > b.Revision {
				return 1
			}
			return 0
		})
		entry.History = entry.History[len(entry.History)-(preferences.MaxVersions-1):]
	}
	if len(entry.History) >= s.policy.HistoryPerFile || model.HistoryCount(entries)-originalCount+len(entry.History) >= s.policy.HistoryPerOwner {
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

func (s *Service) historyMatches(preferences model.HistoryPreferences, name string) bool {
	return s.policy.HistoryEnabled && preferences.Matches(name)
}

// replacementCreditBytes 只抵扣同一目标在当前规则下释放的关联；发布仍以内容CAS和最新配额复核。
func replacementCreditBytes(original, prepared model.Entry) int64 {
	return original.SizeBytes + model.HistoryBytes(original) - model.HistoryBytes(prepared)
}

func (s *Service) replacementGrowth(original, prepared model.Entry, size int64) int64 {
	return max(int64(0), size-replacementCreditBytes(original, prepared))
}

func (s *Service) replacementUsed(entries []model.Entry, original, prepared model.Entry) int64 {
	return model.Used(entries) - original.SizeBytes - model.HistoryBytes(original) + model.HistoryBytes(prepared)
}
