/* core: helpers, lazy loading, saving, AI bridge, and the generic tool screen */
(function(){
"use strict";
const PK = window.PK = { tools: [], cur: null, files: [], busy: false, result: null };
const $ = PK.$ = id => document.getElementById(id);
const app = () => $('app');

PK.cats = [
  ['org',  'จัดระเบียบ', '#d9480f'],
  ['opt',  'ปรับแต่ง', '#15803d'],
  ['to',   'แปลงเป็น PDF', '#b45309'],
  ['from', 'แปลงจาก PDF', '#be185d'],
  ['edit', 'แก้ไข', '#4338ca'],
  ['sec',  'ความปลอดภัย', '#0e7490'],
  ['ai',   'AI ช่วยอ่าน', '#7c3aed'],
  ['more', 'เพิ่มเติม', '#475569']
];
const svg = PK.svg = d => '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
PK.icons = {
  doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  merge: '<rect x="3" y="3" width="8" height="10" rx="1.5"/><rect x="13" y="11" width="8" height="10" rx="1.5"/><path d="M7 17v2h3M17 7V5h-3"/>',
  split: '<rect x="3" y="4" width="7" height="16" rx="1.5"/><rect x="14" y="4" width="7" height="16" rx="1.5"/><path d="M12 2v20" stroke-dasharray="2 3"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  squeeze: '<path d="M12 3v6M9 6l3 3 3-3M12 21v-6M9 18l3-3 3 3M4 12h16"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 16l-5-5-8 8"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  wrench: '<path d="M14.5 6.5a4 4 0 0 0-5.2 5.2L3 18l3 3 6.3-6.3a4 4 0 0 0 5.2-5.2l-2.7 2.7-2.3-.7-.7-2.3z"/>',
  text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
  rotate: '<path d="M20 12a8 8 0 1 1-2.5-5.8M20 4v5h-5"/>',
  hash: '<path d="M9 4L7 20M17 4l-2 16M4 9h16M3 15h16"/>',
  drop: '<path d="M12 3s6 6.2 6 10.5A6 6 0 0 1 6 13.5C6 9.2 12 3 12 3z"/>',
  crop: '<path d="M7 3v14h14M3 7h14v14"/>',
  pen: '<path d="M4 20l1-4L16 5l3 3L8 19zM14 7l3 3"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  unlock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>',
  sign: '<path d="M3 17c3-6 5-9 6-8s-2 7 0 7 3-4 5-4 1 3 3 3 2-1 4-1M3 21h18"/>',
  block: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M6 10h12v4H6z" fill="currentColor"/>',
  compare: '<rect x="3" y="4" width="7" height="16" rx="1.5"/><rect x="14" y="4" width="7" height="16" rx="1.5"/><path d="M10.5 9h3M10.5 15h3"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.500 0 18M12 3c-3 3.5-3 14.500 0 18"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/>',
  slides: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v4M8 20h8"/>',
  form: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h4"/>',
  code: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13 5l-2 14"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  check: '<path d="M5 12.5l4.500 4.500L19 7.500"/>',
  go: '<path d="M9 6l6 6-6 6"/>'
};
PK.add = def => { PK.tools.push(def); };

/* ---------- small helpers ---------- */
PK.esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
PK.fmtSize = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(0) + ' KB' : (n / 1048576).toFixed(2) + ' MB';
PK.baseName = f => (f.name || '').replace(/\.[^.]+$/, '') || 'ไฟล์';
PK.tick = () => new Promise(r => setTimeout(r, 0));
PK.pad = n => String(n).padStart(3, '0');
PK.val = id => { const e = $(id); return e ? e.value : ''; };
PK.on = id => { const e = $(id); return !!(e && e.checked); };
PK.E = msg => new Error(msg);
const esc = PK.esc;

const LIBS = {
  xlsx: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  mammoth: 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',
  html2canvas: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  pptx: 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js',
  qpdf: 'qpdf.js',
  qpdfwasm: 'qpdf-wasm.js'
};
const loading = {};
PK.load = name => loading[name] || (loading[name] = new Promise((res, rej) => {
  const s = document.createElement('script'); s.src = LIBS[name];
  s.onload = () => res();
  s.onerror = () => { delete loading[name]; rej(PK.E('โหลดส่วนประกอบไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองใหม่')); };
  document.head.appendChild(s);
}));
PK.needLibs = () => { if (!window.PDFLib || !window.pdfjsLib || !window.JSZip) throw PK.E('โหลดส่วนประกอบไม่ครบ ตรวจอินเทอร์เน็ตแล้วเปิดหน้านี้ใหม่'); };
if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

/* ---------- PDF helpers ---------- */
PK.bytes = async f => new Uint8Array(await f.arrayBuffer());
PK.openLib = async (file) => {
  const buf = await file.arrayBuffer();
  try { return await PDFLib.PDFDocument.load(buf); }
  catch (e) {
    if (/encrypt/i.test((e && e.message) || '')) throw PK.E('ไฟล์ "' + file.name + '" ตั้งรหัสไว้ ใช้เมนู "ปลดล็อก PDF" ก่อน แล้วนำไฟล์ที่ได้มาทำต่อ');
    throw PK.E('เปิดไฟล์ "' + file.name + '" ไม่ได้ ไฟล์อาจเสียหาย ลองเมนู "ซ่อมแซม PDF"');
  }
};
PK.openJs = async (file, password) => {
  const data = file instanceof Uint8Array ? file.slice() : await PK.bytes(file);
  try { return await pdfjsLib.getDocument({ data, password: password || undefined }).promise; }
  catch (e) {
    if (e && e.name === 'PasswordException') { const er = PK.E(password ? 'รหัสผ่านไม่ถูกต้อง' : 'ไฟล์นี้ตั้งรหัสผ่านไว้ ใช้เมนู "ปลดล็อก PDF" ก่อน'); er.needPassword = true; throw er; }
    throw PK.E('เปิดไฟล์' + (file.name ? ' "' + file.name + '"' : '') + ' ไม่ได้ ไฟล์อาจเสียหายหรือไม่ใช่ PDF');
  }
};
PK.renderPage = async (pdf, n, scale, maxPx) => {
  const page = await pdf.getPage(n);
  const v1 = page.getViewport({ scale: 1 });
  let s = scale; const big = Math.max(v1.width, v1.height) * s;
  if (maxPx && big > maxPx) s = s * maxPx / big;
  const vp = page.getViewport({ scale: s });
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(vp.width)); c.height = Math.max(1, Math.round(vp.height));
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return { canvas: c, w: v1.width, h: v1.height, page, scale: s };
};
PK.toBlob = (canvas, type, q) => new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(PK.E('สร้างรูปไม่สำเร็จ หน่วยความจำอาจไม่พอ ลองไฟล์ที่เล็กลง')), type, q));
PK.free = c => { c.width = 0; c.height = 0; };
PK.pdfBlob = bytes => new Blob([bytes], { type: 'application/pdf' });
PK.parseRanges = (str, n) => {
  const out = []; const parts = String(str).replace(/\s+/g, '').split(',').filter(Boolean);
  if (!parts.length) throw PK.E('พิมพ์เลขหน้าก่อน เช่น 1-3, 5');
  for (const p of parts) {
    const m = p.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) throw PK.E('อ่าน "' + p + '" ไม่ออก ใช้รูปแบบ 1-3, 5, 8-10');
    const a = +m[1], b = m[2] ? +m[2] : a;
    if (a < 1 || b < 1 || a > n || b > n) throw PK.E('ไฟล์นี้มี ' + n + ' หน้า แต่ระบุหน้า ' + p);
    const step = a <= b ? 1 : -1;
    for (let i = a; step > 0 ? i <= b : i >= b; i += step) out.push(i - 1);
  }
  return out;
};
PK.loadImage = async file => {
  if (window.createImageBitmap) {
    try { const bm = await createImageBitmap(file, { imageOrientation: 'from-image' }); return { el: bm, w: bm.width, h: bm.height, close: () => bm.close && bm.close() }; } catch (e) { /* fall through */ }
  }
  return new Promise((res, rej) => {
    const u = URL.createObjectURL(file); const im = new Image();
    im.onload = () => res({ el: im, w: im.naturalWidth, h: im.naturalHeight, close: () => URL.revokeObjectURL(u) });
    im.onerror = () => { URL.revokeObjectURL(u); rej(PK.E('เปิดรูป "' + (file.name || '') + '" ไม่ได้ ลองบันทึกเป็น JPG หรือ PNG ก่อน')); };
    im.src = u;
  });
};
/* rasterise a whole PDF into a new image-only PDF; fx(ctx,canvas) can post-process each page */
PK.rasterPdf = async (pdf, prog, opt) => {
  const o = Object.assign({ scale: 1.5, q: 0.7, max: 3200, label: 'กำลังประมวลผลหน้า' }, opt || {});
  const out = o.doc || await PDFLib.PDFDocument.create(); const n = pdf.numPages;
  for (let i = 1; i <= n; i++) {
    prog && prog(o.label + ' ' + i + ' จาก ' + n, (i - 1) / n);
    const r = await PK.renderPage(pdf, i, o.scale, o.max);
    if (o.fx) o.fx(r.canvas.getContext('2d'), r.canvas);
    const b = await PK.toBlob(r.canvas, 'image/jpeg', o.q); PK.free(r.canvas); r.page.cleanup();
    const img = await out.embedJpg(await b.arrayBuffer());
    out.addPage([r.w, r.h]).drawImage(img, { x: 0, y: 0, width: r.w, height: r.h });
    await PK.tick();
  }
  return out;
};
/* text of one page as lines in reading order (view coordinates, y down) */
PK.pageLines = async page => {
  const vp = page.getViewport({ scale: 1 });
  const tc = await page.getTextContent();
  const items = [];
  for (const it of tc.items) {
    if (!it.str || !it.str.trim()) continue;
    const p = vp.convertToViewportPoint(it.transform[4], it.transform[5]);
    const h = it.height || Math.hypot(it.transform[2], it.transform[3]) || 10;
    items.push({ str: it.str, x: p[0], y: p[1], w: it.width || 0, h });
  }
  items.sort((a, b) => a.y - b.y || a.x - b.x);
  const lines = [];
  for (const it of items) {
    const L = lines[lines.length - 1];
    if (L && Math.abs(it.y - L.y) < Math.max(L.h, it.h) * 0.5) { L.items.push(it); L.h = Math.max(L.h, it.h); }
    else lines.push({ y: it.y, h: it.h, items: [it] });
  }
  for (const L of lines) {
    L.items.sort((a, b) => a.x - b.x);
    let t = '', end = null;
    for (const it of L.items) {
      if (end !== null && it.x - end > L.h * 0.28 && !/\s$/.test(t) && !/^\s/.test(it.str)) t += ' ';
      t += it.str; end = it.x + it.w;
    }
    L.text = t.replace(/\s+/g, ' ').trim(); L.x = L.items[0].x;
  }
  return { lines: lines.filter(l => l.text), w: vp.width, h: vp.height };
};
const thai = c => c >= '฀' && c <= '๿';
PK.joinLines = (a, b) => (thai(a.slice(-1)) && thai(b[0])) ? a + b : a + ' ' + b;
/* group lines into paragraphs: [{text,size}] */
PK.paragraphs = pl => {
  const out = []; let cur = null, prev = null;
  for (const L of pl.lines) {
    const gap = prev ? L.y - prev.y : 0;
    if (cur && gap > 0 && gap < prev.h * 1.75 && Math.abs(L.h - prev.h) < 1.5) cur.text = PK.joinLines(cur.text, L.text);
    else { cur = { text: L.text, size: L.h }; out.push(cur); }
    prev = L;
  }
  return out;
};
PK.docText = async (file, prog, maxPages) => {
  const pdf = await PK.openJs(file); const n = Math.min(pdf.numPages, maxPages || 9999); const pages = [];
  for (let i = 1; i <= n; i++) {
    prog && prog('กำลังอ่านข้อความหน้า ' + i + ' จาก ' + n, (i - 1) / n * 0.5);
    const p = await pdf.getPage(i); const pl = await PK.pageLines(p); p.cleanup();
    pages.push(pl); if (i % 5 === 0) await PK.tick();
  }
  const total = pdf.numPages; pdf.destroy();
  const text = pages.map(p => PK.paragraphs(p).map(x => x.text).join('\n')).join('\n\n');
  return { pages, text, total, read: n };
};
PK.noText = 'ไฟล์นี้ไม่มีข้อความให้อ่าน น่าจะเป็นไฟล์สแกน ใช้เมนู "OCR อ่านข้อความจากภาพ" ก่อน';

