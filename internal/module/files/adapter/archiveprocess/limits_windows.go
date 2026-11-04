//go:build windows

package archiveprocess

import (
	"errors"
	"unsafe"

	"golang.org/x/sys/windows"
)

type processGuard struct{ job windows.Handle }

func newProcessGuard(memory int64) (*processGuard, error) {
	job, err := windows.CreateJobObject(nil, nil)
	if err != nil {
		return nil, err
	}
	limits := windows.JOBOBJECT_EXTENDED_LIMIT_INFORMATION{}
	limits.BasicLimitInformation.LimitFlags = windows.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE | windows.JOB_OBJECT_LIMIT_PROCESS_MEMORY
	limits.ProcessMemoryLimit = uintptr(memory)
	if _, err := windows.SetInformationJobObject(job, windows.JobObjectExtendedLimitInformation, uintptr(unsafe.Pointer(&limits)), uint32(unsafe.Sizeof(limits))); err != nil {
		return nil, errors.Join(err, windows.CloseHandle(job))
	}
	return &processGuard{job}, nil
}
func (g *processGuard) Attach(pid int) error {
	process, err := windows.OpenProcess(windows.PROCESS_SET_QUOTA|windows.PROCESS_TERMINATE, false, uint32(pid))
	if err != nil {
		return err
	}
	return errors.Join(windows.AssignProcessToJobObject(g.job, process), windows.CloseHandle(process))
}
func (g *processGuard) Close() error { return windows.CloseHandle(g.job) }

// Windows限制由父进程在发送stdin前安装，子进程不重复更改全局资源。
func setWorkerMemory(_ int64) error { return nil }
