import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function verifyGoFormat(root) {
  const paths = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  }).split('\0').filter((path) => path.endsWith('.go') && existsSync(resolve(root, path)));
  const failures = [];
  for (const path of new Set(paths)) {
    const output = execFileSync('gofmt', ['-l', path], { cwd: root, encoding: 'utf8' });
    if (output.trim()) failures.push(path);
  }
  if (failures.length) throw new Error('Go 文件格式不符合 gofmt：\n' + failures.join('\n'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    verifyGoFormat(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
    console.log('Go source formatting passed.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
