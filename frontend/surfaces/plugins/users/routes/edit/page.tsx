'use client';
import { useSearchParams } from 'next/navigation';
import { UserEditorPage } from '../../src/user-editor-page';
export default function EditUserRoute() {
  return <UserEditorPage id={useSearchParams().get('id') ?? ''} />;
}
