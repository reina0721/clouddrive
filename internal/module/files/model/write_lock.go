package model

import (
	"errors"
	"strconv"
	"strings"
	"time"
)

// WriteLockDepth 表达URL根自身或整个子树的写保护。
type WriteLockDepth string

const (
	WriteLockDepthZero        WriteLockDepth = "0"
	WriteLockDepthInfinity    WriteLockDepth = "infinity"
	WriteLockTokenPrefix                     = "urn:uuid:"
	MaxWriteLocksPerOwner                    = 100
	MaxWriteLockPathBytes                    = 4096
	MaxWriteLockPathDepth                    = 64
	MaxDAVConditionBytes                     = 8192
	MaxWriteLockOwnerXMLBytes                = 8 << 10
	MaxDAVConditionLists                     = 32
	MaxDAVConditions                         = 64
)

var ErrWriteLocked = errors.New("file write locked")

const MaxWOPILockBytes = 1024

// ValidWOPILockValue 约束可回写至 HTTP 响应头的客户端锁标识。
func ValidWOPILockValue(value string) bool {
	if value == "" || len(value) > MaxWOPILockBytes {
		return false
	}
	for index := range len(value) {
		if value[index] < 0x20 || value[index] > 0x7e {
			return false
		}
	}
	return strings.TrimSpace(value) == value
}

// WriteLock 固定在owner规范URL命名空间；不能随条目ID移动。
type WriteLock struct {
	ID                   string
	OwnerID              string
	ConnectionID         string
	ConnectionRevision   int64
	RootPath             string
	Depth                WriteLockDepth
	OwnerXML             string `json:"-"`
	CreatedAt            time.Time
	ExpiresAt            time.Time
	Revision             int64
	WOPISessionID        string `json:"-"`
	WOPIEntryID          string `json:"-"`
	WOPIValue            string `json:"-"`
	WOPIContentRevision  int64  `json:"-"`
	WOPISettingsRevision int64  `json:"-"`
}

func (l WriteLock) Token() string { return WriteLockTokenPrefix + l.ID }

// FileWriteAuthority 只由已求值的 WebDAV 条件或已验证的 WOPI 会话产生。
type FileWriteAuthority struct {
	ConnectionID       string
	ConnectionRevision int64
	Tokens             []string
	WOPILockID         string
}

func (a FileWriteAuthority) Allows(l WriteLock) bool {
	if l.WOPISessionID != "" {
		return a.WOPILockID != "" && a.WOPILockID == l.ID
	}
	if a.ConnectionID == "" || a.ConnectionID != l.ConnectionID || a.ConnectionRevision != l.ConnectionRevision {
		return false
	}
	for _, token := range a.Tokens {
		if token == l.Token() {
			return true
		}
	}
	return false
}

// DAVCondition 保存已验证语法的If表达式，资源路径相对于同一个连接根。
type DAVCondition struct {
	RequestPath string
	Lists       []DAVConditionList
}

type DAVConditionList struct {
	Resource   string
	Conditions []DAVStateCondition
}

type DAVStateCondition struct {
	Not   bool
	Token string
	ETag  string
}

// Validate 防止持久记录或内部调用绕过协议表达式预算。
func (c DAVCondition) Validate() error {
	if len(c.Lists) == 0 && c.RequestPath != "" {
		return ErrInvalid
	}
	if len(c.Lists) > MaxDAVConditionLists {
		return ErrTooLarge
	}
	if len(c.Lists) > 0 && (c.RequestPath == "" || len(c.RequestPath) > MaxWriteLockPathBytes) {
		return ErrInvalid
	}
	count, bytes := 0, 0
	tagged := len(c.Lists) > 0 && c.Lists[0].Resource != ""
	for _, list := range c.Lists {
		if (list.Resource != "") != tagged || len(list.Conditions) == 0 {
			return ErrInvalid
		}
		bytes += len(list.Resource)
		for _, condition := range list.Conditions {
			count++
			bytes += len(condition.Token) + len(condition.ETag)
			if (condition.Token == "") == (condition.ETag == "") {
				return ErrInvalid
			}
		}
	}
	if count > MaxDAVConditions || bytes > MaxDAVConditionBytes {
		return ErrTooLarge
	}
	return nil
}

