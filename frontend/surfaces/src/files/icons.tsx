import {
  Cloud,
  Folder,
  FileText,
  File,
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
  Info,
  X,
  Link,
} from 'lucide-react';
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
  Info,
  X,
};
export function FileGlyph({
  kind,
  mediaType,
  size = 'large',
  emoji,
  color,
}: Readonly<{
  kind: string;
  mediaType: string;
  size?: 'small' | 'large';
  emoji?: string | undefined;
  color?: string | undefined;
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
  const Icon =
    kind === 'folder'
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
                : File;
  return (
    <Icon
      aria-hidden="true"
      className={`${size === 'small' ? 'size-5' : 'size-12'} ${kind === 'folder' ? 'text-warning' : 'text-brand'}`}
      strokeWidth={1.5}
      style={kind === 'folder' && color ? { color } : undefined}
    />
  );
}
