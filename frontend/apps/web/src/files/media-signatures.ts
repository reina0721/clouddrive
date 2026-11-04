/** rasterType 只接受已核验签名的栅格图像，不装载改名的SVG或HTML。 */
export async function rasterType(blob: Blob): Promise<string | undefined> {
  const header = new Uint8Array(await blob.slice(0, 32).arrayBuffer());
  const starts = (signature: readonly number[]) =>
    signature.every((value, index) => header[index] === value);
  const text = (start: number, end: number) => String.fromCharCode(...header.slice(start, end));
  if (starts([137, 80, 78, 71, 13, 10, 26, 10])) return 'image/png';
  if (starts([255, 216, 255])) return 'image/jpeg';
  if (text(0, 6) === 'GIF87a' || text(0, 6) === 'GIF89a') return 'image/gif';
  if (text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP') return 'image/webp';
  if (text(4, 8) === 'ftyp' && ['avif', 'avis'].some((brand) => text(8, 32).includes(brand)))
    return 'image/avif';
  return undefined;
}
