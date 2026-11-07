export const subtitleFormats = ['vtt', 'srt', 'ass'] as const;
export type SubtitleFormat = (typeof subtitleFormats)[number];

export const subtitleLimits = {
  maxBytes: 256 * 1024,
  maxCues: 5000,
  maxCandidates: 200,
  parseTimeoutMs: 3000,
} as const;

export type SubtitleCue = Readonly<{ startMs: number; endMs: number; text: string }>;
export type SubtitleJob = Readonly<{ bytes: ArrayBuffer; format: SubtitleFormat }>;
export type SubtitleWorkResult =
  Readonly<{ kind: 'cues'; cues: SubtitleCue[] }> | Readonly<{ kind: 'unsupported' | 'large' }>;

export function subtitleFormat(name: string): SubtitleFormat | undefined {
  const extension = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  return name.includes('.') ? subtitleFormats.find((format) => format === extension) : undefined;
}
