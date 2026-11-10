type Range = Readonly<{ start: number; end: number }>;
export type MarkdownSnapshot = Readonly<{ text: string; range: Range }>;

export type MarkdownFormat =
  | 'headingOne'
  | 'heading'
  | 'bold'
  | 'emphasis'
  | 'strike'
  | 'inlineCode'
  | 'list'
  | 'ordered'
  | 'task'
  | 'quote'
  | 'code'
  | 'table'
  | 'rule';

const maxHistorySteps = 32;
const maxHistoryCharacters = 1024 * 1024;

export function rememberMarkdown(stack: readonly MarkdownSnapshot[], snapshot: MarkdownSnapshot) {
  let characters = snapshot.text.length;
  if (characters > maxHistoryCharacters) return [];
  const next = [snapshot];
  for (const previous of stack) {
    characters += previous.text.length;
    if (next.length >= maxHistorySteps || characters > maxHistoryCharacters) break;
    next.push(previous);
  }
  return next;
}

export function replaceMarkdown(text: string, range: Range, replacement: string): MarkdownSnapshot {
  const caret = range.start + replacement.length;
  return {
    text: text.slice(0, range.start) + replacement + text.slice(range.end),
    range: { start: caret, end: caret },
  };
}

function surroundMarkdown(text: string, range: Range, prefix: string, suffix: string) {
  const result = replaceMarkdown(text, range, prefix + text.slice(range.start, range.end) + suffix);
  return {
    ...result,
    range: { start: range.start + prefix.length, end: range.end + prefix.length },
  };
}

function selectedLines(text: string, range: Range) {
  const start = range.start === 0 ? 0 : text.lastIndexOf('\n', range.start - 1) + 1;
  const lastSelected =
    range.end > range.start && text[range.end - 1] === '\n' ? range.end - 1 : range.end;
  const lineEnd = text.indexOf('\n', lastSelected);
  return { start, end: lineEnd < 0 ? text.length : lineEnd };
}

function backticks(selected: string, minimum: number) {
  const longest = (selected.match(/\x60+/g) ?? []).reduce(
    (max, run) => Math.max(max, run.length),
    0,
  );
  return String.fromCharCode(96).repeat(Math.max(longest + 1, minimum));
}

function insertBlock(text: string, range: Range, block: string) {
  const before = text.slice(0, range.start);
  const after = text.slice(range.end);
  const prefix = !before || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const suffix = !after || after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
  return replaceMarkdown(text, range, prefix + block + suffix);
}

export function formatMarkdown(
  text: string,
  range: Range,
  format: MarkdownFormat,
  column: string,
): MarkdownSnapshot {
  switch (format) {
    case 'bold':
      return surroundMarkdown(text, range, '**', '**');
    case 'emphasis':
      return surroundMarkdown(text, range, '*', '*');
    case 'strike':
      return surroundMarkdown(text, range, '~~', '~~');
    case 'inlineCode': {
      const selected = text.slice(range.start, range.end);
      const fence = backticks(selected, 1);
      const pad = /^\x60|\x60$/.test(selected) || (/^ .* $/.test(selected) && /\S/.test(selected));
      return surroundMarkdown(text, range, fence + (pad ? ' ' : ''), (pad ? ' ' : '') + fence);
    }
    case 'rule':
      return insertBlock(text, range, '---');
    case 'table':
      return insertBlock(
        text,
        range,
        '| ' + column + ' 1 | ' + column + ' 2 |\n| --- | --- |\n|  |  |',
      );
    case 'code': {
      const lines = selectedLines(text, range);
      const selected = text.slice(lines.start, lines.end);
      const fence = backticks(selected, 3);
      return insertBlock(text, lines, fence + '\n' + selected + '\n' + fence);
    }
    default: {
      const lines = selectedLines(text, range);
      const original = text.slice(lines.start, lines.end);
      let number = 0;
      const replacement = original
        .split('\n')
        .map((line) => {
          if (original && !line.trim()) return line;
          switch (format) {
            case 'headingOne':
              return '# ' + line.replace(/^#{1,6} /, '');
            case 'heading':
              return '## ' + line.replace(/^#{1,6} /, '');
            case 'list':
              return '- ' + line;
            case 'ordered':
              return ++number + '. ' + line;
            case 'task':
              return '- [ ] ' + line;
            case 'quote':
              return '> ' + line;
          }
        })
        .join('\n');
      const result = replaceMarkdown(text, lines, replacement);
      return range.start === range.end
        ? result
        : { ...result, range: { start: lines.start, end: lines.start + replacement.length } };
    }
  }
}

export function markdownLabel(value: string) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('[', '\\[')
    .replaceAll(']', '\\]')
    .replace(/\r?\n/g, ' ');
}
