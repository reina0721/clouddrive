'use client';

import { useFrontendTranslation } from '@clouddrive/i18n';

/**
 * 水印层（Host Shell 表现）。
 *
 * 边界：
 * - 纯视觉提示，`aria-hidden` 且 `pointer-events: none`，不拦截交互、不进入可访问树；
 * - 不承诺防篡改（客户端可移除），因此文案不宣称安全性，只降低截图外传的误用；
 * - 文本由当前账号与可选自定义说明组成，不写死任何业务标识。
 */
export function WatermarkOverlay({
  identity,
  detail,
}: Readonly<{ identity: string; detail?: string }>) {
  const { t } = useFrontendTranslation();
  const tiles = Array.from({ length: 12 }, (_, index) => index);
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-sticky grid select-none place-items-center overflow-hidden text-ink opacity-5"
      data-shell-watermark
    >
      <div className="grid h-full w-full -rotate-12 scale-150 grid-cols-3 gap-6">
        {tiles.map((tile) => (
          <span
            className="flex flex-col gap-1 text-xs leading-5 font-semibold whitespace-nowrap"
            key={tile}
          >
            <span>{identity}</span>
            {detail ? <span className="font-normal">{detail}</span> : null}
          </span>
        ))}
      </div>
      <span className="sr-only">{t('shell.watermark.description')}</span>
    </div>
  );
}
