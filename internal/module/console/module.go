// Package console 装配控制台协议投影及本模块的持久化实现。
package console

import (
	"context"
	httpbinding "github.com/reina0721/clouddrive/internal/module/console/binding/http"
	"github.com/reina0721/clouddrive/internal/module/console/repo"
	"github.com/reina0721/clouddrive/pkg/database"
	"github.com/reina0721/clouddrive/pkg/execution"
	"github.com/reina0721/clouddrive/pkg/logger"
	"net/http"
)

type Account = httpbinding.Account
type AccountDetail = httpbinding.AccountDetail
type AccountFilter = httpbinding.AccountFilter
type AccountList = httpbinding.AccountList
type AccountRoles = httpbinding.AccountRoles
type CoreRole = httpbinding.CoreRole
type CreateTodoRequest = httpbinding.CreateTodoRequest
type Dictionary = httpbinding.Dictionary
type DictionaryItem = httpbinding.DictionaryItem
type Event = httpbinding.Event
type ExecutedResponse = httpbinding.ExecutedResponse
type ExecutionFailure = httpbinding.ExecutionFailure
type ExecutionResult = httpbinding.ExecutionResult
type Handler = httpbinding.Handler
type IdentityAccess = httpbinding.IdentityAccess
type KeyValue = httpbinding.KeyValue
type ListTodosParams = httpbinding.ListTodosParams
type MFARequiredError = httpbinding.MFARequiredError
type NavigationMenu = httpbinding.NavigationMenu
type NavigationMenus = httpbinding.NavigationMenus
type NavigationOperations = httpbinding.NavigationOperations
type Notification = httpbinding.Notification
type RegistrationSettings = httpbinding.RegistrationSettings
type RelayPolicy = httpbinding.RelayPolicy
type RequestDefinition = httpbinding.RequestDefinition
type ResolvedRequest = httpbinding.ResolvedRequest
type Role = httpbinding.Role
type RoleDetail = httpbinding.RoleDetail
type RoleList = httpbinding.RoleList
type RolePermissions = httpbinding.RolePermissions
type RuntimeField = httpbinding.RuntimeField
type RuntimeMetadata = httpbinding.RuntimeMetadata
type Session = httpbinding.Session
type SessionIdentity = httpbinding.SessionIdentity
type SessionInfo = httpbinding.SessionInfo
type SessionList = httpbinding.SessionList
type TaskDefinition = httpbinding.TaskDefinition
type TaskRecord = httpbinding.TaskRecord
type Todo = httpbinding.Todo
type TodoList = httpbinding.TodoList
type TodoOperations = httpbinding.TodoOperations
type TodoStatus = httpbinding.TodoStatus
type User = httpbinding.User
type Workspace = httpbinding.Workspace
type WorkspaceRecord = httpbinding.WorkspaceRecord

var ErrInvalidCredentials = httpbinding.ErrInvalidCredentials
var ErrSessionInvalid = httpbinding.ErrSessionInvalid
var ErrMFAInvalidCode = httpbinding.ErrMFAInvalidCode
var ErrMFAChallengeInvalid = httpbinding.ErrMFAChallengeInvalid
var ErrRegistrationClosed = httpbinding.ErrRegistrationClosed
var ErrSetupClosed = httpbinding.ErrSetupClosed
var ErrPasswordReused = httpbinding.ErrPasswordReused
var ErrAccountDisabled = httpbinding.ErrAccountDisabled
var ErrAccountLocked = httpbinding.ErrAccountLocked
var ErrVersionConflict = httpbinding.ErrVersionConflict
var ErrOwnerInvariant = httpbinding.ErrOwnerInvariant
var ErrImmutableOwner = httpbinding.ErrImmutableOwner
var ErrInvalidUsername = httpbinding.ErrInvalidUsername
var ErrInvalidName = httpbinding.ErrInvalidName
var ErrInvalidPassword = httpbinding.ErrInvalidPassword
var ErrInvalidID = httpbinding.ErrInvalidID
var ErrUnknownPermission = httpbinding.ErrUnknownPermission
var ErrInvalidQuery = httpbinding.ErrInvalidQuery

const Prefix = httpbinding.Prefix
const NativePrefix = httpbinding.NativePrefix
const NativeTargetPrefix = httpbinding.NativeTargetPrefix
const SessionListActive = httpbinding.SessionListActive
const AccountActive = httpbinding.AccountActive

type Access interface {
	Use(context.Context, func(database.Client) error) error
	WithinTx(context.Context, func(context.Context, database.Client, database.Tx) error) error
}
type Dependencies struct {
	Runtime      func() RuntimeMetadata
	IAM          IdentityAccess
	CookieName   string
	Native       http.Handler
	Origins      []string
	Database     Access
	Logger       logger.Logger
	Relay        RelayPolicy
	Executor     execution.OperationExecutor
	Authenticate func(*http.Request) (*http.Request, error)
	Todos        TodoOperations
	Navigation   NavigationOperations
}

func New(dependencies Dependencies) (*Handler, error) {
	store, err := repo.New(dependencies.Database)
	if err != nil {
		return nil, err
	}
	return httpbinding.New(httpbinding.Dependencies{Data: store, IAM: dependencies.IAM, CookieName: dependencies.CookieName, Native: dependencies.Native, Origins: dependencies.Origins, Logger: dependencies.Logger, Relay: dependencies.Relay, Executor: dependencies.Executor, Authenticate: dependencies.Authenticate, Todos: dependencies.Todos, Navigation: dependencies.Navigation, Runtime: dependencies.Runtime})
}
func DefaultRelayPolicy() RelayPolicy { return httpbinding.DefaultRelayPolicy() }
func WithSession(r *http.Request, value Session) *http.Request {
	return httpbinding.WithSession(r, value)
}
func SessionFromContext(ctx context.Context) (string, Session, bool) {
	return httpbinding.SessionFromContext(ctx)
}
