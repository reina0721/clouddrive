'use client';
import { useSearchParams } from 'next/navigation';
import { RoleEditorPage } from '../../src/role-editor-page';
export default function EditRoleRoute() {
  return <RoleEditorPage id={useSearchParams().get('id') ?? ''} />;
}
