package service

import (
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"strings"
	"unicode/utf8"
)

// canonicalDAVCondition 只把同连接相对路径转换为owner规范路径，发布阶段无需隐式寻找正规化器。
func canonicalDAVCondition(files *Service, entries []model.Entry, connection model.Connection, condition model.DAVCondition) (model.DAVCondition, error) {
	if len(condition.Lists) == 0 {
		return model.DAVCondition{}, nil
	}
	if err := condition.Validate(); err != nil {
		return model.DAVCondition{}, err
	}
	namespace, err := model.NewLockNamespace(entries)
	if err != nil {
		return model.DAVCondition{}, err
	}
	root, err := namespace.RootPath(connection.RootID)
	if err != nil {
		return model.DAVCondition{}, err
	}
	convert := func(relative string) (string, error) {
		if !utf8.ValidString(relative) || !strings.HasPrefix(relative, "/") || len(relative) > model.MaxWriteLockPathBytes || strings.ContainsAny(relative, "\\\x00") {
			return "", model.ErrInvalid
		}
		parts := []string{}
		if relative != "/" {
			parts = strings.Split(strings.TrimSuffix(relative[1:], "/"), "/")
		}
		if len(parts) > model.MaxWriteLockPathDepth {
			return "", model.ErrTooLarge
		}
		for index, part := range parts {
			normalized, err := files.normalizedName(part)
			if err != nil {
				return "", err
			}
			parts[index] = normalized
		}
		path := strings.TrimSuffix(root, "/") + "/" + strings.Join(parts, "/")
		if path != "/" {
			path = strings.TrimSuffix(path, "/")
		}
		if len(path) > model.MaxWriteLockPathBytes || len(strings.Split(strings.TrimPrefix(path, "/"), "/")) > model.MaxWriteLockPathDepth {
			return "", model.ErrTooLarge
		}
		return path, nil
	}
	result := model.DAVCondition{Lists: make([]model.DAVConditionList, len(condition.Lists))}
	result.RequestPath, err = convert(condition.RequestPath)
	if err != nil {
		return model.DAVCondition{}, err
	}
	for index, list := range condition.Lists {
		result.Lists[index] = model.DAVConditionList{Conditions: append([]model.DAVStateCondition(nil), list.Conditions...)}
		if list.Resource != "" {
			result.Lists[index].Resource, err = convert(list.Resource)
			if err != nil {
				return model.DAVCondition{}, err
			}
		}
	}
	return result, nil
}
