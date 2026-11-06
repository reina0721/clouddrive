package httpbinding

import (
	"errors"
	"github.com/reina0721/clouddrive/pkg/logger"
	"net/http"
)

func (h *Handler) verifySessionPassword(w http.ResponseWriter, r *http.Request) {
	const maxVerificationBodyBytes = 2048
	r.Body = http.MaxBytesReader(w, r.Body, maxVerificationBodyBytes)
	var body struct {
		Password string `json:"password"`
	}
	if !decode(w, r, &body) {
		return
	}
	err := h.iam.VerifySessionPassword(r.Context(), current(r).ID, body.Password)
	if err != nil {
		// 当前账号已由会话确定；区分输错与失效，前端不能把输错当作退出登录。
		if errors.Is(err, ErrInvalidCredentials) {
			failure(w, http.StatusUnauthorized, "credentials", "")
		} else {
			problem(w, err)
		}
		if errors.Is(err, ErrInvalidCredentials) || errors.Is(err, ErrAccountLocked) || errors.Is(err, ErrSessionInvalid) || errors.Is(err, ErrInvalidPassword) || errors.Is(err, ErrAccountDisabled) {
			h.logger.Info("console.password.verify", logger.String("phase", "rejected"))
		} else {
			h.logger.Error("console.password.verify", logger.String("phase", "failed"))
		}
		return
	}
	h.logger.Info("console.password.verify")
	reply(w, struct {
		Verified bool `json:"verified"`
	}{Verified: true})
}