/* ---------- qpdf (encryption, repair) ---------- */
let qbin = null;
PK.qpdf = async (args, inBytes) => {
  let mod;
  try {
    await PK.load('qpdf'); await PK.load('qpdfwasm');
    if (!qbin) { const s = atob(window.QPDF_WASM_B64); qbin = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) qbin[i] = s.charCodeAt(i); }
    let log = '';
    mod = await window.Module({ wasmBinary: qbin.slice().buffer, print: () => {}, printErr: s => { log += s + '\n'; } });
    mod.FS.writeFile('/in.pdf', inBytes);
    try { mod.callMain(args.concat(['/in.pdf', '/out.pdf'])); } catch (e) { /* exit codes surface as throws */ }
    let out = null; try { out = mod.FS.readFile('/out.pdf'); } catch (e) { /* no output */ }
    if (!out || !out.length) { const er = PK.E(log || 'qpdf failed'); er.qpdfLog = log; throw er; }
    return out;
  } catch (e) {
    if (e.qpdfLog !== undefined) throw e;
    const er = PK.E('เครื่องมือนี้เปิดไม่ได้ในเบราว์เซอร์นี้'); er.noEngine = true; throw er;
  }
};

/* ---------- saving ---------- */
const use = name => (window.claude && typeof window.claude.use === 'function') ? window.claude.use(name).catch(() => null) : Promise.resolve(null);
let dlP = null;
PK.saveFile = async (name, blob) => {
  if (!dlP) dlP = use('downloads');
  const dl = await dlP;
  if (dl) {
    try { await dl.save({ filename: name, data: blob }); return 'saved'; }
    catch (e) {
      if (e && e.code === 'declined') return 'declined';
      if (e && e.code === 'rate_limited') throw PK.E('มีหน้าต่างบันทึกเปิดค้างอยู่ รอสักครู่แล้วกดใหม่');
      if (e && e.code === 'too_large') throw PK.E('ไฟล์ใหญ่เกินกว่าที่บันทึกได้');
      if (e && (e.code === 'rejected_extension' || e.code === 'extension_not_enabled')) throw PK.E('หน้านี้บันทึกไฟล์ชนิดนี้ไม่ได้');
    }
  }
  const a = document.createElement('a'); const u = URL.createObjectURL(blob);
  a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 60000);
  return 'tried';
};

