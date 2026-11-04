import { pdfWorkerReadyKind } from '../protocol.js';
// 自有入口只确认上游module已加载；连接SDK前消费此消息，不触碰上游私有消息协议。
await import(new URL('../assets/pdf.worker.min.mjs', import.meta.url).href);
self.postMessage({ kind: pdfWorkerReadyKind });
