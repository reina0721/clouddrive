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
}: Readonly<{ kind: string; mediaType: string; size?: 'small' | 'large' }>) {
  const Icon =
    kind === 'folder'
      ? Folder
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
    />
  );
}