func (c DAVCondition) Equal(other DAVCondition) bool {
	if c.RequestPath != other.RequestPath || len(c.Lists) != len(other.Lists) {
		return false
	}
	for index, list := range c.Lists {
		if list.Resource != other.Lists[index].Resource || len(list.Conditions) != len(other.Lists[index].Conditions) {
			return false
		}
		for position, condition := range list.Conditions {
			if condition != other.Lists[index].Conditions[position] {
				return false
			}
		}
	}
	return true
}

// EvaluateDAVCondition 针对同一事务快照求值；成功后所有出现的令牌均视为已提交。
func EvaluateDAVCondition(entries []Entry, locks []WriteLock, condition DAVCondition, connectionID string, revision int64) (FileWriteAuthority, bool, error) {
	if err := condition.Validate(); err != nil {
		return FileWriteAuthority{}, false, err
	}
	authority := FileWriteAuthority{ConnectionID: connectionID, ConnectionRevision: revision}
	if len(condition.Lists) == 0 {
		return authority, true, nil
	}
	namespace, err := NewLockNamespace(entries)
	if err != nil {
		return FileWriteAuthority{}, false, err
	}
	matched := false
	for _, list := range condition.Lists {
		resource := list.Resource
		if resource == "" {
			resource = condition.RequestPath
		}
		id, mapped := namespace.Resolve(resource)
		listMatched := true
		for _, term := range list.Conditions {
			termMatched := false
			if term.Token != "" {
				authority.Tokens = append(authority.Tokens, term.Token)
				if mapped {
					for _, lock := range locks {
						root, ok := namespace.Resolve(lock.RootPath)
						if ok && term.Token == lock.Token() && lockCovers(namespace, root, id, lock.Depth) {
							termMatched = true
							break
						}
					}
				}
			} else if mapped && id != "" {
				entry := namespace.entries[id]
				termMatched = entry.ContentSHA != "" && strings.TrimPrefix(term.ETag, "W/") == strconv.Quote(entry.ContentSHA)
			}
			if term.Not {
				termMatched = !termMatched
			}
			listMatched = listMatched && termMatched
		}
		matched = matched || listMatched
	}
	return authority, matched, nil
}

// LockNamespace 为有界锁根解析建立一次目录索引，不构造所有原生目录路径。
type LockNamespace struct {
	entries  map[string]Entry
	children map[string]map[string]string
	ranges   map[string]lockInterval
}

type lockInterval struct{ start, end int }

func NewLockNamespace(entries []Entry) (*LockNamespace, error) {
	n := &LockNamespace{entries: make(map[string]Entry, len(entries)), children: make(map[string]map[string]string)}
	for _, entry := range entries {
		if entry.ID == "" {
			return nil, ErrInvalid
		}
		if _, exists := n.entries[entry.ID]; exists {
			return nil, ErrConflict
		}
		n.entries[entry.ID] = entry
		if entry.TrashedAt != nil {
			continue
		}
		if n.children[entry.ParentID] == nil {
			n.children[entry.ParentID] = make(map[string]string)
		}
		if _, exists := n.children[entry.ParentID][entry.NormalizedName]; exists {
			return nil, ErrConflict
		}
		n.children[entry.ParentID][entry.NormalizedName] = entry.ID
	}
	// 迭代DFS只访问根可达的可见目录，区间使后续祖先判断为O(1)，不被深原生目录放大。
	n.ranges = make(map[string]lockInterval, len(entries)+1)
	type visit struct {
		id   string
		exit bool
	}
	stack := []visit{{id: ""}}
	position := 0
	for len(stack) > 0 {
		current := stack[len(stack)-1]
		stack = stack[:len(stack)-1]
		if current.exit {
			interval := n.ranges[current.id]
			interval.end = position
			n.ranges[current.id] = interval
			continue
		}
		if _, exists := n.ranges[current.id]; exists {
			return nil, ErrConflict
		}
		n.ranges[current.id] = lockInterval{start: position}
		position++
		stack = append(stack, visit{id: current.id, exit: true})
		if current.id != "" && n.entries[current.id].Kind != Folder {
			continue
		}
		for _, child := range n.children[current.id] {
			stack = append(stack, visit{id: child})
		}
	}
	return n, nil
}

// Within 使用可见目录区间判断祖先关系；孤儿和环不进入可见命名空间。
func (n *LockNamespace) Within(root, id string) bool {
	parent, parentExists := n.ranges[root]
	member, memberExists := n.ranges[id]
	return parentExists && memberExists && member.start >= parent.start && member.start < parent.end
}

func (n *LockNamespace) visible(id string) bool {
	_, exists := n.ranges[id]
	return exists
}

