import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { openReadingFixtureFolder } from './reading-fixture';

type Tag = readonly [id: number, type: number, count: number, value: Buffer];
const ascii = (id: number, text: string): Tag => [
  id,
  2,
  text.length + 1,
  Buffer.from(text + '\0', 'ascii'),
];
function short(id: number, number: number): Tag {
  const value = Buffer.alloc(2);
  value.writeUInt16LE(number);
  return [id, 3, 1, value];
}
function rational(id: number, values: readonly (readonly [number, number])[], signed = false): Tag {
  const value = Buffer.alloc(values.length * 8);
  for (const [index, [numerator, denominator]] of values.entries()) {
    value.writeInt32LE(numerator, index * 8);
    value.writeInt32LE(denominator, index * 8 + 4);
  }
  return [id, signed ? 10 : 5, values.length, value];
}
const directoryBytes = (tagCount: number) => 2 + tagCount * 12 + 4;

// 在真实浏览器编码的 JPEG 内插入合成 EXIF APP1。定位为测试数字，不来自实际照片。
function photoWithExif(jpeg: Buffer) {
  const primary = [
    ascii(0x010f, 'Example Camera Co.'),
    ascii(0x0110, 'Example R2'),
    short(0x0112, 1),
    ascii(0x0131, 'Fixture Studio'),
    ascii(0x013b, 'Fixture Artist'),
    ascii(0x8298, 'Fixture Copyright'),
  ];
  const exif = [
    rational(0x829a, [[1, 125]]),
    rational(0x829d, [[28, 10]]),
    short(0x8827, 400),
    ascii(0x9003, '2026:03:20 14:15:16'),
    rational(0x9204, [[-1, 3]], true),
    short(0x9209, 1),
    rational(0x920a, [[35, 1]]),
    ascii(0xa434, 'Example 35 mm'),
  ];
  const gps = [
    ascii(1, 'S'),
    rational(2, [
      [12, 1],
      [30, 1],
      [0, 1],
    ]),
    ascii(3, 'W'),
    rational(4, [
      [45, 1],
      [15, 1],
      [0, 1],
    ]),
  ];
  const tiff = Buffer.alloc(1024);
  const primaryOffset = 8;
  const exifOffset = primaryOffset + directoryBytes(primary.length + 2);
  const gpsOffset = exifOffset + directoryBytes(exif.length);
  let dataOffset = gpsOffset + directoryBytes(gps.length);
  tiff.write('II');
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(primaryOffset, 4);
  function writeDirectory(offset: number, tags: Tag[]) {
    tiff.writeUInt16LE(tags.length, offset);
    for (const [index, [id, type, count, value]] of tags.entries()) {
      const start = offset + 2 + index * 12;
      tiff.writeUInt16LE(id, start);
      tiff.writeUInt16LE(type, start + 2);
      tiff.writeUInt32LE(count, start + 4);
      if (value.length <= 4) value.copy(tiff, start + 8);
      else {
        tiff.writeUInt32LE(dataOffset, start + 8);
        value.copy(tiff, dataOffset);
        dataOffset += value.length;
      }
    }
  }
  const pointer = (id: number, offset: number): Tag => {
    const value = Buffer.alloc(4);
    value.writeUInt32LE(offset);
    return [id, 4, 1, value];
  };
  writeDirectory(primaryOffset, [
    ...primary,
    pointer(0x8769, exifOffset),
    pointer(0x8825, gpsOffset),
  ]);
  writeDirectory(exifOffset, exif);
  writeDirectory(gpsOffset, gps);
  const header = Buffer.alloc(4);
  header.writeUInt16BE(0xffe1);
  header.writeUInt16BE(dataOffset + 8, 2);
  return Buffer.concat([
    jpeg.subarray(0, 2),
    header,
    Buffer.from('Exif\0\0'),
    tiff.subarray(0, dataOffset),
    jpeg.subarray(2),
  ]);
}

