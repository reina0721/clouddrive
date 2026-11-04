import type { ReactNode } from 'react';
import type { FilesDestination } from '../../../src/files/model';
import { useFiles } from '../../../src/files/runtime';

/** FileLink 保留链接的原生行为，普通点击通过 Host 导航以保留进行中的上传。 */
export function FileLink({
  target,
  children,
  className,
  'aria-current': ariaCurrent,
}: Readonly<{
  target: FilesDestination;
  children: ReactNode;
  className?: string;
  'aria-current'?: 'page';
}>) {
  const port = useFiles();
  return (
    <a
      href={port.destinationHref(target)}
      className={className}
      aria-current={ariaCurrent}
      onClick={(event) => {
        if (
          event.button === 0 &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey &&
          !event.defaultPrevented
        ) {
          event.preventDefault();
          port.navigate(target);
        }
      }}
    >
      {children}
    </a>
  );
}
