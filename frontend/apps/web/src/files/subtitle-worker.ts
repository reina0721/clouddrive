import { parse } from 'subsrt-ts';
import {
  subtitleLimits,
  type SubtitleCue,
  type SubtitleJob,
  type SubtitleWorkResult,
} from './subtitle-contract';

function convert({ bytes, format }: SubtitleJob): SubtitleWorkResult {
  if (bytes.byteLength > subtitleLimits.maxBytes) return { kind: 'large' };
  try {
    const input = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/\r\n?/g, '\n');
    if (input.includes('\0') || (format === 'vtt' && !/^WEBVTT(?:[\t \n]|$)/.test(input)))
      return { kind: 'unsupported' };
    const captions = parse(input, { format, eol: '\n', verbose: false });
    const cues: SubtitleCue[] = [];
    for (const caption of captions) {
      if (caption.type !== 'caption') continue;
      if (cues.length === subtitleLimits.maxCues) return { kind: 'large' };
      const { start, end, text } = caption;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start)
        return { kind: 'unsupported' };
      const cueText = text.trimEnd();
      if (cueText.trimStart()) cues.push({ startMs: start, endMs: end, text: cueText });
    }
    return cues.length ? { kind: 'cues', cues } : { kind: 'unsupported' };
  } catch {
    // 解析库的异常可能包含原始字幕；向主线程仅返回稳定分类。
    return { kind: 'unsupported' };
  }
}

const scope = self as unknown as Pick<Worker, 'addEventListener' | 'postMessage'>;
scope.addEventListener('message', (event: MessageEvent<SubtitleJob>) => {
  scope.postMessage(convert(event.data));
});
