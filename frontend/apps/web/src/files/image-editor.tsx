'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { FilesError } from '@clouddrive/surface/files';
import { Action } from '@clouddrive/ui-adapter/action';
import { CheckboxField, SelectField, TextField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import {
  Crop,
  FlipHorizontal2,
  FlipVertical2,
  Palette,
  Pencil,
  Redo2,
  RotateCcw,
  RotateCw,
  Scaling,
  SlidersHorizontal,
  Stamp,
  Undo2,
} from 'lucide-react';
import {
  centeredImageCrop,
  editableImageType,
  encodeImage,
  imageSizeLimit,
  originalImage,
  outputImageSize,
  turnImage,
  validImageCrop,
  validImageSize,
  type ImageCrop,
  type ImageEdit,
  type ImageFormat,
  type ImageSize,
} from './image-edit';
import type { ImageToolsProps } from './media-view';
import { ImageAnnotationWorkspace } from './image-annotation-workspace';
import { ImageAppearanceWorkspace, type ImageAppearanceTool } from './image-appearance-workspace';
import { ImageCanvas } from './image-canvas';
import { downloadBlob } from './native-download';

const zh = {
  title: '图片编辑器',
  canvas: '图片编辑画布',
  loading: '正在准备图片…',
  sizeLimit: `图片尺寸超出编辑上限。每边最多 ${imageSizeLimit.sidePixels} 像素，总像素最多 ${imageSizeLimit.totalPixels}。`,
  decodeFailed: '此浏览器无法准备图片编辑画布。',
  crop: '裁剪',
  transform: '旋转和翻转',
  resize: '调整尺寸',
  annotate: '图片标注',
  tone: '色彩微调',
  filters: '滤镜',
  watermark: '文字水印',
  applyCrop: '应用裁剪',
  applySize: '应用尺寸',
  cropHint: '拖动框选原图，或输入原图中的像素坐标。',
  left: '向左旋转',
  right: '向右旋转',
  horizontal: '水平翻转',
  vertical: '垂直翻转',
  x: '裁剪起点 X',
  y: '裁剪起点 Y',
  width: '宽度（像素）',
  height: '高度（像素）',
  aspect: '保持宽高比',
  undo: '撤销',
  redo: '重做',
  reset: '恢复原图',
  invalidCrop: '裁剪区域必须位于原图范围内。',
  invalidSize: '请输入编辑上限内的正整数宽高。',
  copySuffix: '编辑副本',
  copyName: '副本名称（不含扩展名）',
  format: '输出格式',
  download: '下载副本',
  queue: '上传副本到原文件夹',
  queued: '副本已加入上传队列，可在传输中心查看进度。',
  invalidName: '请输入有效的副本名称。',
  encodeFailed: '无法编码图片副本。',
  tooLarge: '图片副本超过允许的媒体字节上限。',
  downloadReady: '已交给浏览器下载副本。',
  queueFailed: '无法将副本加入上传队列。',
  applyBeforeSave: '应用当前裁剪或尺寸后即可保存副本。',
  finishAnnotationBeforeSave: '完成或取消当前标注后即可保存副本。',
  finishAppearanceBeforeSave: '应用或取消外观调整后即可保存副本。',
};
const en: typeof zh = {
  title: 'Image editor',
  canvas: 'Image editing canvas',
  loading: 'Preparing image…',
  sizeLimit: `This image exceeds the editor limit of ${imageSizeLimit.sidePixels} pixels per side and ${imageSizeLimit.totalPixels} total pixels.`,
  decodeFailed: 'This browser could not prepare the image editor.',
  crop: 'Crop',
  transform: 'Rotate and flip',
  resize: 'Resize',
  annotate: 'Annotate',
  tone: 'Finetune',
  filters: 'Filters',
  watermark: 'Text watermark',
  applyCrop: 'Apply crop',
  applySize: 'Apply size',
  cropHint: 'Drag on the source image or enter pixel coordinates.',
  left: 'Rotate left',
  right: 'Rotate right',
  horizontal: 'Flip horizontally',
  vertical: 'Flip vertically',
  x: 'Crop start X',
  y: 'Crop start Y',
  width: 'Width (pixels)',
  height: 'Height (pixels)',
  aspect: 'Keep aspect ratio',
  undo: 'Undo',
  redo: 'Redo',
  reset: 'Restore original',
  invalidCrop: 'The selection must fit within the source image.',
  invalidSize: 'Enter positive whole numbers within the editing limits.',
  copySuffix: 'edited copy',
  copyName: 'Copy name (without extension)',
  format: 'Output format',
  download: 'Download copy',
  queue: 'Upload copy to original folder',
  queued: 'Copy queued. Check the transfer center for progress.',
  invalidName: 'Enter a valid copy name.',
  encodeFailed: 'Could not encode the image copy.',
  tooLarge: 'The copy exceeds the media byte limit.',
  downloadReady: 'The browser is downloading the copy.',
  queueFailed: 'Could not queue the image copy.',
  applyBeforeSave: 'Apply the crop or resize before saving a copy.',
  finishAnnotationBeforeSave: 'Finish or cancel the current annotation before saving a copy.',
  finishAppearanceBeforeSave: 'Apply or cancel appearance changes before saving a copy.',
};
type Labels = typeof zh;
type Tool = 'transform' | 'crop' | 'resize' | 'annotate' | ImageAppearanceTool;
type ImageStatus = 'sizeLimit' | 'decodeFailed' | 'loading';
type EditorProps = ImageToolsProps &
  Readonly<{
    queueCopy: (file: File, parentId: string) => Promise<void>;
    onClose: () => void;
  }>;

const cropRatios = [
  { label: '1:1', ratio: 1 },
  { label: '4:3', ratio: 4 / 3 },
  { label: '16:9', ratio: 16 / 9 },
];
const cropFields = ['x', 'y', 'width', 'height'] as const;
const sizeFields = ['width', 'height'] as const;
const historyLimit = 24;
const fileNameLimit = 255;
const formats = [
  { value: 'image/png', label: 'PNG' },
  { value: 'image/jpeg', label: 'JPEG' },
];
const appearanceTools = [
  { name: 'tone', Icon: SlidersHorizontal },
  { name: 'filters', Icon: Palette },
  { name: 'watermark', Icon: Stamp },
] as const;

function isAppearanceTool(tool: Tool): tool is ImageAppearanceTool {
  return appearanceTools.some(({ name }) => name === tool);
}

function copyStem(name: string, suffix: string) {
  const stem = name.replace(/\.[^.]+$/, '') || name;
  return Array.from(stem + ' - ' + suffix)
    .slice(0, fileNameLimit - 4)
    .join('')
    .trimEnd();
}

function validCopyName(name: string) {
  return (
    Boolean(name) &&
    name !== '.' &&
    name !== '..' &&
    Array.from(name).length <= fileNameLimit &&
    !name.includes('/') &&
    !name.includes('\\') &&
    !Array.from(name).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  );
}

function CropWorkspace({
  bitmap,
  edit,
  labels,
  onApply,
  children,
}: Readonly<{
  bitmap: ImageBitmap;
  edit: ImageEdit;
  labels: Labels;
  onApply: (crop: ImageCrop) => void;
  children: ReactNode;
}>) {
  const [fields, setFields] = useState(() => cropInput(edit.crop));
  const crop = {
    x: Number(fields.x),
    y: Number(fields.y),
    width: Number(fields.width),
    height: Number(fields.height),
  };
  const valid =
    cropFields.every((field) => /^\d+$/.test(fields[field])) && validImageCrop(crop, bitmap);

  function cropInput(value: ImageCrop) {
    return {
      x: String(value.x),
      y: String(value.y),
      width: String(value.width),
      height: String(value.height),
    };
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <ImageCanvas
        bitmap={bitmap}
        edit={edit}
        labels={labels}
        selection={valid ? crop : edit.crop}
        onCrop={(next) => setFields(cropInput(next))}
      />
      <div className="min-w-0 space-y-3">
        <p className="text-xs text-ink-muted">{labels.cropHint}</p>
        <div className="flex flex-wrap items-end gap-2">
          {cropFields.map((field) => (
            <div key={field} className="w-32">
              <TextField
                label={labels[field]}
                inputMode="numeric"
                value={fields[field]}
                onChange={(event) => setFields({ ...fields, [field]: event.currentTarget.value })}
              />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {cropRatios.map(({ label, ratio }) => (
            <Action
              key={label}
              size="sm"
              variant="secondary"
              onPress={() => setFields(cropInput(centeredImageCrop(bitmap, ratio)))}
            >
              {label}
            </Action>
          ))}
          <Action size="sm" disabled={!valid} onPress={() => onApply(crop)}>
            {labels.applyCrop}
          </Action>
          {valid ? null : (
            <p role="alert" className="text-sm text-danger">
              {labels.invalidCrop}
            </p>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

function ResizeControls({
  size,
  labels,
  onApply,
}: Readonly<{
  size: ImageSize;
  labels: Labels;
  onApply: (size: ImageSize) => void;
}>) {
  const [fields, setFields] = useState({ width: String(size.width), height: String(size.height) });
  const [locked, setLocked] = useState(true);
  const dimensions = { width: Number(fields.width), height: Number(fields.height) };
  const valid =
    sizeFields.every((field) => /^\d+$/.test(fields[field])) && validImageSize(dimensions);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        {sizeFields.map((field) => (
          <div key={field} className="w-32">
            <TextField
              label={labels[field]}
              inputMode="numeric"
              value={fields[field]}
              onChange={(event) => {
                const value = event.currentTarget.value;
                const other = field === 'width' ? 'height' : 'width';
                const next = { ...fields, [field]: value };
                if (locked && /^\d+$/.test(value)) {
                  next[other] = String(
                    Math.max(1, Math.round((Number(value) * size[other]) / size[field])),
                  );
                }
                setFields(next);
              }}
            />
          </div>
        ))}
        <Action size="sm" disabled={!valid} onPress={() => onApply(dimensions)}>
          {labels.applySize}
        </Action>
      </div>
      <CheckboxField label={labels.aspect} checked={locked} onCheckedChange={setLocked} />
      {valid ? null : (
        <p role="alert" className="text-sm text-danger">
          {labels.invalidSize}
        </p>
      )}
    </div>
  );
}

function ImageWorkspace({
  bitmap,
  entry,
  parentId,
  source,
  maxBytes,
  queueCopy,
  labels,
}: Omit<EditorProps, 'size' | 'onClose'> &
  Readonly<{
    bitmap: ImageBitmap;
    labels: Labels;
  }>) {
  const { t } = useFrontendTranslation();
  const [original] = useState(() => originalImage(bitmap));
  const [history, setHistory] = useState({ edits: [original], index: 0 });
  const edit = history.edits[history.index] ?? original;
  const [tool, setTool] = useState<Tool>('transform');
  const [toolSession, setToolSession] = useState(0);
  const [format, setFormat] = useState<ImageFormat>(
    editableImageType(source.type) ? source.type : 'image/png',
  );
  const [name, setName] = useState(() => copyStem(entry.name, labels.copySuffix));
  const [feedback, setFeedback] = useState<{ message: string; failed: boolean }>();
  const [busy, setBusy] = useState<'download' | 'queue'>();
  const inProgress = useRef(false);
  const lifetime = useRef<AbortController>(null);

  useLayoutEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => controller.abort();
  }, []);

  function commit(next: ImageEdit) {
    setFeedback(undefined);
    setHistory(({ edits, index }) => {
      const current = edits[index];
      if (JSON.stringify(current) === JSON.stringify(next)) return { edits, index };
      const kept = edits.slice(Math.max(0, index - historyLimit + 1), index + 1);
      return { edits: [...kept, next], index: kept.length };
    });
  }

  function step(direction: -1 | 1) {
    setTool((current) =>
      current === 'annotate' || isAppearanceTool(current) ? current : 'transform',
    );
    setToolSession((session) => session + 1);
    setFeedback(undefined);
    setHistory(({ edits, index }) => ({
      edits,
      index: Math.max(0, Math.min(edits.length - 1, index + direction)),
    }));
  }

  const size = outputImageSize(edit);
  const filename = name.trim() + (format === 'image/png' ? '.png' : '.jpg');
  const validName = Boolean(name.trim()) && validCopyName(filename);
  const canSave = validName && tool !== 'crop' && tool !== 'resize';

  async function save(destination: 'download' | 'queue') {
    const signal = lifetime.current?.signal;
    if (!canSave || inProgress.current || !signal || signal.aborted) return;
    inProgress.current = true;
    setBusy(destination);
    setFeedback(undefined);
    let failure = labels.encodeFailed;
    try {
      const encoded = await encodeImage(bitmap, edit, format);
      if (signal.aborted) return;
      if (!encoded || encoded.type !== format) {
        setFeedback({ message: failure, failed: true });
        return;
      }
      if (encoded.size > maxBytes) {
        setFeedback({ message: labels.tooLarge, failed: true });
        return;
      }
      if (destination === 'download') {
        downloadBlob(encoded, filename);
      } else {
        failure = labels.queueFailed;
        await queueCopy(new File([encoded], filename, { type: format }), parentId);
      }
      if (!signal.aborted) {
        setFeedback({
          message: destination === 'queue' ? labels.queued : labels.downloadReady,
          failed: false,
        });
      }
    } catch (error) {
      if (!signal.aborted) {
        setFeedback({
          message: error instanceof FilesError ? t('files.errors.' + error.code) : failure,
          failed: true,
        });
      }
    } finally {
      inProgress.current = false;
      if (!signal.aborted) setBusy(undefined);
    }
  }

  const exportControls = (pending?: 'annotation' | 'appearance') => (
    <>
      <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
        <div className="w-full sm:w-52">
          <TextField
            label={labels.copyName}
            value={name}
            disabled={Boolean(busy)}
            {...(validName ? {} : { error: labels.invalidName })}
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </div>
        <div className="w-32">
          <SelectField
            label={labels.format}
            value={format}
            options={formats}
            disabled={Boolean(busy)}
            onValueChange={(value) => {
              if (editableImageType(value)) setFormat(value);
            }}
          />
        </div>
        <Action
          size="sm"
          variant="secondary"
          disabled={!canSave || Boolean(pending || busy)}
          loading={busy === 'download'}
          onPress={() => void save('download')}
        >
          {labels.download}
        </Action>
        <Action
          size="sm"
          disabled={!canSave || Boolean(pending || busy)}
          loading={busy === 'queue'}
          onPress={() => void save('queue')}
        >
          {labels.queue}
        </Action>
      </div>
      {pending ? (
        <p className="text-xs text-ink-muted">
          {pending === 'annotation'
            ? labels.finishAnnotationBeforeSave
            : labels.finishAppearanceBeforeSave}
        </p>
      ) : null}
      {tool === 'crop' || tool === 'resize' ? (
        <p className="text-xs text-ink-muted">{labels.applyBeforeSave}</p>
      ) : null}
      {feedback ? (
        <p
          role={feedback.failed ? 'alert' : 'status'}
          className={feedback.failed ? 'text-sm text-danger' : 'text-sm text-ink-muted'}
        >
          {feedback.message}
        </p>
      ) : null}
    </>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Action
            size="sm"
            variant="secondary"
            leadingIcon={<Undo2 />}
            disabled={!history.index}
            onPress={() => step(-1)}
          >
            {labels.undo}
          </Action>
          <Action
            size="sm"
            variant="secondary"
            leadingIcon={<Redo2 />}
            disabled={history.index === history.edits.length - 1}
            onPress={() => step(1)}
          >
            {labels.redo}
          </Action>
          <Action
            size="sm"
            variant="quiet"
            disabled={edit === original}
            onPress={() => {
              commit(original);
              setTool('transform');
            }}
          >
            {labels.reset}
          </Action>
        </div>
        <p className="text-sm text-ink-muted">
          {size.width} × {size.height} px
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Action
          size="sm"
          variant={tool === 'transform' ? 'primary' : 'secondary'}
          leadingIcon={<RotateCw />}
          onPress={() => setTool('transform')}
        >
          {labels.transform}
        </Action>
        <Action
          size="sm"
          variant={tool === 'crop' ? 'primary' : 'secondary'}
          leadingIcon={<Crop />}
          onPress={() => setTool('crop')}
        >
          {labels.crop}
        </Action>
        <Action
          size="sm"
          variant={tool === 'resize' ? 'primary' : 'secondary'}
          leadingIcon={<Scaling />}
          onPress={() => setTool('resize')}
        >
          {labels.resize}
        </Action>
        <Action
          size="sm"
          variant={tool === 'annotate' ? 'primary' : 'secondary'}
          leadingIcon={<Pencil />}
          onPress={() => setTool('annotate')}
        >
          {labels.annotate}
        </Action>
        {appearanceTools.map(({ name, Icon }) => (
          <Action
            key={name}
            size="sm"
            variant={tool === name ? 'primary' : 'secondary'}
            leadingIcon={<Icon />}
            onPress={() => setTool(name)}
          >
            {labels[name]}
          </Action>
        ))}
      </div>
      {tool === 'crop' ? (
        <CropWorkspace
          bitmap={bitmap}
          edit={edit}
          labels={labels}
          onApply={(crop) => {
            commit({
              crop,
              turns: edit.turns,
              flipX: edit.flipX,
              flipY: edit.flipY,
              annotations: edit.annotations,
              appearance: edit.appearance,
            });
            setTool('transform');
          }}
        >
          {exportControls()}
        </CropWorkspace>
      ) : tool === 'annotate' ? (
        <ImageAnnotationWorkspace
          key={toolSession}
          bitmap={bitmap}
          edit={edit}
          canvasLabels={labels}
          chinese={labels === zh}
          onCommit={commit}
        >
          {(pending) => exportControls(pending ? 'annotation' : undefined)}
        </ImageAnnotationWorkspace>
      ) : isAppearanceTool(tool) ? (
        <ImageAppearanceWorkspace
          key={toolSession}
          bitmap={bitmap}
          edit={edit}
          canvasLabels={labels}
          chinese={labels === zh}
          tool={tool}
          onCommit={commit}
        >
          {(pending) => exportControls(pending ? 'appearance' : undefined)}
        </ImageAppearanceWorkspace>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <ImageCanvas bitmap={bitmap} edit={edit} labels={labels} />
          <div className="min-w-0 space-y-3">
            {tool === 'resize' ? (
              <ResizeControls
                key={size.width + ':' + size.height}
                size={size}
                labels={labels}
                onApply={(resize) => {
                  commit({ ...edit, resize });
                  setTool('transform');
                }}
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                <Action
                  size="sm"
                  variant="secondary"
                  leadingIcon={<RotateCcw />}
                  onPress={() => commit(turnImage(edit, -1))}
                >
                  {labels.left}
                </Action>
                <Action
                  size="sm"
                  variant="secondary"
                  leadingIcon={<RotateCw />}
                  onPress={() => commit(turnImage(edit, 1))}
                >
                  {labels.right}
                </Action>
                <Action
                  size="sm"
                  variant="secondary"
                  leadingIcon={<FlipHorizontal2 />}
                  onPress={() => commit({ ...edit, flipX: !edit.flipX })}
                >
                  {labels.horizontal}
                </Action>
                <Action
                  size="sm"
                  variant="secondary"
                  leadingIcon={<FlipVertical2 />}
                  onPress={() => commit({ ...edit, flipY: !edit.flipY })}
                >
                  {labels.vertical}
                </Action>
              </div>
            )}
            {exportControls()}
          </div>
        </div>
      )}
    </div>
  );
}

export function ImageEditor({ onClose, size, ...props }: EditorProps) {
  const { locale, t } = useFrontendTranslation();
  const labels = locale.startsWith('zh') ? zh : en;
  const { source } = props;
  const [result, setResult] = useState<{ bitmap: ImageBitmap } | { failure: ImageStatus }>();
  const supportedSize = validImageSize(size);

  useEffect(() => {
    if (!supportedSize) return;
    const controller = new AbortController();
    let owned: ImageBitmap | undefined;
    void (async () => {
      try {
        const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });
        if (controller.signal.aborted || !validImageSize(bitmap)) {
          bitmap.close();
          if (!controller.signal.aborted) setResult({ failure: 'sizeLimit' });
          return;
        }
        owned = bitmap;
        setResult({ bitmap });
      } catch {
        if (!controller.signal.aborted) setResult({ failure: 'decodeFailed' });
      }
    })();
    return () => {
      controller.abort();
      owned?.close();
    };
  }, [source, supportedSize]);

  const status = !supportedSize
    ? 'sizeLimit'
    : result && 'failure' in result
      ? result.failure
      : 'loading';
  return (
    <DialogSurface
      triggerLabel={labels.title}
      title={labels.title}
      description={props.entry.name}
      cancelLabel={t('files.close')}
      size="cover"
      layout="workspace"
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {result && 'bitmap' in result ? (
        <ImageWorkspace {...props} bitmap={result.bitmap} labels={labels} />
      ) : (
        <p role={status === 'loading' ? 'status' : 'alert'} className="text-sm text-ink-muted">
          {labels[status]}
        </p>
      )}
    </DialogSurface>
  );
}
