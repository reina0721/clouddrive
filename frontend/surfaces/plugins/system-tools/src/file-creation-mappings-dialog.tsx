'use client';

import { useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { SelectField, TextField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import {
  fileApplicationName,
  maxFileCreationMappings,
  validFileCreationLabel,
  type FileApplicationItem,
  type FileCreationMapping,
} from '../../../src/files/file-applications';

export function FileCreationMappingsDialog({
  item,
  onClose,
  onApply,
}: {
  item: FileApplicationItem;
  onClose: () => void;
  onApply: (mappings: FileCreationMapping[]) => void;
}) {
  const { t, locale } = useFrontendTranslation();
  const chinese = locale.startsWith('zh');
  const app = fileApplicationName(item.id, chinese);
  const title = chinese ? `${app}的新建文件映射` : `New-file mappings for ${app}`;
  const [mappings, setMappings] = useState(() =>
    item.newFiles.map((mapping) => ({
      ...mapping,
      label: mapping.label || (item.id === 'markdown' ? 'Markdown' : chinese ? '文本' : 'Text'),
    })),
  );
  const nextExtension = item.extensions.find(
    (extension) => !mappings.some((mapping) => mapping.extension === extension),
  );
  function change(index: number, mapping: FileCreationMapping) {
    setMappings(mappings.map((current, position) => (position === index ? mapping : current)));
  }
  function move(index: number, destination: number) {
    const current = mappings[index],
      other = mappings[destination];
    if (!current || !other) return;
    const next = [...mappings];
    next[index] = other;
    next[destination] = current;
    setMappings(next);
  }
  return (
    <DialogSurface
      isOpen
      triggerLabel={title}
      title={title}
      description={
        chinese
          ? '映射按此顺序显示在文件工作区的新建菜单。清空列表可隐藏此应用的新建项。'
          : 'Mappings appear in this order in the New menu. An empty list hides this application’s creation entries.'
      }
      cancelLabel={t('files.cancel')}
      confirmLabel={chinese ? '应用到草稿' : 'Apply to draft'}
      confirmDisabled={mappings.some((mapping) => !validFileCreationLabel(mapping.label))}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onConfirm={() =>
        onApply(mappings.map((mapping) => ({ ...mapping, label: mapping.label.trim() })))
      }
    >
      <div className="space-y-4">
        {mappings.length === 0 ? (
          <p>{chinese ? '暂无新建文件映射。' : 'No new-file mappings.'}</p>
        ) : null}
        {mappings.map((mapping, index) => (
          <fieldset
            key={mapping.extension}
            className="min-w-0 space-y-2 rounded-control border border-border p-3"
          >
            <legend className="text-sm font-semibold">.{mapping.extension}</legend>
            <SelectField
              label={chinese ? '扩展名' : 'Extension'}
              value={mapping.extension}
              options={item.extensions
                .filter(
                  (extension) =>
                    extension === mapping.extension ||
                    !mappings.some((current) => current.extension === extension),
                )
                .map((extension) => ({ value: extension, label: `.${extension}` }))}
              onValueChange={(extension) => change(index, { ...mapping, extension })}
            />
            <TextField
              label={chinese ? '菜单名称' : 'Menu name'}
              value={mapping.label}
              {...(!validFileCreationLabel(mapping.label)
                ? { error: chinese ? '请输入有效的菜单名称。' : 'Enter a valid menu name.' }
                : {})}
              onChange={(event) => change(index, { ...mapping, label: event.target.value })}
            />
            <div className="flex flex-wrap gap-2">
              <Action
                variant="quiet"
                size="sm"
                disabled={index === 0}
                onPress={() => move(index, index - 1)}
              >
                {chinese ? '上移' : 'Move up'}
              </Action>
              <Action
                variant="quiet"
                size="sm"
                disabled={index === mappings.length - 1}
                onPress={() => move(index, index + 1)}
              >
                {chinese ? '下移' : 'Move down'}
              </Action>
              <Action
                variant="secondary"
                size="sm"
                onPress={() => setMappings(mappings.filter((_, position) => position !== index))}
              >
                {chinese ? '移除映射' : 'Remove mapping'}
              </Action>
            </div>
          </fieldset>
        ))}
        <Action
          variant="secondary"
          size="sm"
          disabled={!nextExtension || mappings.length >= maxFileCreationMappings}
          onPress={() => {
            if (nextExtension) setMappings([...mappings, { extension: nextExtension, label: '' }]);
          }}
        >
          {chinese ? '添加映射' : 'Add mapping'}
        </Action>
      </div>
    </DialogSurface>
  );
}