/* ---------- AI bridge ---------- */
let aiP = null;
const AIERR = {
  not_granted: 'ยังไม่ได้อนุญาตให้หน้านี้ใช้ Claude จึงใช้เมนู AI ไม่ได้',
  sampling_disabled: 'บัญชีนี้ใช้ Claude จากหน้านี้ไม่ได้',
  rate_limited: 'ใช้งานถี่เกินไปหรือโควตาเต็ม รอสักครู่แล้วลองใหม่',
  prompt_too_large: 'เอกสารยาวเกินไป ลองแยกไฟล์ให้สั้นลงก่อน',
  refused: 'Claude ไม่สามารถทำคำขอนี้ได้',
  session_expired: 'ต้องเข้าสู่ระบบ Claude ใหม่',
  images_unavailable: 'หน้านี้ยังส่งรูปให้ Claude ไม่ได้',
  image_rejected: 'รูปของหน้านี้ส่งให้ Claude ไม่ได้',
  cancelled: 'ยกเลิกแล้ว'
};
PK.ai = async (input, opts) => {
  if (!aiP) aiP = use('sample');
  const s = await aiP;
  if (!s) throw PK.E('เมนู AI ใช้ได้เมื่อเปิดหน้านี้ในแอป Claude หรือ claude.ai เท่านั้น');
  try { const r = await s(input, opts || {}); return r.text + (r.truncated ? '\n\n[คำตอบถูกตัดเพราะยาวเกิน]' : ''); }
  catch (e) { const er = PK.E(AIERR[e && e.code] || 'ติดต่อ Claude ไม่สำเร็จ ลองใหม่อีกครั้ง'); er.partial = e && e.text; throw er; }
};
PK.aiImages = async () => { if (!aiP) aiP = use('sample'); const s = await aiP; if (!s) return null; try { const l = await s.limits(); return l.images || null; } catch (e) { return null; } };