func (n *LockNamespace) Resolve(rootPath string) (string, bool) {
	if rootPath == "/" {
		return "", true
	}
	if len(rootPath) > MaxWriteLockPathBytes || !strings.HasPrefix(rootPath, "/") || strings.HasSuffix(rootPath, "/") {
		return "", false
	}
	parts := strings.Split(rootPath[1:], "/")
	if len(parts) > MaxWriteLockPathDepth {
		return "", false
	}
	id := ""
	for _, part := range parts {
		if part == "" || part == "." || part == ".." {
			return "", false
		}
		if id != "" && n.entries[id].Kind != Folder {
			return "", false
		}
		var ok bool
		id, ok = n.children[id][part]
		if !ok {
			return "", false
		}
	}
	return id, n.visible(id)
}

// RootPath 仅在申请锁时构造受控路径，拒绝超出DAV预算的根。
func (n *LockNamespace) RootPath(id string) (string, error) {
	parts := []string{}
	for id != "" {
		if len(parts) >= MaxWriteLockPathDepth {
			return "", ErrTooLarge
		}
		entry, ok := n.entries[id]
		if !ok || entry.TrashedAt != nil || entry.NormalizedName == "" {
			return "", ErrMissing
		}
		parts = append(parts, entry.NormalizedName)
		id = entry.ParentID
	}
	for left, right := 0, len(parts)-1; left < right; left, right = left+1, right-1 {
		parts[left], parts[right] = parts[right], parts[left]
	}
	rootPath := "/" + strings.Join(parts, "/")
	if len(rootPath) > MaxWriteLockPathBytes {
		return "", ErrTooLarge
	}
	if _, ok := n.Resolve(rootPath); !ok {
		return "", ErrMissing
	}
	return rootPath, nil
}

func lockCovers(n *LockNamespace, root, id string, depth WriteLockDepth) bool {
	return (root == id && n.visible(id)) || (depth == WriteLockDepthInfinity && n.Within(root, id))
}

// CheckWriteLocks 验证所有变化的前后命名空间，返回成功后应清除的未映射URL锁。
// 调用方必须在持有同一owner事务时读取锁、调用本函数、保存条目及清理锁。
func CheckWriteLocks(entries, changed []Entry, locks []WriteLock, authority FileWriteAuthority) ([]string, error) {
	if len(locks) == 0 {
		return nil, nil
	}
	if len(locks) > MaxWriteLocksPerOwner {
		return nil, ErrTooLarge
	}
	before, err := NewLockNamespace(entries)
	if err != nil {
		return nil, err
	}
	merged := append([]Entry(nil), entries...)
	positions := make(map[string]int, len(entries))
	for index, entry := range entries {
		positions[entry.ID] = index
	}
	for _, entry := range changed {
		if index, ok := positions[entry.ID]; ok {
			merged[index] = entry
		} else {
			positions[entry.ID] = len(merged)
			merged = append(merged, entry)
		}
	}
	after, err := NewLockNamespace(merged)
	if err != nil {
		return nil, err
	}
	removed := []string{}
	for _, lock := range locks {
		oldRoot, oldMapped := before.Resolve(lock.RootPath)
		newRoot, newMapped := after.Resolve(lock.RootPath)
		if !newMapped {
			removed = append(removed, lock.ID)
		}
		if authority.Allows(lock) {
			continue
		}
		for _, entry := range changed {
			previous, existed := before.entries[entry.ID]
			namespaceChanged := !existed || previous.ParentID != entry.ParentID || previous.NormalizedName != entry.NormalizedName || previous.Name != entry.Name || (previous.TrashedAt == nil) != (entry.TrashedAt == nil)
			if oldMapped && existed && lockCovers(before, oldRoot, previous.ID, lock.Depth) {
				return nil, ErrWriteLocked
			}
			if newMapped && lockCovers(after, newRoot, entry.ID, lock.Depth) {
				return nil, ErrWriteLocked
			}
			if !namespaceChanged {
				continue
			}
			// Depth0文件夹锁也保护直接成员名称；移动祖先会移除原URL的后代锁。
			if oldMapped && existed && (lockCovers(before, oldRoot, previous.ParentID, lock.Depth) || before.Within(previous.ID, oldRoot)) {
				return nil, ErrWriteLocked
			}
			if newMapped && (lockCovers(after, newRoot, entry.ParentID, lock.Depth) || after.Within(entry.ID, newRoot)) {
				return nil, ErrWriteLocked
			}
		}
	}
	return removed, nil
}
