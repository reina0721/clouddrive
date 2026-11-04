// Package httpcatalog 聚合应用的无资源 HTTP 声明，供运行时与契约生成器共同消费。
// 此处禁止装配 Handler、读取配置或访问 Kernel，资源仍由应用组合根创建。
package httpcatalog

import (
	authhttp "github.com/reina0721/clouddrive/internal/module/auth/binding/http"
	fileshttp "github.com/reina0721/clouddrive/internal/module/files/binding/http"
	iamhttp "github.com/reina0721/clouddrive/internal/module/iam/binding/http"
	navigationhttp "github.com/reina0721/clouddrive/internal/module/navigation/binding/http"
	organizationhttp "github.com/reina0721/clouddrive/internal/module/organization/binding/http"
	todohttp "github.com/reina0721/clouddrive/internal/module/todo/binding/http"
	"github.com/reina0721/clouddrive/internal/transport/http/humabinding"
)

// Registrations 是当前应用 HTTP 模块选择的唯一静态清单，不持有运行期对象。
func Registrations() []humabinding.Registration {
	return []humabinding.Registration{
		fileshttp.HumaRegistration(nil, nil), authhttp.HumaRegistration(nil), iamhttp.HumaRegistration(nil),
		organizationhttp.HumaRegistration(nil, nil), navigationhttp.HumaRegistration(nil, nil), todohttp.HumaRegistration(nil),
	}
}