/* ---------- screens ---------- */
const kinds = {
  pdf: ['PDF', 'application/pdf,.pdf', /\.pdf$/i, /^application\/pdf$/],
  img: ['รูปภาพ', 'image/*', /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i, /^image\//],
  docx: ['Word (.docx)', '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document', /\.docx$/i, /wordprocessingml/],
  xlsx: ['Excel (.xlsx .xls .csv)', '.xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv', /\.(xlsx|xls|csv)$/i, /spreadsheetml|ms-excel|csv/],
  pptx: ['PowerPoint (.pptx)', '.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation', /\.pptx$/i, /presentationml/],
  html: ['HTML', '.html,.htm,text/html', /\.html?$/i, /text\/html/]
};
const catOf = id => PK.cats.find(c => c[0] === id);

PK.home = () => {
  PK.cur = null; PK.files = []; PK.result = null; PK.leave && PK.leave(); PK.leave = null;
  let h = '<header class="brand"><h1>กล่องเครื่องมือ PDF</h1>' +
    '<p class="lock">' + svg(PK.icons.lock) + '<span>ไฟล์ทำงานอยู่ในเครื่องคุณ ไม่ถูกส่งขึ้นเซิร์ฟเวอร์ ยกเว้นเมนู AI ที่ส่งเนื้อหาให้ Claude</span></p></header>' +
    '<div class="field"><label for="q" class="small muted">ค้นหาเครื่องมือ ' + PK.tools.filter(t => !t.ai || window.claude).length + ' รายการ</label><input type="search" id="q" class="search" placeholder="เช่น รวม, ลายเซ็น, Word" autocomplete="off"></div><div id="cats">';
  for (const c of PK.cats) {
    const list = PK.tools.filter(t => t.cat === c[0] && (!t.ai || window.claude)); if (!list.length) continue;
    h += '<section class="cat" data-cat><h2>' + c[1] + ' <small>' + list.length + ' เครื่องมือ</small></h2><ul class="tools">';
    for (const t of list) {
      h += '<li data-k="' + esc((t.name + ' ' + t.desc + ' ' + (t.kw || '')).toLowerCase()) + '"><button type="button" class="tool" data-tool="' + t.id + '" style="--tint:' + c[2] + '"><span class="ic">' + svg(PK.icons[t.icon] || PK.icons.doc) + '</span><span><b>' + t.name + (t.ai ? '<span class="tag">AI</span>' : '') + '</b><span class="d">' + t.desc + '</span></span></button></li>';
    }
    h += '</ul></section>';
  }
  app().innerHTML = h + '</div><p class="small muted" id="none" hidden>ไม่พบเครื่องมือที่ตรงกับคำค้น</p>';
  $('q').oninput = () => {
    const q = $('q').value.trim().toLowerCase(); let any = false;
    document.querySelectorAll('[data-cat]').forEach(sec => {
      let n = 0; sec.querySelectorAll('li').forEach(li => { const ok = !q || li.getAttribute('data-k').indexOf(q) >= 0; li.hidden = !ok; if (ok) n++; });
      sec.hidden = !n; if (n) any = true;
    });
    $('none').hidden = any;
  };
  window.scrollTo(0, 0);
};

PK.toolView = t => {
  PK.leave && PK.leave(); PK.leave = null;
  PK.cur = t; PK.files = []; PK.result = null; PK.busy = false;
  const k = kinds[t.in || 'pdf'];
  let h = '<button type="button" class="back" id="back">‹ เครื่องมือทั้งหมด</button>' +
    '<header class="brand"><h1>' + t.name + '</h1><p class="muted">' + (t.long || t.desc) + '</p></header>';
  if (t.view) { app().innerHTML = h + '<div id="custom"></div>'; $('back').onclick = () => PK.go(''); t.view($('custom'), t); window.scrollTo(0, 0); return; }
  h += '<section class="panel"><label class="drop" id="drop"><input type="file" id="file" accept="' + k[1] + '"' + (t.multi ? ' multiple' : '') + '>' +
    '<span class="pick">เลือกไฟล์ ' + k[0] + '</span><span class="small muted">' + (t.multi ? 'เลือกได้หลายไฟล์ กดซ้ำเพื่อเพิ่ม' : 'เลือกได้ครั้งละ 1 ไฟล์') + '</span></label>' +
    (t.capture ? '<label class="run ghost" style="display:grid;place-items:center;cursor:pointer"><input type="file" id="cam" accept="image/*" capture="environment" style="position:absolute;width:1px;height:1px;opacity:0">ถ่ายรูปด้วยกล้อง</label>' : '') +
    '<ul class="files" id="files"></ul></section>';
  const o = t.opts ? t.opts() : '';
  if (o) h += '<section class="panel" id="opts"><h2>ตั้งค่า</h2>' + o + '</section>';
  h += '<button type="button" class="run" id="run" disabled>' + t.act + '</button>' +
    '<div><div class="bar" id="bar" hidden><i></i></div><p class="status" id="status" role="status" aria-live="polite"></p></div>' +
    '<div class="out" id="live" hidden></div>' +
    '<section class="panel result" id="result" hidden></section>';
  app().innerHTML = h;
  $('back').onclick = () => PK.go('');
  const inp = $('file'); inp.onchange = () => { addFiles(inp.files); inp.value = ''; };
  if (t.capture) { const cam = $('cam'); cam.onchange = () => { addFiles(cam.files); cam.value = ''; }; }
  const drop = $('drop');
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); addFiles(e.dataTransfer.files); };
  $('files').onclick = fileClick; $('run').onclick = run;
  t.init && t.init();
  drawFiles(); window.scrollTo(0, 0);
};

