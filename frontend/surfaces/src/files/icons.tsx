import {
  Cloud,
  Folder,
  FileText,
  File,
  FileCode,
  FileType,
  Sheet,
  Image,
  Film,
  Music,
  Home,
  Trash2,
  LayoutGrid,
  List,
  Upload,
  FolderPlus,
  Download,
  MoreHorizontal,
  Search,
  RefreshCw,
  Settings,
  ArrowUpDown,
  Menu,
  HardDrive,
  Package,
  Info,
  X,
  Link,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { fileIconImageAllowed, type FileIconRule } from './icon-rules';
export {
  Cloud,
  Home,
  Trash2,
  LayoutGrid,
  List,
  Upload,
  FolderPlus,
  Download,
  MoreHorizontal,
  Search,
  RefreshCw,
  Settings,
  ArrowUpDown,
  Menu,
  HardDrive,
  Package,
  Info,
  X,
};
const ruleIcons = {
  file: File,
  text: FileText,
  image: Image,
  video: Film,
  audio: Music,
  archive: Package,
  code: FileCode,
  pdf: FileType,
  spreadsheet: Sheet,
};

function RemoteFileGlyph({
  url,
  className,
  fallback,
}: {
  url: string;
  className: string;
  fallback: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return fallback;
  return (
    <img
      src={url}
      alt=""
      data-file-icon="image-url"
      className={className + ' object-contain'}
      crossOrigin="anonymous"
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export function FileGlyph({
  kind,
  mediaType,
  size = 'large',
  emoji,
  color,
  rule,
}: Readonly<{
  kind: string;
  mediaType: string;
  size?: 'small' | 'large';
  emoji?: string | undefined;
  color?: string | undefined;
  rule?: FileIconRule | undefined;
}>) {
  if (emoji)
    return (
      <span
        aria-hidden="true"
        className={`grid shrink-0 place-items-center overflow-hidden leading-none ${size === 'small' ? 'size-7 text-xl' : 'size-12 text-4xl'}`}
      >
        {emoji}
      </span>
    );
  const ruleShape = kind === 'file' && rule?.shape !== 'image-url' ? rule?.shape : undefined;
  const Icon =
    (ruleShape && ruleIcons[ruleShape]) ??
    (kind === 'folder'
      ? Folder
      : kind === 'shortcut'
        ? Link
        : mediaType.startsWith('image/')
          ? Image
          : mediaType.startsWith('video/')
            ? Film
            : mediaType.startsWith('audio/')
              ? Music
              : mediaType.startsWith('text/')
                ? FileText
                : File);
  const tint = ruleShape ? rule?.light : kind === 'folder' ? color : undefined;
  const darkTint = ruleShape ? rule?.dark : undefined;
  const className = size === 'small' ? 'size-5' : 'size-12';
  const glyph = (
    <Icon
      aria-hidden="true"
      data-file-icon={ruleShape}
      className={`${className} ${kind === 'folder' ? 'text-warning' : 'text-brand'}`}
      strokeWidth={1.5}
      style={tint ? { color: darkTint ? `light-dark(${tint}, ${darkTint})` : tint } : undefined}
    />
  );
  const url = kind === 'file' && rule?.shape === 'image-url' ? rule.imageUrl : undefined;
  return url && fileIconImageAllowed(url) ? (
    <RemoteFileGlyph key={url} url={url} className={className} fallback={glyph} />
  ) : (
    glyph
  );
}
