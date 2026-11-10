'use client';

import { indentMore, indentWithTab, redo, undo } from '@codemirror/commands';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { gotoLine, openSearchPanel } from '@codemirror/search';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { CheckboxField, SelectField } from '@clouddrive/ui-adapter/form-field';
import { tags } from '@lezer/highlight';
import { basicSetup } from 'codemirror';
import { useEffect, useEffectEvent, useRef, useState } from 'react';

const zh = {
  language: '语言',
  auto: '自动',
  plain: '纯文本',
  undo: '撤销',
  redo: '重做',
  indent: '增加缩进',
  search: '查找与替换',
  go: '跳转到行',
  wrap: '自动折行',
  languageError: '无法加载所选语言的高亮。',
  position: (line: number, column: number) => `第 ${line} 行，第 ${column} 列`,
};
const en: typeof zh = {
  language: 'Language',
  auto: 'Auto',
  plain: 'Plain text',
  undo: 'Undo',
  redo: 'Redo',
  indent: 'Increase indent',
  search: 'Find and replace',
  go: 'Go to line',
  wrap: 'Wrap lines',
  languageError: 'Highlighting for the selected language could not be loaded.',
  position: (line, column) => `Line ${line}, column ${column}`,
};
const chinesePhrases = EditorState.phrases.of({
  Find: '查找',
  Replace: '替换',
  next: '下一个',
  previous: '上一个',
  all: '全部',
  'match case': '区分大小写',
  regexp: '正则表达式',
  'by word': '全词匹配',
  replace: '替换当前',
  'replace all': '全部替换',
  close: '关闭查找',
  'Go to line': '跳转到行',
  go: '跳转',
  'Fold line': '折叠',
  'Unfold line': '展开',
});

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    color: 'var(--color-ink)',
    backgroundColor: 'var(--color-surface)',
  },
  '&.cm-focused': { outline: '2px solid var(--color-focus-ring)', outlineOffset: '-2px' },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'var(--font-mono, monospace)',
    lineHeight: '1.65',
  },
  '.cm-content': { paddingBlock: '0.5rem', caretColor: 'var(--color-ink)' },
  '.cm-gutters, .cm-panels': {
    backgroundColor: 'var(--color-surface-muted)',
    color: 'var(--color-ink-muted)',
    borderColor: 'var(--color-border)',
  },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'var(--color-brand-soft)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'color-mix(in srgb, var(--color-brand) 23%, transparent)',
  },
  '.cm-panel input, .cm-panel button': {
    color: 'var(--color-ink)',
    backgroundColor: 'var(--color-surface)',
    borderColor: 'var(--color-border)',
  },
  '.cm-panel.cm-search': {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.25rem',
    padding: '0.375rem 1.75rem 0.375rem 0.375rem',
  },
  '.cm-panel.cm-search input[type="text"]': { maxWidth: '100%' },
});
const highlighting = syntaxHighlighting(
  HighlightStyle.define([
    {
      tag: [tags.keyword, tags.operatorKeyword],
      color: 'var(--color-brand-strong)',
      fontWeight: '600',
    },
    {
      tag: [tags.string, tags.regexp, tags.special(tags.string)],
      color: 'var(--color-danger)',
    },
    { tag: [tags.number, tags.bool, tags.atom, tags.typeName], color: 'var(--color-info)' },
    { tag: tags.comment, color: 'var(--color-ink-muted)' },
  ]),
);

const auto = 'auto';
const plain = 'plain';
const languageOptions = languages.filter((language) =>
  [
    'C',
    'C++',
    'CSS',
    'Go',
    'HTML',
    'Java',
    'JavaScript',
    'JSON',
    'Markdown',
    'PHP',
    'Python',
    'Rust',
    'Shell',
    'SQL',
    'TypeScript',
    'XML',
    'YAML',
  ].includes(language.name),
);

