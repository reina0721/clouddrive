/** Stable component headings for the local index; locale changes do not change identity. */
export function previewAnchor(name: string): string {
  return (
    'element-' +
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  );
}
