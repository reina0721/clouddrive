'use client';

import { BusyIndicator } from '@clouddrive/ui-adapter/busy-indicator';
import { PageLoadingSurface } from '@clouddrive/surface-foundation/states-operations';

export function AppLoadingSurface({ label }: Readonly<{ label: string }>) {
  return (
    <main
      id="main-content"
      aria-busy="true"
      aria-label={label}
      className="grid min-h-screen content-center bg-canvas p-6 text-ink"
    >
      <div className="mx-auto w-full max-w-md">
        <div className="mb-5 flex items-center gap-3" role="status">
          <BusyIndicator label={label} />
          <span className="text-sm font-semibold text-ink-muted">{label}</span>
        </div>
        <PageLoadingSurface kind="page" label={label} />
      </div>
    </main>
  );
}
