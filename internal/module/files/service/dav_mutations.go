package service

import (
	"context"
	"errors"
	"strings"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

type DAVCopyOptions struct {
	Depth     CopyDepth
	Overwrite bool
	Condition ContentCondition
}
type DAVMoveOptions struct {
	Overwrite bool
	Condition ContentCondition
}

// checkConnectionSubtree 防止通过目录复制或移动绕过系统文件写入策略。
func checkConnectionSubtree(snapshot ConnectionFileSnapshot, source model.Entry, recursive bool) error {
	if !recursive || !snapshot.Connection.BlockSystemFiles {
		return nil
	}
	for _, entry := range snapshot.Entries {
		if entry.ID != source.ID && model.Visible(snapshot.Entries, entry) && Within(snapshot.Entries, source.ID, entry.ID) && strings.HasPrefix(entry.Name, ".") {
			return ErrConnectionSystemFile
		}
	}
	return nil
}

func (s *DAVFiles) change(ctx context.Context, scope DAVScope, action func(ConnectionFileSnapshot) ([]model.Entry, error)) ([]model.Entry, error) {
	if _, _, err := s.snapshot(ctx, scope, ConnectionWrite); err != nil {
		return nil, err
	}
	return s.connections.store.ChangeConnectionFiles(ctx, scope.ConnectionID, scope.Revision, func(snapshot ConnectionFileSnapshot) ([]model.Entry, error) {
		if s.connections.status(snapshot.Connection, snapshot.Entries) != ConnectionStatusActive {
			return nil, ErrConnectionUnavailable
		}
		if snapshot.Connection.ReadOnly {
			return nil, ErrConnectionReadOnly
		}
		return action(snapshot)
	})
}
func (s *DAVFiles) Mkdir(ctx context.Context, scope DAVScope, relative string) error {
	parts, err := s.parts(relative)
	if err != nil {
		return err
	}
	if len(parts) == 0 {
		return model.ErrConflict
	}
	_, err = s.change(ctx, scope, func(snapshot ConnectionFileSnapshot) ([]model.Entry, error) {
		parent, err := s.resolve(snapshot.Entries, snapshot.Connection, parts[:len(parts)-1])
		if err != nil {
			return nil, err
		}
		if parent.Kind != model.Folder {
			return nil, model.ErrConflict
		}
		name := parts[len(parts)-1]
		if err := connectionWriteTarget(snapshot.Connection, snapshot.Entries, parent.ID, name); err != nil {
			return nil, err
		}
		normalized, err := s.files.normalizedName(name)
		if err != nil {
			return nil, err
		}
		if err := model.Available(snapshot.Entries, "", parent.ID, normalized); err != nil {
			return nil, err
		}
		id, err := s.files.ids.New()
		if err != nil {
			return nil, err
		}
		now := s.files.clock.Now().UTC()
		return []model.Entry{{ID: id, OwnerID: snapshot.Connection.OwnerID, ParentID: parent.ID, Name: name, NormalizedName: normalized, Kind: model.Folder, CreatedAt: now, UpdatedAt: now, ContentRevision: 1}}, nil
	})
	return err
}
func (s *DAVFiles) Remove(ctx context.Context, scope DAVScope, relative string, condition ContentCondition) error {
	parts, err := s.parts(relative)
	if err != nil {
		return err
	}
	if len(parts) == 0 {
		return model.ErrConflict
	}
	_, err = s.change(ctx, scope, func(snapshot ConnectionFileSnapshot) ([]model.Entry, error) {
		entry, err := s.resolve(snapshot.Entries, snapshot.Connection, parts)
		if err != nil {
			return nil, err
		}
		if err := checkContentCondition(&entry, condition); err != nil {
			return nil, err
		}
		now := s.files.clock.Now().UTC()
		entry.TrashedAt = &now
		entry.UpdatedAt = now
		return []model.Entry{entry}, nil
	})
	return err
}

func (s *DAVFiles) destination(snapshot ConnectionFileSnapshot, parts []string) (model.Entry, *model.Entry, string, error) {
	if len(parts) == 0 {
		return model.Entry{}, nil, "", model.ErrConflict
	}
	parent, err := s.resolve(snapshot.Entries, snapshot.Connection, parts[:len(parts)-1])
	if err != nil {
		return model.Entry{}, nil, "", err
	}
	if parent.Kind != model.Folder {
		return model.Entry{}, nil, "", model.ErrConflict
	}
	name := parts[len(parts)-1]
	if err := connectionWriteTarget(snapshot.Connection, snapshot.Entries, parent.ID, name); err != nil {
		return model.Entry{}, nil, "", err
	}
	normalized, err := s.files.normalizedName(name)
	if err != nil {
		return model.Entry{}, nil, "", err
	}
	var target *model.Entry
	for _, entry := range snapshot.Entries {
		if entry.ParentID == parent.ID && entry.NormalizedName == normalized && model.Visible(snapshot.Entries, entry) {
			if target != nil {
				return model.Entry{}, nil, "", model.ErrConflict
			}
			copy := entry
			target = &copy
		}
	}
	return parent, target, normalized, nil
}

func (s *DAVFiles) Move(ctx context.Context, scope DAVScope, relative, destination string, options DAVMoveOptions) (bool, error) {
	sourceParts, err := s.parts(relative)
	if err != nil {
		return false, err
	}
	destinationParts, err := s.parts(destination)
	if err != nil {
		return false, err
	}
	if len(sourceParts) == 0 {
		return false, model.ErrConflict
	}
	created := false
	_, err = s.change(ctx, scope, func(snapshot ConnectionFileSnapshot) ([]model.Entry, error) {
		source, err := s.resolve(snapshot.Entries, snapshot.Connection, sourceParts)
		if err != nil {
			return nil, err
		}
		if err := checkContentCondition(&source, options.Condition); err != nil {
			return nil, err
		}
		parent, target, normalized, err := s.destination(snapshot, destinationParts)
		if err != nil {
			return nil, err
		}
		if source.Kind == model.Folder && Within(snapshot.Entries, source.ID, parent.ID) {
			return nil, model.ErrConflict
		}
		if err := checkConnectionSubtree(snapshot, source, true); err != nil {
			return nil, err
		}
		if target != nil && !options.Overwrite {
			return nil, ErrContentPrecondition
		}
		now := s.files.clock.Now().UTC()
		changes := []model.Entry{}
		if target != nil && target.ID != source.ID {
			target.TrashedAt = &now
			target.UpdatedAt = now
			changes = append(changes, *target)
		}
		source.ParentID = parent.ID
		source.Name = destinationParts[len(destinationParts)-1]
		source.NormalizedName = normalized
		source.UpdatedAt = now
		changes = append(changes, source)
		created = target == nil
		return changes, nil
	})
	return created, err
}

func (s *DAVFiles) Copy(ctx context.Context, scope DAVScope, relative, destination string, options DAVCopyOptions) (bool, error) {
	sourceParts, err := s.parts(relative)
	if err != nil {
		return false, err
	}
	destinationParts, err := s.parts(destination)
	if err != nil {
		return false, err
	}
	if len(sourceParts) == 0 {
		return false, model.ErrConflict
	}
	created := false
	_, err = s.change(ctx, scope, func(snapshot ConnectionFileSnapshot) ([]model.Entry, error) {
		source, err := s.resolve(snapshot.Entries, snapshot.Connection, sourceParts)
		if err != nil {
			return nil, err
		}
		if err := checkContentCondition(&source, options.Condition); err != nil {
			return nil, err
		}
		parent, target, normalized, err := s.destination(snapshot, destinationParts)
		if err != nil {
			return nil, err
		}
		if target != nil && source.ID == target.ID {
			return nil, model.ErrConflict
		}
		if target != nil && !options.Overwrite {
			return nil, ErrContentPrecondition
		}
		if options.Depth != CopyRecursive && options.Depth != CopyShallow {
			return nil, model.ErrInvalid
		}
		if source.Kind == model.Folder && Within(snapshot.Entries, source.ID, parent.ID) {
			return nil, model.ErrConflict
		}
		name := destinationParts[len(destinationParts)-1]
		now := s.files.clock.Now().UTC()
		created = target == nil
		if target != nil && target.Kind == model.File && source.Kind == model.File {
			used := model.Used(snapshot.Entries)
			if target.SizeBytes < 0 || target.SizeBytes > used {
				return nil, model.ErrQuota
			}
			used -= target.SizeBytes
			if used > s.files.policy.QuotaBytes || source.SizeBytes > s.files.policy.QuotaBytes-used {
				return nil, model.ErrQuota
			}
			target.ObjectKey = source.ObjectKey
			target.SizeBytes = source.SizeBytes
			target.MediaType = source.MediaType
			target.ContentSHA = source.ContentSHA
			target.ContentRevision++
			target.UpdatedAt = now
			target.Name = name
			return []model.Entry{*target}, nil
		}
		working := append([]model.Entry(nil), snapshot.Entries...)
		changes := []model.Entry{}
		if target != nil {
			target.TrashedAt = &now
			target.UpdatedAt = now
			changes = append(changes, *target)
			for index := range working {
				if working[index].ID == target.ID {
					working[index] = *target
					break
				}
			}
		}
		if err := checkConnectionSubtree(snapshot, source, options.Depth == CopyRecursive); err != nil {
			return nil, err
		}
		copies, err := s.files.copyTree(working, source.ID, parent.ID, name, normalized, options.Depth)
		if err != nil {
			return nil, err
		}
		if len(copies) == 0 {
			return nil, errors.New("file copy produced no root")
		}
		return append(changes, copies...), nil
	})
	return created, err
}
