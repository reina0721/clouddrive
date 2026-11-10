import {
  TextReader,
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipWriter,
} from '@zip.js/zip.js/index-native.js';

const container = `<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OPS/book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`;
const xhtml = (body: string) =>
  `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Chapter</title></head><body>${body}</body></html>`;

export async function epubFixture(mode: 'nav' | 'ncx' | 'spine' = 'nav', padding = 0) {
  const writer = new ZipWriter(new Uint8ArrayWriter(), { useWebWorkers: false });
  const toc =
    mode === 'nav'
      ? '<item id="nav" href="contents.xhtml" media-type="application/xhtml+xml" properties="nav"/>'
      : mode === 'ncx'
        ? '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>'
        : '';
  const packageFile = `<package xmlns="http://www.idpf.org/2007/opf" version="${mode === 'ncx' ? '2.0' : '3.0'}">
    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>测试电子书</dc:title><dc:creator>示例作者</dc:creator></metadata>
    <manifest>${toc}<item id="one" href="text/one.xhtml" media-type="application/xhtml+xml"/>
    <item id="two" href="text/two.xhtml" media-type="application/xhtml+xml"/>
    <item id="cover" href="images/cover.png" media-type="image/png"/>
    <item id="remote" href="https://epub.example.test/remote.png" media-type="image/png"/>
    </manifest><spine ${mode === 'ncx' ? 'toc="ncx"' : ''}><itemref idref="one"/><itemref idref="two"/></spine></package>`;
  const entries = {
    mimetype: 'application/epub+zip',
    'META-INF/container.xml': container,
    'OPS/book.opf': packageFile,
    'OPS/text/one.xhtml': xhtml(`<h1>第一章</h1><p>可阅读的正文 ${'x'.repeat(padding)}</p>
      <a href="#tail">章内跳转</a><a href="two.xhtml#topic">跨章跳转</a>
      <img src="../images/cover.png" alt="书内图片"/>
      <img src="https://epub.example.test/remote.png" alt="外部图片替代文字"/>
      <a href="https://epub.example.test/">外部链接文字</a>
      <script>window.epubScriptRan = true;</script><iframe src="https://epub.example.test/frame"/>
      ${Array.from(
        { length: 96 },
        (_, index) =>
          `<p>第 ${index + 1} 段。海风吹过码头，远处的灯塔在傍晚亮起。沿着石阶往上走，可以看到从海面归来的渔船。</p>`,
      ).join('')}<h2 id="tail">本章尾部</h2>`),
    'OPS/text/two.xhtml': xhtml('<h1 id="topic">第二章</h1><p>章节二内容</p>'),
    ...(mode === 'nav'
      ? {
          'OPS/contents.xhtml': xhtml(
            '<nav epub:type="toc"><ol><li><a href="text/one.xhtml">目录一</a></li><li><a href="text/two.xhtml#topic">目录二</a></li></ol></nav>',
          ),
        }
      : mode === 'ncx'
        ? {
            'OPS/toc.ncx':
              '<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd"><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/"><navMap><navPoint id="b"><navLabel><text>旧版目录&nbsp;</text></navLabel><content src="text/two.xhtml"/></navPoint></navMap></ncx>',
          }
        : {}),
  };
  for (const [name, content] of Object.entries(entries))
    await writer.add(name, new TextReader(content), { level: name === 'mimetype' ? 0 : 6 });
  const png = Uint8Array.from(
    atob(
      'iVBORw0KGgoAAAANSUhEUgAAAMAAAABgCAIAAADEouq+AAABJUlEQVR42u3YwQnAIBBFwa3IjiRWYrHeLCB3wRJykE0y8O6CDHzYKO2SHhe+QAAJIAEkgCSABJAAEkASQAJIAAkgCSABJIAEkPQqQPMeh8vzOkAAAQQQQAABBBBAAAEEEEAAAQQQQAABBBBAAAEEEEDfBlR7P1ye1wECCCATZsIAAggggAACCCCAAAIIIIAAAggggBwSHRIBAsiEmTCAAAIIIIAAAggggAACCCCAAAIIIIdEh0SAAALIhJkwgAACCCCAAAIIIIAAAggggAACCCCHRIdEgAAyYSYMIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCA9M8AEkACSAAJIAkgASSABJAEkAASQAJIAkgACSABJO0W35TXYgdSzxoAAAAASUVORK5CYII=',
    ),
    (byte) => byte.charCodeAt(0),
  );
  await writer.add('OPS/images/cover.png', new Uint8ArrayReader(png), { level: 0 });
  return (await writer.close()).slice().buffer;
}
