'use client';
import { useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { FileDocument } from '../../../src/files/runtime';
import type { FileDocumentProps } from '../../../src/files/pdf-contract';
/** PdfDialog 将关闭意图交给阅读器，确认未导出的批注后才卸载会话。 */
export function PdfDialog(props: Omit<FileDocumentProps, 'closeRequestSequence'>) {
  const { t } = useFrontendTranslation();
  const [sequence, setSequence] = useState(0);
  return (
    <DialogSurface
      isOpen
      size="cover"
      layout="workspace"
      triggerLabel={t('files.pdf.title')}
      title={props.entry.name}
      description={t('files.pdf.hint')}
      cancelLabel={t('files.close')}
      onOpenChange={(open) => {
        if (!open) setSequence((value) => value + 1);
      }}
    >
      <FileDocument {...props} closeRequestSequence={sequence} />
    </DialogSurface>
  );
}
