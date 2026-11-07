'use client';
import { BackendOnly } from '../../../../src/administration/resource-state';
import { FilesystemSettingsPage } from '../../src/filesystem-settings-page';

export default function Route() {
  return (
    <BackendOnly>
      <FilesystemSettingsPage />
    </BackendOnly>
  );
}
