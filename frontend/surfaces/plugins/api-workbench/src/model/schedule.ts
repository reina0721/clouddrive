/** The configuration UI accepts five-field cron and positive duration intervals. */
export function isValidSchedule(value: string): boolean {
  const input = value.trim();
  if (/^[1-9]\d*(ms|s|m|h|d)$/.test(input)) return true;
  const parts = input.split(/\s+/);
  const limits = [
    [0, 59],
    [0, 23],
    [1, 31],
    [1, 12],
    [0, 7],
  ] as const;
  return (
    parts.length === limits.length &&
    parts.every((part, index) => {
      const limit = limits[index];
      if (!limit) return false;
      return part.split(',').every((segment) => {
        if (!/^(\*|\d+(-\d+)?)(\/[1-9]\d*)?$/.test(segment)) return false;
        const [base, step] = segment.split('/');
        if (step && Number(step) > limit[1] + 1) return false;
        if (base === '*') return true;
        const [start, end = start] = (base ?? '').split('-').map(Number);
        return (
          start !== undefined &&
          end !== undefined &&
          start >= limit[0] &&
          end <= limit[1] &&
          start <= end
        );
      });
    })
  );
}
