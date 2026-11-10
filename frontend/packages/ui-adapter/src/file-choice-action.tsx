'use client';

import { Button as HeroButton } from '@heroui/react/button';
import type { ReactNode } from 'react';
import { FileTrigger } from 'react-aria-components/FileTrigger';
import { actionStyles } from './action-styles';

/** FileChoiceAction 通过同一按钮样式打开单文件选择，结果仅交给调用方。 */
export function FileChoiceAction({
  children,
  acceptedTypes,
  disabled = false,
  onSelect,
}: Readonly<{
  children: ReactNode;
  acceptedTypes: readonly string[];
  disabled?: boolean;
  onSelect: (file: File) => void;
}>) {
  return (
    <FileTrigger
      acceptedFileTypes={acceptedTypes}
      onSelect={(files) => {
        const file = files?.[0];
        if (file) onSelect(file);
      }}
    >
      <HeroButton
        className={actionStyles({ size: 'sm', variant: 'secondary' })}
        isDisabled={disabled}
        type="button"
        variant="ghost"
      >
        <span>{children}</span>
      </HeroButton>
    </FileTrigger>
  );
}
