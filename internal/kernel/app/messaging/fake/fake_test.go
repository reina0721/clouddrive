package fake

import (
	"context"
	"testing"
	"time"

	messagingapp "github.com/reina0721/clouddrive/internal/kernel/app/messaging"
	pkgclock "github.com/reina0721/clouddrive/pkg/clock"
	pkgmessaging "github.com/reina0721/clouddrive/pkg/messaging"
)

func TestFactoryKeepsTwoNamedProvidersIsolated(t *testing.T) {
	factory := New()
	dependencies := messagingapp.ProviderDependencies{Clock: pkgclock.Fixed(time.Date(2026, 8, 20, 1, 2, 3, 0, time.UTC))}
	for _, name := range []string{"primary", "secondary"} {
		provider, err := factory.Build(t.Context(), name, messagingapp.ProviderConfig{Driver: messagingapp.DriverFake}, dependencies)
		if err != nil {
			t.Fatal(err)
		}
		if err := provider.Bind(nil); err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { _ = provider.Close(context.Background()) })
	}
	contract, err := pkgmessaging.DefineContract(pkgmessaging.ContractSpec{
		ID: "orders.created", Version: 1, ContentType: "application/json", MaxPayloadBytes: 1024,
		Fingerprint: "sha256:orders-created-v1",
	})
	if err != nil {
		t.Fatal(err)
	}
	message, err := pkgmessaging.NewMessage(pkgmessaging.MessageSpec{
		ID: "message-42", Contract: contract.Ref(), OccurredAt: time.Now(), Payload: []byte(`{}`),
	})
	if err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"primary", "secondary"} {
		provider, err := factory.provider(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := provider.Publish(t.Context(), messagingapp.Route{}, message); err != nil {
			t.Fatal(err)
		}
	}
	primary, err := factory.Published("primary")
	if err != nil {
		t.Fatal(err)
	}
	secondary, err := factory.Published("secondary")
	if err != nil {
		t.Fatal(err)
	}
	if len(primary) != 1 || len(secondary) != 1 {
		t.Fatalf("published primary=%d secondary=%d", len(primary), len(secondary))
	}
}