function addFiles(list) {
  const t = PK.cur; if (PK.busy || !t) return;
  const k = kinds[t.in || 'pdf']; const ok = []; let bad = 0;
  Array.prototype.forEach.call(list, f => { (k[2].test(f.name) || k[3].test(f.type || '')) ? ok.push(f) : bad++; });
  if (t.multi) { PK.files = PK.files.concat(ok); if (t.max && PK.files.length > t.max) PK.files = PK.files.slice(-t.max); }
  else if (ok.length) PK.files = [ok[0]];
  PK.setStatus(bad ? 'ข้าม ' + bad + ' ไฟล์ที่ไม่ใช่ ' + k[0] : '', bad > 0);
  hideResult(); drawFiles();
  if (ok.length && t.onFiles) Promise.resolve(t.onFiles(PK.files)).catch(e => PK.setStatus(e.message, true));
}
function drawFiles() {
  const t = PK.cur, ul = $('files'); if (!ul) return;
  ul.innerHTML = PK.files.map((f, i) => {
    const mv = t.multi ? '<button type="button" class="ib" data-f="up" data-i="' + i + '" aria-label="เลื่อน ' + esc(f.name) + ' ขึ้น"' + (i === 0 ? ' disabled' : '') + '>↑</button><button type="button" class="ib" data-f="down" data-i="' + i + '" aria-label="เลื่อน ' + esc(f.name) + ' ลง"' + (i === PK.files.length - 1 ? ' disabled' : '') + '>↓</button>' : '';
    return '<li><div class="n"><b>' + (t.multi ? (i + 1) + '. ' : '') + esc(f.name) + '</b><span>' + PK.fmtSize(f.size) + '</span></div>' + mv + '<button type="button" class="ib del" data-f="rm" data-i="' + i + '" aria-label="เอา ' + esc(f.name) + ' ออก">✕</button></li>';
  }).join('');
  const need = t.min === undefined ? 1 : t.min; const btn = $('run');
  btn.disabled = PK.busy || PK.files.length < need;
  btn.textContent = (PK.files.length < need && need > 1 && PK.files.length > 0) ? 'เลือกให้ครบ ' + need + ' ไฟล์' : t.act;
}
PK.drawFiles = drawFiles;
function fileClick(e) {
  const b = e.target.closest('[data-f]'); if (!b || PK.busy) return;
  const o = b.getAttribute('data-f'), i = +b.getAttribute('data-i'), F = PK.files;
  if (o === 'rm') { F.splice(i, 1); PK.cur.onFiles && Promise.resolve(PK.cur.onFiles(F)).catch(() => {}); }
  else if (o === 'up' && i > 0) [F[i - 1], F[i]] = [F[i], F[i - 1]];
  else if (o === 'down' && i < F.length - 1) [F[i + 1], F[i]] = [F[i], F[i + 1]];
  hideResult(); drawFiles();
}
PK.setStatus = (msg, err) => { const s = $('status'); if (!s) return; s.textContent = msg || ''; s.className = 'status' + (err ? ' err' : ''); };
PK.setBar = v => { const b = $('bar'); if (!b) return; if (v == null) { b.hidden = true; return; } b.hidden = false; b.firstChild.style.width = Math.round(Math.max(0, Math.min(1, v)) * 100) + '%'; };
function hideResult() { PK.result = null; const r = $('result'); if (r) { r.hidden = true; r.innerHTML = ''; } const l = $('live'); if (l) { l.hidden = true; l.textContent = ''; } }
PK.hideResult = hideResult;

