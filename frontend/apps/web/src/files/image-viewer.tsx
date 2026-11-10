'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import type { ImageSize } from './image-edit';
import { imageMetadataLimitMiB, readImageMetadata } from './image-metadata';
import type { ImageExifField } from './image-metadata.worker';

const zh = {
  info: '拍摄信息',
  dimensions: '分辨率',
  format: '格式',
  loading: '正在读取拍摄信息…',
  empty: '此图片没有可显示的 EXIF 信息。',
  large: `图片超过 ${imageMetadataLimitMiB} MiB，已跳过 EXIF 解析。`,
  unavailable: '无法读取拍摄信息。',
  retry: '重试读取',
  showLocation: '显示拍摄位置',
  hideLocation: '隐藏拍摄位置',
  make: '相机厂商',
  model: '相机型号',
  lens: '镜头',
  captured: '拍摄时间',
  orientation: '方向',
  aperture: '光圈',
  exposure: '曝光时间',
  iso: 'ISO',
  focalLength: '焦距',
  bias: '曝光补偿',
  flash: '闪光灯',
  artist: '作者',
  copyright: '版权',
  software: '软件',
};
const en: typeof zh = {
  info: 'Photo information',
  dimensions: 'Resolution',
  format: 'Format',
  loading: 'Reading photo information…',
  empty: 'This image has no EXIF information to display.',
  large: `EXIF reading was skipped because the image exceeds ${imageMetadataLimitMiB} MiB.`,
  unavailable: 'Could not read photo information.',
  retry: 'Retry reading',
  showLocation: 'Show capture location',
  hideLocation: 'Hide capture location',
  make: 'Camera manufacturer',
  model: 'Camera model',
  lens: 'Lens',
  captured: 'Taken at',
  orientation: 'Orientation',
  aperture: 'Aperture',
  exposure: 'Exposure time',
  iso: 'ISO',
  focalLength: 'Focal length',
  bias: 'Exposure compensation',
  flash: 'Flash',
  artist: 'Artist',
  copyright: 'Copyright',
  software: 'Software',
};

const photoAreaHeight = 'clamp(12rem, calc(100dvh - 26rem), 68dvh)';

function MetadataFields({ source, labels }: { source: Blob; labels: typeof zh }) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Awaited<ReturnType<typeof readImageMetadata>>>();
  const [locationVisible, setLocationVisible] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void readImageMetadata(source, controller.signal).then((response) => {
      if (!controller.signal.aborted) setResult(response);
    });
    return () => controller.abort();
  }, [source, attempt]);
  if (!result) return <p role="status">{labels.loading}</p>;
  if (result.state === 'large') return <p role="status">{labels.large}</p>;
  if (result.state !== 'ready')
    return (
      <>
        <p role="status">{labels.unavailable}</p>
        <Action
          size="sm"
          variant="quiet"
          onPress={() => {
            setResult(undefined);
            setAttempt((value) => value + 1);
          }}
        >
          {labels.retry}
        </Action>
      </>
    );
  const { fields, location } = result.metadata;
  const entries = Object.entries(fields) as [ImageExifField, string][];
  if (!entries.length && !location) return <p role="status">{labels.empty}</p>;
  return (
    <>
      {entries.length ? (
        <dl className="grid gap-2" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          {entries.map(([field, value]) => (
            <div key={field}>
              <dt className="text-ink-muted">{labels[field]}</dt>
              <dd dir="auto">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {location ? (
        <div className="space-y-2">
          <Action
            size="sm"
            variant="secondary"
            expanded={locationVisible}
            onPress={() => setLocationVisible((visible) => !visible)}
          >
            {locationVisible ? labels.hideLocation : labels.showLocation}
          </Action>
          {locationVisible ? (
            <p dir="ltr">
              {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

/** ImageViewer 将原件画布与按需拍摄信息并排，窄窗口会将信息移到画布下方。 */
export default function ImageViewer({
  source,
  size,
  editor,
  children,
}: {
  source: Blob;
  size?: ImageSize;
  editor?: ReactNode;
  children: ReactNode;
}) {
  const { locale } = useFrontendTranslation();
  const labels = locale.startsWith('zh') ? zh : en;
  const [open, setOpen] = useState(false);
  const infoId = useId();
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Action
          size="sm"
          variant="secondary"
          expanded={open}
          {...(open ? { controls: infoId } : {})}
          onPress={() => setOpen((value) => !value)}
        >
          {labels.info}
        </Action>
        {editor}
      </div>
      <div className="flex flex-wrap gap-2">
        <div
          className="flex min-w-0 items-center justify-center rounded-control"
          style={{
            flex: '5 1 28rem',
            height: photoAreaHeight,
            backgroundColor: 'var(--color-surface-inset)',
          }}
        >
          {children}
        </div>
        {open ? (
          <section
            id={infoId}
            aria-label={labels.info}
            className="min-w-0 space-y-2 rounded-control p-3 text-sm"
            style={{
              flex: '1 1 17rem',
              maxHeight: photoAreaHeight,
              overflow: 'auto',
              overflowWrap: 'anywhere',
              border: '1px solid var(--color-border)',
            }}
          >
            <h3 className="font-semibold">{labels.info}</h3>
            <dl className="space-y-2">
              {size ? (
                <div>
                  <dt className="text-ink-muted">{labels.dimensions}</dt>
                  <dd>
                    {size.width} × {size.height} px
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-ink-muted">{labels.format}</dt>
                <dd>{source.type.split('/')[1]?.toUpperCase()}</dd>
              </div>
            </dl>
            <MetadataFields source={source} labels={labels} />
          </section>
        ) : null}
      </div>
    </div>
  );
}