export default function CodeEditor({
  label,
  fileName,
  text,
  onChange,
  readOnly,
  disabled,
}: {
  label: string;
  fileName: string;
  text: string;
  onChange: (text: string) => void;
  readOnly: boolean;
  disabled: boolean;
}) {
  const { locale } = useFrontendTranslation();
  const chinese = locale.startsWith('zh');
  const labels = chinese ? zh : en;
  const host = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView>(null);
  const [initial] = useState(text);
  const [mode, setMode] = useState(auto);
  const [wrapped, setWrapped] = useState(false);
  const [position, setPosition] = useState({ line: 1, column: 1 });
  const [failedMode, setFailedMode] = useState<string>();
  const [settings] = useState(() => ({
    language: new Compartment(),
    wrap: new Compartment(),
    write: new Compartment(),
    accessibility: new Compartment(),
  }));
  const extension = fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase();
  const detected =
    languages.find((language) => language.filename?.test(fileName)) ??
    languages.find((language) => language.extensions.includes(extension));
  const selected = mode === auto ? detected : languages.find((language) => language.name === mode);
  const publish = useEffectEvent(onChange);

  useEffect(() => {
    if (!host.current) return;
    const view = new EditorView({
      parent: host.current,
      doc: initial,
      extensions: [
        basicSetup,
        editorTheme,
        highlighting,
        settings.language.of([]),
        settings.wrap.of([]),
        settings.write.of([]),
        settings.accessibility.of([]),
        keymap.of([indentWithTab]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) publish(update.state.doc.toString());
          if (update.docChanged || update.selectionSet) {
            const head = update.state.selection.main.head;
            const line = update.state.doc.lineAt(head);
            setPosition({ line: line.number, column: head - line.from + 1 });
          }
        }),
      ],
    });
    viewRef.current = view;
    return () => {
      viewRef.current = null;
      view.destroy();
    };
  }, [initial, settings]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: settings.accessibility.reconfigure([
        ...(chinese ? [chinesePhrases] : []),
        EditorView.contentAttributes.of({ 'aria-label': label, spellcheck: 'false' }),
      ]),
    });
  }, [chinese, label, settings]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    let active = true;
    view.dispatch({ effects: settings.language.reconfigure([]) });
    if (selected) {
      void selected.load().then(
        (support) => {
          if (active) {
            view.dispatch({ effects: settings.language.reconfigure(support) });
            setFailedMode(undefined);
          }
        },
        () => {
          if (active) setFailedMode(selected.name);
        },
      );
    }
    return () => {
      active = false;
    };
  }, [selected, settings]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: [
        settings.wrap.reconfigure(wrapped ? EditorView.lineWrapping : []),
        settings.write.reconfigure([
          EditorState.readOnly.of(readOnly || disabled),
          EditorView.editable.of(!readOnly && !disabled),
        ]),
      ],
    });
  }, [settings, wrapped, readOnly, disabled]);

  function command(run: (view: EditorView) => boolean, focus = false) {
    const view = viewRef.current;
    if (view) {
      if (focus) view.focus();
      run(view);
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <SelectField
          label={labels.language}
          presentation="toolbar"
          value={mode}
          onValueChange={setMode}
          options={[
            { value: auto, label: detected ? `${labels.auto} · ${detected.name}` : labels.auto },
            { value: plain, label: labels.plain },
            ...languageOptions.map((language) => ({ value: language.name, label: language.name })),
          ]}
        />
        {!readOnly ? (
          <>
            <Action
              size="sm"
              variant="quiet"
              disabled={disabled}
              onPress={() => command(undo, true)}
            >
              {labels.undo}
            </Action>
            <Action
              size="sm"
              variant="quiet"
              disabled={disabled}
              onPress={() => command(redo, true)}
            >
              {labels.redo}
            </Action>
            <Action
              size="sm"
              variant="quiet"
              disabled={disabled}
              onPress={() => command(indentMore, true)}
            >
              {labels.indent}
            </Action>
          </>
        ) : null}
        <Action size="sm" variant="secondary" onPress={() => command(openSearchPanel)}>
          {labels.search}
        </Action>
        <Action size="sm" variant="quiet" onPress={() => command(gotoLine)}>
          {labels.go}
        </Action>
        <div className="shrink-0">
          <CheckboxField label={labels.wrap} checked={wrapped} onCheckedChange={setWrapped} />
        </div>
      </div>
      {selected && failedMode === selected.name ? (
        <p role="status" className="text-sm text-danger">
          {labels.languageError}
        </p>
      ) : null}
      <div
        className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-control border border-border"
        ref={host}
      />
      <p className="text-xs text-ink-muted">{labels.position(position.line, position.column)}</p>
    </div>
  );
}