/* shows a finished result: {name, blob, note, text?, html?} */
PK.showResult = res => {
  PK.result = res; const box = $('result'); if (!box) return;
  const l = $('live'); if (l) l.hidden = true;
  let h = '<p class="ok">' + svg(PK.icons.check) + '<span>เสร็จแล้ว</span></p>';
  if (res.html) h += '<div class="out">' + res.html + '</div>';
  else if (res.text) h += '<div class="out" id="restext"></div>';
  if (res.note) h += '<p class="small muted">' + esc(res.note) + '</p>';
  h += '<div class="btnrow">';
  if (res.blob) h += '<button type="button" class="run save" id="save">บันทึก ' + esc(res.name) + ' (' + PK.fmtSize(res.blob.size) + ')</button>';
  if (res.text) h += '<button type="button" class="run ghost" id="copy">คัดลอกข้อความ</button>';
  h += '</div><p class="status" id="savemsg" role="status" aria-live="polite"></p>';
  box.innerHTML = h; box.hidden = false;
  if (res.text && $('restext')) $('restext').textContent = res.text;
  if ($('save')) $('save').onclick = async () => {
    const b = $('save'), m = $('savemsg'); b.disabled = true; m.className = 'status'; m.textContent = 'กำลังเปิดหน้าต่างบันทึก';
    try {
      const r = await PK.saveFile(res.name, res.blob);
      m.textContent = r === 'saved' ? 'บันทึกแล้ว' : r === 'declined' ? 'ยังไม่ได้บันทึก กดปุ่มอีกครั้งได้' : 'สั่งดาวน์โหลดแล้ว ถ้าไฟล์ไม่ลงเครื่อง ให้เปิดหน้านี้ในแอป Claude หรือ claude.ai';
    } catch (e) { m.className = 'status err'; m.textContent = (e && e.message) || 'บันทึกไม่ได้ ลองอีกครั้ง'; }
    b.disabled = false;
  };
  if ($('copy')) $('copy').onclick = async () => {
    const m = $('savemsg');
    try { await navigator.clipboard.writeText(res.text); m.className = 'status'; m.textContent = 'คัดลอกแล้ว'; }
    catch (e) { const r = document.createRange(); r.selectNodeContents($('restext')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); m.className = 'status'; m.textContent = 'เลือกข้อความให้แล้ว กดค้างแล้วเลือกคัดลอก'; }
  };
  box.scrollIntoView({ block: 'nearest' });
};