test('同目录切图、真实 EXIF、定位隐私和窄屏照片查看', async ({ page }, info) => {
  test.setTimeout(120_000);
  const access = process.env.CLOUDDRIVE_FILE_TEST_ACCESS;
  test.skip(!access, '使用隔离文件预览。');
  const account = JSON.parse((await readFile(access!, 'utf8')).replace(/^\uFEFF/, '')) as {
    username: string;
    password: string;
    url: string;
  };
  expect(new URL(account.url).origin).toBe('http://127.0.0.1:4194');
  await page.goto('/login?returnTo=%2Fhome');
  await page.getByLabel('邮箱', { exact: true }).fill(account.username);
  await page.getByLabel('密码', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  await openReadingFixtureFolder(page, '照片验收-');
  await page.getByRole('button', { name: '视图', exact: true }).click();
  await page.getByRole('menuitem', { name: '列表', exact: true }).click();
  const [jpeg, png] = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const paint = canvas.getContext('2d');
    if (!paint) throw new Error('无法生成合成照片');
    const fill = paint.createLinearGradient(0, 0, canvas.width, canvas.height);
    fill.addColorStop(0, '#314765');
    fill.addColorStop(1, '#e09758');
    paint.fillStyle = fill;
    paint.fillRect(0, 0, canvas.width, canvas.height);
    const photo = canvas.toDataURL('image/jpeg').split(',')[1]!;
    canvas.width = 180;
    canvas.height = 260;
    paint.fillStyle = '#396674';
    paint.fillRect(0, 0, canvas.width, canvas.height);
    return [photo, canvas.toDataURL('image/png').split(',')[1]!] as const;
  });
  const source = photoWithExif(Buffer.from(jpeg, 'base64'));
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '新建', exact: true }).click();
  await page.getByRole('menuitem', { name: '上传文件', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '使用此位置', exact: true }).click();
  await (
    await chooser
  ).setFiles([
    { name: '01-photo.jpg', mimeType: 'image/jpeg', buffer: source },
    { name: '02-note.txt', mimeType: 'text/plain', buffer: Buffer.from('Skipped between photos') },
    { name: '03-portrait.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') },
  ]);
  const tray = page.getByRole('dialog', { name: '上传队列', exact: true });
  await expect(tray.getByText('上传完成', { exact: true })).toHaveCount(3);
  await tray.getByRole('button', { name: '关闭', exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: '01-photo.jpg', exact: true }).click();

  const photo = page.getByRole('dialog', { name: '01-photo.jpg', exact: true });
  const image = photo.getByRole('img', { name: '01-photo.jpg' });
  await expect(image).toBeVisible();
  expect((await image.boundingBox())?.width).toBeGreaterThan(850);
  const navigation = photo.getByRole('group', { name: '照片导航' });
  await expect(navigation.getByRole('status')).toHaveText('1 / 2');
  await expect(navigation.getByRole('button', { name: '上一张' })).toBeDisabled();
  const toggle = photo.getByRole('button', { name: '拍摄信息', exact: true });
  const metadata = photo.getByRole('region', { name: '拍摄信息' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(metadata).toHaveCount(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(metadata.getByText('320 × 240 px', { exact: true })).toBeVisible();
  await expect(metadata.getByText('JPEG', { exact: true })).toBeVisible();
  await expect(metadata.getByText('Example Camera Co.', { exact: true })).toBeVisible();
  expect((await metadata.boundingBox())!.x).toBeGreaterThan((await image.boundingBox())!.x);
  for (const [label, value] of [
    ['相机型号', /Example R2/],
    ['镜头', /Example 35 mm/],
    ['拍摄时间', /2026.*14:15:16/],
    ['方向', /top|horizontal/i],
    ['光圈', /2\.8/],
    ['曝光时间', /1\/125/],
    ['ISO', /400/],
    ['焦距', /35/],
    ['曝光补偿', /-0\.3|−0\.3|-1\/3/],
    ['闪光灯', /fired/i],
    ['作者', /Fixture Artist/],
    ['版权', /Fixture Copyright/],
    ['软件', /Fixture Studio/],
  ] as const) {
    await expect(
      metadata
        .locator('div')
        .filter({ has: page.getByText(label, { exact: true }) })
        .locator('dd'),
    ).toHaveText(value);
  }
  const coordinate = metadata.getByText('-12.500000, -45.250000', { exact: true });
  await expect(coordinate).toHaveCount(0);
  await metadata.getByRole('button', { name: '显示拍摄位置' }).click();
  await expect(coordinate).toBeVisible();
  await metadata.getByRole('button', { name: '隐藏拍摄位置' }).click();
  await expect(coordinate).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('photo-desktop.png') });
  await toggle.click();
  await expect(metadata).toHaveCount(0);
  const next = navigation.getByRole('button', { name: '下一张' });
  await next.click();
  const portrait = page.getByRole('dialog', { name: '03-portrait.png', exact: true });
  await expect(portrait.getByRole('img', { name: '03-portrait.png' })).toBeVisible();
  await expect(portrait.getByRole('status')).toHaveText('2 / 2');
  await expect(portrait.getByRole('button', { name: '下一张' })).toBeDisabled();
  const previous = portrait.getByRole('button', { name: '上一张' });
  await previous.press('ArrowLeft');
  await expect(photo.getByRole('img', { name: '01-photo.jpg' })).toBeVisible();
  const pending = page.waitForEvent('download');
  await photo.getByRole('button', { name: '下载', exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe('01-photo.jpg');
  expect(await readFile(await download.path())).toEqual(source);
  await photo.getByRole('button', { name: '编辑图片' }).click();
  const editor = page.getByRole('dialog', { name: '图片编辑器', exact: true });
  await expect(editor.getByLabel('图片编辑画布')).toBeVisible();
  await editor.getByRole('button', { name: '关闭', exact: true }).click();
  await next.click();
  await previous.click();
  await expect(photo.getByRole('img', { name: '01-photo.jpg' })).toBeVisible();
  await toggle.click();
  await metadata.getByRole('button', { name: '显示拍摄位置' }).click();
  await expect(coordinate).toBeVisible();
  await page.setViewportSize({ width: 375, height: 760 });
  await next.click();
  await expect(portrait.getByRole('region', { name: '拍摄信息' })).toHaveCount(0);
  await portrait.getByRole('button', { name: '拍摄信息' }).click();
  const plain = portrait.getByRole('region', { name: '拍摄信息' });
  await expect(plain.getByText('180 × 260 px', { exact: true })).toBeVisible();
  await expect(plain.getByText('PNG', { exact: true })).toBeVisible();
  await expect(plain.getByText('此图片没有可显示的 EXIF 信息。')).toBeVisible();
  await expect(plain.getByText('Example Camera Co.')).toHaveCount(0);
  await expect(plain.getByRole('button', { name: '显示拍摄位置' })).toHaveCount(0);
  expect((await plain.boundingBox())!.width).toBeLessThan(375);
  await plain.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('photo-mobile.png') });
  await portrait.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(portrait).toHaveCount(0);
});