/* runs fn with progress + error handling on the current screen */
PK.exec = async fn => {
  if (PK.busy || !PK.cur) return; const t = PK.cur;
  PK.busy = true; hideResult(); $('files') && drawFiles(); PK.setBar(0.02); PK.setStatus('กำลังเริ่ม');
  const prog = (m, v) => { if (PK.cur === t) { PK.setStatus(m); if (v !== undefined) PK.setBar(v); } };
  const live = txt => { const l = $('live'); if (l && PK.cur === t) { l.hidden = false; l.textContent = txt; } };
  try {
    PK.needLibs();
    const res = await fn(prog, live);
    if (PK.cur !== t) return;
    PK.setBar(null); PK.setStatus('');
    if (res) PK.showResult(res);
  } catch (e) {
    console.error(e);
    if (PK.cur === t) { PK.setBar(null); PK.setStatus((e && e.message) || 'ทำไม่สำเร็จ ลองใหม่อีกครั้ง', true); }
  } finally { PK.busy = false; if (PK.cur === t && $('files')) drawFiles(); }
};
function run() { const t = PK.cur; PK.exec((prog, live) => t.run(PK.files.slice(), prog, live)); }

/* ---------- routing ---------- */
const byId = id => PK.tools.find(x => x.id === id);
PK.go = id => { try { location.hash = id || ''; } catch (e) { /* hash not available */ } const t = byId(id); t ? PK.toolView(t) : PK.home(); };
const ORDER = ['merge','split','remove','extract','organize','scan','compress','repair','ocr','img2pdf','word2pdf','ppt2pdf','excel2pdf','html2pdf','pdf2jpg','pdf2word','pdf2ppt','pdf2excel','pdf2pdfa','pdf2md','edit','rotate','number','watermark','crop','forms','unlock','protect','sign','redact','compare','summarize','translate','ask','pdf2txt','gray','nup','a4','meta'];
PK.start = () => {
  PK.tools.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
  app().addEventListener('click', e => { const b = e.target.closest('[data-tool]'); if (b) PK.go(b.getAttribute('data-tool')); });
  window.addEventListener('hashchange', () => {
    const id = (location.hash || '').replace(/^#/, '');
    if ((PK.cur ? PK.cur.id : '') !== id && !PK.busy) { const t = byId(id); t ? PK.toolView(t) : PK.home(); }
  });
  const t = byId((location.hash || '').replace(/^#/, '')); t ? PK.toolView(t) : PK.home();
};
})();
