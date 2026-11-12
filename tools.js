/* tools: organise, optimise, page edits, security and extras */
(function(){
"use strict";
const { $, esc, val, on, tick, pad, baseName, fmtSize, pdfBlob, E } = PK;
const L = () => PDFLib;
const sel = (id, label, opts) => '<div class="field"><label for="' + id + '">' + label + '</label><select id="' + id + '">' + opts.map(o => '<option value="' + o[0] + '">' + o[1] + '</option>').join('') + '</select></div>';
const txt = (id, label, attrs, hint) => '<div class="field"><label for="' + id + '">' + label + '</label><input id="' + id + '" ' + (attrs || 'type="text"') + ' autocomplete="off">' + (hint ? '<p class="hint" id="' + id + '-hint">' + hint + '</p>' : '') + '</div>';
const chk = (id, label, checked) => '<label class="check"><input type="checkbox" id="' + id + '"' + (checked ? ' checked' : '') + '><span>' + label + '</span></label>';
const row = (...x) => '<div class="row">' + x.join('') + '</div>';
PK.ui = { sel, txt, chk, row };

/* draw in "view space": origin bottom-left of the page as the reader sees it, whatever its /Rotate */
PK.viewM = page => {
  const R = ((page.getRotation().angle % 360) + 360) % 360; const b = page.getCropBox();
  if (R === 90) return { m: [0, 1, -1, 0, b.x + b.width, b.y], vw: b.height, vh: b.width };
  if (R === 180) return { m: [-1, 0, 0, -1, b.x + b.width, b.y + b.height], vw: b.width, vh: b.height };
  if (R === 270) return { m: [0, -1, 1, 0, b.x, b.y + b.height], vw: b.height, vh: b.width };
  return { m: [1, 0, 0, 1, b.x, b.y], vw: b.width, vh: b.height };
};
PK.inView = (page, fn) => {
  const v = PK.viewM(page);
  page.pushOperators(L().pushGraphicsState(), L().concatTransformationMatrix(...v.m));
  fn(v.vw, v.vh);
  page.pushOperators(L().popGraphicsState());
};
PK.textCanvas = async (text, o) => {
  o = Object.assign({ px: 96, color: '#000000', weight: 600 }, o || {});
  const font = o.weight + ' ' + o.px + 'px "IBM Plex Sans Thai","Loma",sans-serif';
  try { await document.fonts.load(font, text); } catch (e) { /* use fallback font */ }
  const lines = String(text).split('\n'); const c = document.createElement('canvas'); let ctx = c.getContext('2d'); ctx.font = font;
  const w = Math.max(1, ...lines.map(l => ctx.measureText(l).width)); const lh = o.px * 1.4;
  c.width = Math.ceil(w) + 4; c.height = Math.ceil(lh * lines.length) + 4;
  ctx = c.getContext('2d'); ctx.font = font; ctx.fillStyle = o.color; ctx.textBaseline = 'alphabetic';
  lines.forEach((l, i) => ctx.fillText(l, 2, 2 + i * lh + o.px * 1.02));
  return c;
};
const pageHint = async (files, id) => {
  const h = $(id + '-hint'); if (!h) return; if (!files.length) { h.textContent = 'เลือกไฟล์ก่อน แล้วจะบอกจำนวนหน้าให้'; return; }
  const d = await PK.openLib(files[0]); if (PK.files[0] === files[0]) h.textContent = 'ไฟล์นี้มี ' + d.getPageCount() + ' หน้า คั่นด้วยจุลภาค ใช้ขีดสำหรับช่วง เช่น 1-3, 5';
};
const RANGE_HINT = 'เลือกไฟล์ก่อน แล้วจะบอกจำนวนหน้าให้';

/* ================= จัดระเบียบ ================= */
PK.add({ id: 'merge', cat: 'org', icon: 'merge', name: 'รวม PDF', desc: 'ต่อหลายไฟล์เป็นไฟล์เดียว', multi: true, min: 2, act: 'รวมไฟล์',
  opts: () => '<p class="hint">ไฟล์จะต่อกันตามลำดับในรายการ ใช้ลูกศรเลื่อนขึ้นลงได้</p>',
  run: async (files, prog) => {
    const out = await L().PDFDocument.create();
    for (let i = 0; i < files.length; i++) {
      prog('กำลังอ่านไฟล์ที่ ' + (i + 1) + ' จาก ' + files.length, i / files.length);
      const src = await PK.openLib(files[i]);
      (await out.copyPages(src, src.getPageIndices())).forEach(p => out.addPage(p));
      await tick();
    }
    return { name: 'รวมไฟล์.pdf', blob: pdfBlob(await out.save()), note: 'รวม ' + files.length + ' ไฟล์ ได้ทั้งหมด ' + out.getPageCount() + ' หน้า' };
  } });

PK.add({ id: 'split', cat: 'org', icon: 'split', name: 'แยก PDF', desc: 'แยกทีละหน้า ทีละชุด หรือตามช่วง', act: 'แยกไฟล์',
  opts: () => sel('sp-mode', 'วิธีแยก', [['each', 'แยกทุกหน้า ไฟล์ละหน้า'], ['chunk', 'แยกเป็นชุด ชุดละหลายหน้า'], ['ranges', 'แยกตามช่วงที่กำหนด ช่วงละไฟล์']]) +
    '<div id="sp-n-f" hidden>' + txt('sp-n', 'จำนวนหน้าต่อชุด', 'type="number" min="1" value="2" inputmode="numeric"') + '</div>' +
    '<div id="sp-r-f" hidden>' + txt('sp-r', 'ช่วงหน้า', 'type="text" placeholder="เช่น 1-3, 4-6, 7"', RANGE_HINT) + '</div><p class="hint">ผลลัพธ์เป็นไฟล์ ZIP ที่รวมทุกไฟล์ย่อย</p>',
  init: () => { const m = $('sp-mode'); m.onchange = () => { $('sp-n-f').hidden = m.value !== 'chunk'; $('sp-r-f').hidden = m.value !== 'ranges'; }; },
  onFiles: f => pageHint(f, 'sp-r'),
  run: async (files, prog) => {
    const f = files[0], src = await PK.openLib(f), n = src.getPageCount(), mode = val('sp-mode'); let groups = [];
    if (mode === 'each') for (let i = 0; i < n; i++) groups.push([i]);
    else if (mode === 'chunk') { const k = Math.max(1, parseInt(val('sp-n'), 10) || 1); for (let i = 0; i < n; i += k) groups.push(Array.from({ length: Math.min(k, n - i) }, (_, j) => i + j)); }
    else groups = val('sp-r').split(',').filter(s => s.trim()).map(s => PK.parseRanges(s, n));
    if (!groups.length) throw E('ระบุช่วงหน้าก่อน เช่น 1-3, 4-6');
    const zip = new JSZip();
    for (let g = 0; g < groups.length; g++) {
      prog('กำลังสร้างไฟล์ที่ ' + (g + 1) + ' จาก ' + groups.length, g / groups.length);
      const d = await L().PDFDocument.create(); (await d.copyPages(src, groups[g])).forEach(p => d.addPage(p));
      zip.file(baseName(f) + '-' + pad(g + 1) + '.pdf', await d.save()); await tick();
    }
    prog('กำลังรวมเป็นไฟล์ ZIP', 0.98);
    return { name: baseName(f) + '-แยก.zip', blob: await zip.generateAsync({ type: 'blob' }), note: 'แยกได้ ' + groups.length + ' ไฟล์ อยู่ในไฟล์ ZIP' };
  } });

const pickPages = keep => ({
  opts: () => txt('pg-r', keep ? 'หน้าที่ต้องการเก็บ' : 'หน้าที่ต้องการลบ', 'type="text" placeholder="เช่น 1-3, 5, 8-10"', RANGE_HINT),
  onFiles: f => pageHint(f, 'pg-r'),
  run: async files => {
    const f = files[0], src = await PK.openLib(f), n = src.getPageCount(); const picked = PK.parseRanges(val('pg-r'), n);
    const idx = keep ? picked : src.getPageIndices().filter(i => picked.indexOf(i) < 0);
    if (!idx.length) throw E('ลบทุกหน้าไม่ได้ ต้องเหลืออย่างน้อย 1 หน้า');
    const out = await L().PDFDocument.create(); (await out.copyPages(src, idx)).forEach(p => out.addPage(p));
    return { name: baseName(f) + (keep ? '-หน้าที่เลือก.pdf' : '-ลบหน้าแล้ว.pdf'), blob: pdfBlob(await out.save()), note: 'เหลือ ' + idx.length + ' หน้า จากเดิม ' + n + ' หน้า' };
  }
});
PK.add(Object.assign({ id: 'remove', cat: 'org', icon: 'trash', name: 'ลบหน้า', desc: 'ลบหน้าที่ไม่ต้องการออก', act: 'ลบหน้า' }, pickPages(false)));
PK.add(Object.assign({ id: 'extract', cat: 'org', icon: 'doc', name: 'ดึงหน้า', desc: 'เก็บเฉพาะหน้าที่เลือกเป็นไฟล์ใหม่', act: 'ดึงหน้า' }, pickPages(true)));

/* organise with thumbnails */
const org = { pages: [], token: 0, size: [595.28, 841.89] };
function drawOrg() {
  const box = $('org'); if (!box) return;
  if (!org.pages.length) { box.innerHTML = '<p class="hint">เลือกไฟล์ก่อน แล้วทุกหน้าจะแสดงที่นี่</p>'; return; }
  const left = org.pages.filter(p => !p.del).length;
  let h = '<div class="orgbar"><button type="button" class="chip" data-o="rotall">หมุนทุกหน้า 90°</button><button type="button" class="chip" data-o="rev">กลับลำดับ</button><button type="button" class="chip" data-o="blank">เพิ่มหน้าว่างท้ายไฟล์</button><button type="button" class="chip" data-o="reset">คืนค่าเดิม</button></div>' +
    '<p class="hint">เหลือ ' + left + ' จาก ' + org.pages.length + ' หน้า</p><div class="thumbs">';
  org.pages.forEach((p, i) => {
    const nm = p.src < 0 ? 'หน้าว่าง' : 'หน้า ' + (p.src + 1);
    h += '<div class="th' + (p.del ? ' gone' : '') + '"><div class="pv">' + (p.src < 0 ? '<div class="blank"></div>' : p.url ? '<img alt="ตัวอย่าง' + nm + '" src="' + p.url + '" style="transform:rotate(' + p.rot + 'deg)">' : '<span class="hint">กำลังโหลด</span>') + '</div>' +
      '<div class="lb">' + nm + (p.del ? ' · จะถูกลบ' : '') + '</div><div class="bt">' +
      '<button type="button" class="ib" data-o="up" data-i="' + i + '" aria-label="เลื่อน' + nm + 'ไปก่อนหน้า"' + (i === 0 ? ' disabled' : '') + '>◀</button>' +
      '<button type="button" class="ib" data-o="rot" data-i="' + i + '" aria-label="หมุน' + nm + '">↻</button>' +
      '<button type="button" class="ib del" data-o="del" data-i="' + i + '" aria-label="' + (p.del ? 'เอา' + nm + 'กลับมา' : 'ลบ' + nm) + '">' + (p.del ? '↩' : '✕') + '</button>' +
      '<button type="button" class="ib" data-o="down" data-i="' + i + '" aria-label="เลื่อน' + nm + 'ไปถัดไป"' + (i === org.pages.length - 1 ? ' disabled' : '') + '>▶</button></div></div>';
  });
  box.innerHTML = h + '</div>';
}
async function loadOrg(file) {
  const my = ++org.token; org.pages = []; const box = $('org');
  if (!file) { drawOrg(); return; }
  if (box) box.innerHTML = '<p class="hint">กำลังเปิดไฟล์</p>';
  try {
    PK.needLibs(); const pdf = await PK.openJs(file); if (my !== org.token) return;
    for (let i = 0; i < pdf.numPages; i++) org.pages.push({ src: i, rot: 0, del: false, url: '' });
    drawOrg();
    for (let n = 1; n <= pdf.numPages; n++) {
      const r = await PK.renderPage(pdf, n, 0.4, 260); if (my !== org.token) return;
      if (n === 1) org.size = [r.w, r.h];
      const url = r.canvas.toDataURL('image/jpeg', 0.6); PK.free(r.canvas); r.page.cleanup();
      const pg = org.pages.find(p => p.src === n - 1); if (pg) pg.url = url;
      if (n % 4 === 0 || n === pdf.numPages) drawOrg();
      await tick();
    }
    pdf.destroy();
  } catch (e) { if (box && my === org.token) { org.pages = []; box.innerHTML = '<p class="status err">' + esc(e.message || 'เปิดไฟล์ไม่ได้') + '</p>'; } }
}
function orgClick(e) {
  const b = e.target.closest('[data-o]'); if (!b) return;
  const o = b.getAttribute('data-o'), i = +b.getAttribute('data-i'), P = org.pages;
  if (o === 'rotall') P.forEach(p => { p.rot = (p.rot + 90) % 360; });
  else if (o === 'rev') P.reverse();
  else if (o === 'blank') P.push({ src: -1, rot: 0, del: false, url: '' });
  else if (o === 'reset') { org.pages = P.filter(p => p.src >= 0).sort((a, b) => a.src - b.src); org.pages.forEach(p => { p.rot = 0; p.del = false; }); }
  else if (o === 'rot') P[i].rot = (P[i].rot + 90) % 360;
  else if (o === 'del') P[i].del = !P[i].del;
  else if (o === 'up' && i > 0) [P[i - 1], P[i]] = [P[i], P[i - 1]];
  else if (o === 'down' && i < P.length - 1) [P[i + 1], P[i]] = [P[i], P[i + 1]];
  drawOrg();
}
PK.add({ id: 'organize', cat: 'org', icon: 'grid', name: 'จัดเรียงหน้า', desc: 'ดูทุกหน้า แล้วสลับ หมุน ลบ เพิ่มหน้าว่าง', kw: 'organize reorder', act: 'บันทึกการจัดหน้า',
  opts: () => '<div id="org"><p class="hint">เลือกไฟล์ก่อน แล้วทุกหน้าจะแสดงที่นี่</p></div>',
  init: () => { $('org').onclick = orgClick; org.token++; org.pages = []; },
  onFiles: f => loadOrg(f[0]),
  run: async files => {
    const keep = org.pages.filter(p => !p.del);
    if (!org.pages.length) throw E('รอให้โหลดหน้าเอกสารเสร็จก่อน');
    if (!keep.length) throw E('ลบหมดทุกหน้าแล้ว ต้องเหลืออย่างน้อย 1 หน้า');
    const src = await PK.openLib(files[0]); const out = await L().PDFDocument.create();
    const real = keep.filter(p => p.src >= 0); const copied = await out.copyPages(src, real.map(p => p.src)); let k = 0;
    for (const p of keep) {
      if (p.src < 0) { out.addPage(org.size); continue; }
      const page = copied[k++]; if (p.rot) page.setRotation(L().degrees((page.getRotation().angle + p.rot) % 360)); out.addPage(page);
    }
    return { name: baseName(files[0]) + '-จัดหน้าแล้ว.pdf', blob: pdfBlob(await out.save()), note: 'ได้ ' + keep.length + ' หน้า' };
  } });

/* images to PDF (also used by scan) */
const enhance = (ctx, c) => {
  const d = ctx.getImageData(0, 0, c.width, c.height), a = d.data;
  for (let i = 0; i < a.length; i += 4) { let g = 0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2]; g = (g - 128) * 1.45 + 150; g = g < 0 ? 0 : g > 255 ? 255 : g; a[i] = a[i + 1] = a[i + 2] = g; }
  ctx.putImageData(d, 0, 0);
};
const gray = (ctx, c) => {
  const d = ctx.getImageData(0, 0, c.width, c.height), a = d.data;
  for (let i = 0; i < a.length; i += 4) { const g = 0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2]; a[i] = a[i + 1] = a[i + 2] = g; }
  ctx.putImageData(d, 0, 0);
};
async function imagesToPdf(files, prog, o) {
  const out = await L().PDFDocument.create();
  for (let i = 0; i < files.length; i++) {
    prog('กำลังใส่รูปที่ ' + (i + 1) + ' จาก ' + files.length, i / files.length);
    const src = await PK.loadImage(files[i]); const s = Math.min(1, 2400 / Math.max(src.w, src.h));
    const c = document.createElement('canvas'); c.width = Math.round(src.w * s); c.height = Math.round(src.h * s);
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(src.el, 0, 0, c.width, c.height); src.close();
    if (o.enhance) enhance(ctx, c);
    const b = await PK.toBlob(c, 'image/jpeg', 0.88); const iw = c.width, ih = c.height; PK.free(c);
    const img = await out.embedJpg(await b.arrayBuffer());
    if (o.a4) {
      const land = iw > ih, pw = land ? 841.89 : 595.28, ph = land ? 595.28 : 841.89, m = o.margin;
      const k = Math.min((pw - 2 * m) / iw, (ph - 2 * m) / ih), w = iw * k, h = ih * k;
      out.addPage([pw, ph]).drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
    } else { const w = 595.28, h = ih * (595.28 / iw); out.addPage([w, h]).drawImage(img, { x: 0, y: 0, width: w, height: h }); }
    await tick();
  }
  return out;
}
const imgOpts = () => row(sel('im-size', 'ขนาดกระดาษ', [['a4', 'A4 จัดรูปให้พอดีหน้า'], ['fit', 'เท่าขนาดรูป ไม่มีขอบ']]), sel('im-margin', 'ขอบกระดาษ', [['24', 'ขอบแคบ'], ['0', 'ไม่มีขอบ'], ['56', 'ขอบกว้าง']]));
PK.add({ id: 'scan', cat: 'org', icon: 'camera', name: 'สแกนเป็น PDF', desc: 'ถ่ายเอกสารด้วยกล้องแล้วรวมเป็น PDF', in: 'img', multi: true, capture: true, act: 'สร้าง PDF',
  long: 'ถ่ายเอกสารทีละหน้าด้วยกล้อง หรือเลือกรูปที่ถ่ายไว้ แล้วรวมเป็น PDF ไฟล์เดียว',
  opts: () => chk('sc-enh', 'ปรับเป็นขาวดำคมชัดแบบเครื่องสแกน', true) + imgOpts(),
  run: async (files, prog) => { const out = await imagesToPdf(files, prog, { a4: val('im-size') !== 'fit', margin: +val('im-margin') || 0, enhance: on('sc-enh') }); return { name: 'สแกนเอกสาร.pdf', blob: pdfBlob(await out.save()), note: 'สร้าง PDF ' + files.length + ' หน้า' }; } });
PK.add({ id: 'img2pdf', cat: 'to', icon: 'image', name: 'JPG เป็น PDF', desc: 'รวมรูป JPG PNG หลายใบเป็น PDF', kw: 'รูป png image', in: 'img', multi: true, act: 'สร้าง PDF',
  opts: imgOpts,
  run: async (files, prog) => { const out = await imagesToPdf(files, prog, { a4: val('im-size') !== 'fit', margin: +val('im-margin') || 0 }); return { name: 'รูปภาพ.pdf', blob: pdfBlob(await out.save()), note: 'สร้าง PDF ' + files.length + ' หน้า' }; } });

/* ================= ปรับแต่ง ================= */
PK.add({ id: 'compress', cat: 'opt', icon: 'squeeze', name: 'บีบอัด PDF', desc: 'ลดขนาดไฟล์ให้ส่งไลน์หรืออีเมลได้', act: 'บีบอัดไฟล์',
  opts: () => sel('cmp-level', 'ระดับการบีบอัด', [['mid', 'สมดุล (แนะนำ)'], ['small', 'เล็กที่สุด ภาพหยาบลง'], ['high', 'คมชัด ลดได้น้อยกว่า'], ['lossless', 'ไม่เสียคุณภาพ ข้อความยังคัดลอกได้']]) +
    '<p class="hint">สามระดับแรกแปลงแต่ละหน้าเป็นรูป เหมาะกับไฟล์สแกนหรือไฟล์ที่มีรูปเยอะ แต่ข้อความจะคัดลอกหรือค้นหาไม่ได้ ระดับ "ไม่เสียคุณภาพ" จัดโครงสร้างไฟล์ใหม่ ลดได้น้อยกว่า</p>',
  run: async (files, prog) => {
    const f = files[0], lv = val('cmp-level') || 'mid'; let blob;
    if (lv === 'lossless') {
      prog('กำลังจัดโครงสร้างไฟล์ใหม่', 0.3);
      try { blob = pdfBlob(await PK.qpdf(['--object-streams=generate', '--compress-streams=y', '--recompress-flate', '--compression-level=9'], await PK.bytes(f))); }
      catch (e) { if (!e.noEngine) throw E('บีบอัดไฟล์นี้ไม่ได้ ถ้าตั้งรหัสไว้ให้ปลดล็อกก่อน'); const d = await PK.openLib(f); blob = pdfBlob(await d.save({ useObjectStreams: true })); }
    } else {
      const p = { small: [1.0, 0.5], mid: [1.5, 0.65], high: [2.0, 0.8] }[lv];
      const pdf = await PK.openJs(f); const out = await PK.rasterPdf(pdf, prog, { scale: p[0], q: p[1], label: 'กำลังบีบอัดหน้า' }); pdf.destroy();
      blob = pdfBlob(await out.save());
    }
    const note = blob.size < f.size ? 'จาก ' + fmtSize(f.size) + ' เหลือ ' + fmtSize(blob.size) + ' (ลดลง ' + Math.round((1 - blob.size / f.size) * 100) + '%)'
      : 'ผลลัพธ์ไม่เล็กกว่าเดิม (' + fmtSize(f.size) + ') แนะนำให้ใช้ไฟล์เดิม หรือลองระดับอื่น';
    return { name: baseName(f) + '-บีบอัด.pdf', blob, note };
  } });

PK.add({ id: 'repair', cat: 'opt', icon: 'wrench', name: 'ซ่อมแซม PDF', desc: 'กู้ไฟล์ที่เปิดไม่ได้หรือเสียหาย', act: 'ซ่อมไฟล์',
  opts: () => '<p class="hint">จะลองสร้างโครงสร้างไฟล์ใหม่ก่อน ถ้าไม่สำเร็จจะกู้หน้าที่ยังอ่านได้ออกมาเป็นภาพ ไฟล์ที่เสียหายหนักอาจกู้ไม่ได้</p>',
  run: async (files, prog) => {
    const f = files[0], bytes = await PK.bytes(f); prog('กำลังตรวจโครงสร้างไฟล์', 0.2);
    try { const out = await PK.qpdf([], bytes); return { name: baseName(f) + '-ซ่อมแล้ว.pdf', blob: pdfBlob(out), note: 'สร้างโครงสร้างไฟล์ใหม่สำเร็จ เนื้อหาเดิมอยู่ครบ' }; }
    catch (e) { /* try the next method */ }
    try { const d = await L().PDFDocument.load(bytes, { ignoreEncryption: true, throwOnInvalidObject: false }); if (d.getPageCount()) return { name: baseName(f) + '-ซ่อมแล้ว.pdf', blob: pdfBlob(await d.save()), note: 'บันทึกโครงสร้างไฟล์ใหม่สำเร็จ' }; } catch (e) { /* next */ }
    let pdf; try { pdf = await PK.openJs(bytes); } catch (e) { throw E('ไฟล์เสียหายเกินกว่าจะกู้ได้ในเบราว์เซอร์'); }
    const out = await PK.rasterPdf(pdf, prog, { scale: 2, q: 0.85, label: 'กำลังกู้หน้า' }); pdf.destroy();
    return { name: baseName(f) + '-ซ่อมแล้ว.pdf', blob: pdfBlob(await out.save()), note: 'กู้ได้แบบเป็นภาพ ข้อความจะคัดลอกไม่ได้' };
  } });

/* ================= แปลงจาก PDF (ภาพ) ================= */
PK.add({ id: 'pdf2jpg', cat: 'from', icon: 'image', name: 'PDF เป็น JPG', desc: 'แปลงทุกหน้าเป็นไฟล์รูป JPG หรือ PNG', kw: 'png รูป', act: 'แปลงเป็นรูป',
  opts: () => row(sel('jpg-fmt', 'ชนิดรูป', [['jpg', 'JPG ไฟล์เล็ก'], ['png', 'PNG คมชัด']]), sel('jpg-q', 'ความละเอียด', [['2', 'ปกติ'], ['3', 'สูง สำหรับพิมพ์'], ['1.2', 'ต่ำ ไฟล์เล็ก']])) + '<p class="hint">ถ้ามีหลายหน้า จะได้ไฟล์ ZIP ที่รวมรูปทุกหน้า</p>',
  run: async (files, prog) => {
    const f = files[0], sc = parseFloat(val('jpg-q')) || 2, png = val('jpg-fmt') === 'png', ext = png ? 'png' : 'jpg';
    const pdf = await PK.openJs(f), n = pdf.numPages, zip = new JSZip(); let one = null;
    for (let i = 1; i <= n; i++) {
      prog('กำลังแปลงหน้า ' + i + ' จาก ' + n, (i - 1) / n);
      const r = await PK.renderPage(pdf, i, sc, 4000); const b = await PK.toBlob(r.canvas, png ? 'image/png' : 'image/jpeg', 0.9); PK.free(r.canvas); r.page.cleanup();
      if (n === 1) one = b; else zip.file(baseName(f) + '-หน้า-' + pad(i) + '.' + ext, b);
      await tick();
    }
    pdf.destroy();
    if (one) return { name: baseName(f) + '.' + ext, blob: one, note: 'ได้รูป 1 ใบ' };
    prog('กำลังรวมเป็นไฟล์ ZIP', 0.98);
    return { name: baseName(f) + '-รูปภาพ.zip', blob: await zip.generateAsync({ type: 'blob' }), note: 'ได้รูป ' + n + ' ใบ อยู่ในไฟล์ ZIP' };
  } });

/* ================= แก้ไข ================= */
PK.add({ id: 'rotate', cat: 'edit', icon: 'rotate', name: 'หมุน PDF', desc: 'หมุนทุกหน้าหรือบางหน้า', act: 'หมุนหน้า',
  opts: () => sel('rt-deg', 'หมุน', [['90', '90° ตามเข็มนาฬิกา'], ['270', '90° ทวนเข็มนาฬิกา'], ['180', '180° กลับหัว']]) + txt('rt-r', 'เฉพาะหน้า (เว้นว่างไว้ถ้าหมุนทุกหน้า)', 'type="text" placeholder="เช่น 1-3, 5"', RANGE_HINT),
  onFiles: f => pageHint(f, 'rt-r'),
  run: async files => {
    const f = files[0], d = await PK.openLib(f), n = d.getPageCount(), deg = +val('rt-deg');
    const idx = val('rt-r').trim() ? PK.parseRanges(val('rt-r'), n) : d.getPageIndices();
    idx.forEach(i => { const p = d.getPage(i); p.setRotation(L().degrees((p.getRotation().angle + deg) % 360)); });
    return { name: baseName(f) + '-หมุนแล้ว.pdf', blob: pdfBlob(await d.save()), note: 'หมุน ' + new Set(idx).size + ' หน้า' };
  } });

PK.add({ id: 'number', cat: 'edit', icon: 'hash', name: 'ใส่เลขหน้า', desc: 'เติมเลขหน้าที่มุมหรือกลางกระดาษ', act: 'ใส่เลขหน้า',
  opts: () => row(sel('num-pos', 'ตำแหน่ง', [['bc', 'ล่าง กลาง'], ['br', 'ล่าง ขวา'], ['bl', 'ล่าง ซ้าย'], ['tc', 'บน กลาง'], ['tr', 'บน ขวา'], ['tl', 'บน ซ้าย']]), sel('num-fmt', 'รูปแบบ', [['n', '1'], ['nt', '1 / 12'], ['dash', '- 1 -'], ['page', 'Page 1']])) +
    row(txt('num-start', 'เริ่มนับที่เลข', 'type="number" value="1" min="0" step="1" inputmode="numeric"'), txt('num-from', 'เริ่มใส่ที่หน้า', 'type="number" value="1" min="1" step="1" inputmode="numeric"')) + sel('num-size', 'ขนาดตัวเลข', [['11', 'ปกติ'], ['9', 'เล็ก'], ['14', 'ใหญ่']]),
  run: async files => {
    const f = files[0], doc = await PK.openLib(f), font = await doc.embedFont(L().StandardFonts.Helvetica);
    const pos = val('num-pos'), fmt = val('num-fmt'), size = +val('num-size') || 11, m = 28;
    let start = parseInt(val('num-start'), 10); if (isNaN(start)) start = 1;
    const from = Math.max(1, parseInt(val('num-from'), 10) || 1), pages = doc.getPages(), total = pages.length - from + start; let cnt = 0;
    pages.forEach((p, i) => {
      if (i + 1 < from) return; const k = i + 1 - from + start;
      const t = fmt === 'nt' ? k + ' / ' + total : fmt === 'dash' ? '- ' + k + ' -' : fmt === 'page' ? 'Page ' + k : String(k), w = font.widthOfTextAtSize(t, size);
      PK.inView(p, (vw, vh) => p.drawText(t, { x: pos[1] === 'c' ? (vw - w) / 2 : pos[1] === 'r' ? vw - w - m : m, y: pos[0] === 't' ? vh - m - size + 4 : m - 4, size, font, color: L().rgb(0.2, 0.2, 0.2) }));
      cnt++;
    });
    return { name: baseName(f) + '-เลขหน้า.pdf', blob: pdfBlob(await doc.save()), note: 'ใส่เลขหน้า ' + cnt + ' หน้า' };
  } });

PK.add({ id: 'watermark', cat: 'edit', icon: 'drop', name: 'ใส่ลายน้ำ', desc: 'พิมพ์ข้อความทับทุกหน้า เช่น สำเนา', act: 'ใส่ลายน้ำ',
  opts: () => txt('wm-text', 'ข้อความลายน้ำ', 'type="text" value="สำเนา" maxlength="60"') +
    row(sel('wm-pos', 'ตำแหน่ง', [['diag', 'ทแยงกลางหน้า'], ['center', 'แนวนอนกลางหน้า'], ['tile', 'ซ้ำเต็มหน้า'], ['bottom', 'มุมขวาล่าง'], ['top', 'มุมซ้ายบน']]), sel('wm-size', 'ขนาด', [['0.6', 'กลาง'], ['0.85', 'ใหญ่'], ['0.35', 'เล็ก']])) +
    row(sel('wm-color', 'สี', [['#6b7280', 'เทา'], ['#c81e1e', 'แดง'], ['#1d4ed8', 'น้ำเงิน'], ['#111111', 'ดำ']]), sel('wm-op', 'ความเข้ม', [['0.25', 'จาง'], ['0.45', 'กลาง'], ['0.75', 'เข้ม']])),
  run: async (files, prog) => {
    const text = val('wm-text').trim(); if (!text) throw E('พิมพ์ข้อความลายน้ำก่อน');
    const f = files[0], doc = await PK.openLib(f);
    const c = await PK.textCanvas(text, { px: 120, color: val('wm-color') || '#6b7280' }); const ratio = c.height / c.width;
    const img = await doc.embedPng(await (await PK.toBlob(c, 'image/png')).arrayBuffer()); PK.free(c);
    const pos = val('wm-pos'), frac = parseFloat(val('wm-size')) || 0.6, op = parseFloat(val('wm-op')) || 0.25, pages = doc.getPages();
    const put = (p, cx, cy, w, deg) => { const h = w * ratio, a = deg * Math.PI / 180; p.drawImage(img, { x: cx - (w / 2 * Math.cos(a) - h / 2 * Math.sin(a)), y: cy - (w / 2 * Math.sin(a) + h / 2 * Math.cos(a)), width: w, height: h, opacity: op, rotate: L().degrees(deg) }); };
    pages.forEach(p => PK.inView(p, (vw, vh) => {
      if (pos === 'bottom' || pos === 'top') { const w = Math.min(vw * frac * 0.6, vw - 48), h = w * ratio; put(p, pos === 'bottom' ? vw - 24 - w / 2 : 24 + w / 2, pos === 'bottom' ? 20 + h / 2 : vh - 20 - h / 2, w, 0); }
      else if (pos === 'tile') { const w = vw * frac * 0.45, sx = w * 1.5, sy = Math.max(w * ratio * 3, 110); for (let y = sy / 2, r = 0; y < vh; y += sy, r++) for (let x = (r % 2 ? sx / 2 : 0) + w / 2; x < vw + w / 2; x += sx) put(p, x, y, w, 30); }
      else if (pos === 'diag') put(p, vw / 2, vh / 2, Math.hypot(vw, vh) * 0.8 * frac, Math.atan2(vh, vw) * 180 / Math.PI);
      else put(p, vw / 2, vh / 2, vw * 0.9 * frac, 0);
    }));
    prog('กำลังบันทึก', 0.9);
    return { name: baseName(f) + '-ลายน้ำ.pdf', blob: pdfBlob(await doc.save()), note: 'ใส่ลายน้ำ "' + text + '" ครบ ' + pages.length + ' หน้า' };
  } });

PK.add({ id: 'crop', cat: 'edit', icon: 'crop', name: 'ครอบตัด PDF', desc: 'ตัดขอบกระดาษออก อัตโนมัติหรือกำหนดเอง', act: 'ครอบตัด',
  opts: () => sel('cr-mode', 'วิธีตัด', [['auto', 'ตัดขอบขาวอัตโนมัติ'], ['manual', 'กำหนดระยะเอง (มิลลิเมตร)']]) +
    '<div id="cr-m" hidden><div class="row4">' + ['t:บน', 'b:ล่าง', 'l:ซ้าย', 'r:ขวา'].map(s => { const [k, n] = s.split(':'); return '<div class="field"><label for="cr-' + k + '">' + n + '</label><input type="number" id="cr-' + k + '" value="10" min="0" inputmode="decimal"></div>'; }).join('') + '</div></div>' +
    '<p class="hint">เนื้อหาที่ถูกตัดจะถูกซ่อน ไม่ได้ลบออกจากไฟล์ ถ้าต้องการลบข้อมูลจริงให้ใช้เมนู "ถมดำข้อมูล"</p>',
  init: () => { const m = $('cr-mode'); m.onchange = () => { $('cr-m').hidden = m.value !== 'manual'; }; },
  run: async (files, prog) => {
    const f = files[0], doc = await PK.openLib(f), pages = doc.getPages(), auto = val('cr-mode') !== 'manual', mm = k => Math.max(0, parseFloat(val('cr-' + k)) || 0) * 72 / 25.4;
    const pdf = auto ? await PK.openJs(f) : null;
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i]; let t, b, l, r;
      if (auto) {
        prog('กำลังหาขอบหน้า ' + (i + 1) + ' จาก ' + pages.length, i / pages.length);
        const rr = await PK.renderPage(pdf, i + 1, 0.5, 600), c = rr.canvas, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
        for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) { const o = (y * c.width + x) * 4; if (d[o] < 242 || d[o + 1] < 242 || d[o + 2] < 242) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
        const k = rr.w / c.width, padv = 8; PK.free(c); rr.page.cleanup();
        if (x1 < 0) continue;
        l = Math.max(0, x0 * k - padv); t = Math.max(0, y0 * k - padv); r = Math.max(0, rr.w - (x1 + 1) * k - padv); b = Math.max(0, rr.h - (y1 + 1) * k - padv);
      } else { t = mm('t'); b = mm('b'); l = mm('l'); r = mm('r'); }
      const R = ((p.getRotation().angle % 360) + 360) % 360, box = p.getCropBox(); let T = t, B = b, Lf = l, Rt = r;
      if (R === 90) { Lf = t; B = l; Rt = b; T = r; } else if (R === 180) { B = t; T = b; Rt = l; Lf = r; } else if (R === 270) { Rt = t; T = l; Lf = b; B = r; }
      const w = box.width - Lf - Rt, h = box.height - T - B;
      if (w < 20 || h < 20) throw E('ระยะตัดมากเกินไป หน้ากระดาษจะไม่เหลือพื้นที่');
      p.setCropBox(box.x + Lf, box.y + B, w, h); p.setMediaBox(box.x + Lf, box.y + B, w, h);
      if (auto) await tick();
    }
    pdf && pdf.destroy();
    return { name: baseName(f) + '-ครอบตัด.pdf', blob: pdfBlob(await doc.save()), note: 'ครอบตัด ' + pages.length + ' หน้า' };
  } });

/* fill form fields */
let formInfo = [];
PK.add({ id: 'forms', cat: 'edit', icon: 'form', name: 'กรอกฟอร์ม PDF', desc: 'กรอกช่องในแบบฟอร์ม PDF แล้วบันทึก', act: 'บันทึกฟอร์ม',
  opts: () => '<div id="formbox" class="panel" style="padding:0;border:0"><p class="hint">เลือกไฟล์ก่อน แล้วช่องที่กรอกได้จะแสดงที่นี่</p></div>' + chk('fm-flat', 'ล็อกข้อมูลที่กรอก ไม่ให้แก้ต่อได้', false),
  onFiles: async files => {
    const box = $('formbox'); formInfo = []; if (!files.length) { box.innerHTML = '<p class="hint">เลือกไฟล์ก่อน แล้วช่องที่กรอกได้จะแสดงที่นี่</p>'; return; }
    const doc = await PK.openLib(files[0]); const P = L(); let h = '';
    doc.getForm().getFields().forEach(fd => {
      const i = formInfo.length, nm = esc(fd.getName()), id = 'ff' + i; let kind = '';
      try {
        if (fd instanceof P.PDFTextField) { kind = 'text'; h += '<div class="field"><label for="' + id + '">' + nm + '</label><input type="text" id="' + id + '" value="' + esc(fd.getText() || '') + '"></div>'; }
        else if (fd instanceof P.PDFCheckBox) { kind = 'check'; h += chk(id, nm, fd.isChecked()); }
        else if (fd instanceof P.PDFDropdown || fd instanceof P.PDFOptionList || fd instanceof P.PDFRadioGroup) {
          kind = fd instanceof P.PDFRadioGroup ? 'radio' : 'select'; const cur = fd instanceof P.PDFRadioGroup ? fd.getSelected() : (fd.getSelected()[0] || '');
          h += '<div class="field"><label for="' + id + '">' + nm + '</label><select id="' + id + '"><option value="">ไม่เลือก</option>' + fd.getOptions().map(o => '<option' + (o === cur ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select></div>';
        }
      } catch (e) { kind = ''; }
      if (kind) formInfo.push({ name: fd.getName(), kind });
    });
    box.innerHTML = h || '<p class="status err">ไฟล์นี้ไม่มีช่องฟอร์มให้กรอก ใช้เมนู "แก้ไข PDF" เพื่อพิมพ์ข้อความลงบนหน้าแทน</p>';
  },
  run: async files => {
    if (!formInfo.length) throw E('ไฟล์นี้ไม่มีช่องฟอร์มให้กรอก ใช้เมนู "แก้ไข PDF" แทน');
    const f = files[0], doc = await PK.openLib(f), form = doc.getForm(), pages = doc.getPages();
    for (let i = 0; i < formInfo.length; i++) {
      const info = formInfo[i], e = $('ff' + i); if (!e) continue; const fd = form.getField(info.name);
      if (info.kind === 'check') { e.checked ? fd.check() : fd.uncheck(); }
      else if (info.kind === 'radio' || info.kind === 'select') { if (e.value) fd.select(e.value); }
      else if (/[^\x00-\xFF]/.test(e.value)) {
        // Thai and other scripts are not in the built-in form fonts: print the text over the field instead
        const w = fd.acroField.getWidgets()[0], rc = w.getRectangle(), wref = doc.context.getObjectRef(w.dict);
        const pg = pages.find(p => p.ref === w.P()) || pages.find(p => { const an = p.node.Annots(); return an && an.asArray().indexOf(wref) >= 0; }) || pages[0];
        const c = await PK.textCanvas(e.value, { px: 64, weight: 400 }); const img = await doc.embedPng(await (await PK.toBlob(c, 'image/png')).arrayBuffer());
        let h = Math.min(rc.height * 0.9, 16), wd = h * c.width / c.height; if (wd > rc.width - 4) { wd = rc.width - 4; h = wd * c.height / c.width; } PK.free(c);
        form.removeField(fd); pg.drawImage(img, { x: rc.x + 2, y: rc.y + (rc.height - h) / 2, width: wd, height: h });
      } else fd.setText(e.value);
    }
    if (on('fm-flat')) { try { form.flatten(); } catch (e) { /* keep fields editable if flattening fails */ } }
    return { name: baseName(f) + '-กรอกแล้ว.pdf', blob: pdfBlob(await doc.save()), note: 'กรอก ' + formInfo.length + ' ช่อง' };
  } });

/* ================= ความปลอดภัย ================= */
PK.add({ id: 'unlock', cat: 'sec', icon: 'unlock', name: 'ปลดล็อก PDF', desc: 'เอารหัสผ่านออกจากไฟล์ที่คุณรู้รหัส', act: 'ปลดล็อก',
  opts: () => txt('ul-pw', 'รหัสผ่านของไฟล์', 'type="password"', 'ถ้าไฟล์เปิดอ่านได้แต่ห้ามพิมพ์หรือห้ามแก้ไข ให้เว้นว่างไว้'),
  run: async (files, prog) => {
    const f = files[0], pw = val('ul-pw'), bytes = await PK.bytes(f); prog('กำลังปลดล็อก', 0.3);
    try { const out = await PK.qpdf(['--password=' + pw, '--decrypt'], bytes); return { name: baseName(f) + '-ปลดล็อก.pdf', blob: pdfBlob(out), note: 'เอารหัสผ่านออกแล้ว เนื้อหาเดิมอยู่ครบ' }; }
    catch (e) { if (!e.noEngine) { let ok = null; try { ok = await PK.openJs(bytes, pw); } catch (e2) { throw E(e2.needPassword ? (pw ? 'รหัสผ่านไม่ถูกต้อง' : 'ไฟล์นี้ต้องใส่รหัสผ่าน') : 'ปลดล็อกไฟล์นี้ไม่ได้ ไฟล์อาจเสียหาย'); } ok.destroy(); } }
    const pdf = await PK.openJs(bytes, pw); const out = await PK.rasterPdf(pdf, prog, { scale: 2, q: 0.85 }); pdf.destroy();
    return { name: baseName(f) + '-ปลดล็อก.pdf', blob: pdfBlob(await out.save()), note: 'ปลดล็อกแบบเป็นภาพ ข้อความจะคัดลอกไม่ได้' };
  } });
PK.add({ id: 'protect', cat: 'sec', icon: 'lock', name: 'ใส่รหัส PDF', desc: 'ตั้งรหัสผ่านก่อนเปิดไฟล์ (AES-256)', act: 'ใส่รหัสผ่าน',
  opts: () => txt('pt-pw', 'รหัสผ่าน', 'type="password"') + txt('pt-pw2', 'พิมพ์รหัสผ่านอีกครั้ง', 'type="password"') + '<p class="hint">จดรหัสไว้ให้ดี ถ้าลืมจะเปิดไฟล์ไม่ได้อีก</p>',
  run: async (files, prog) => {
    const pw = val('pt-pw'); if (!pw) throw E('ตั้งรหัสผ่านก่อน'); if (pw !== val('pt-pw2')) throw E('รหัสผ่านสองช่องไม่ตรงกัน');
    const f = files[0]; prog('กำลังเข้ารหัส', 0.3);
    try { const out = await PK.qpdf(['--encrypt', pw, pw, '256', '--'], await PK.bytes(f)); return { name: baseName(f) + '-ใส่รหัส.pdf', blob: pdfBlob(out), note: 'เข้ารหัสแบบ AES-256 แล้ว ต้องใส่รหัสผ่านทุกครั้งที่เปิด' }; }
    catch (e) { throw E(e.noEngine ? 'เบราว์เซอร์นี้เปิดตัวเข้ารหัสไม่ได้ ลองเปิดหน้านี้ใน Chrome หรือ Safari รุ่นใหม่' : /password|encrypt/i.test(e.message) ? 'ไฟล์นี้มีรหัสอยู่แล้ว ปลดล็อกก่อนแล้วค่อยตั้งรหัสใหม่' : 'ใส่รหัสไฟล์นี้ไม่ได้ ลองซ่อมแซมไฟล์ก่อน'); }
  } });

/* ================= เพิ่มเติม ================= */
PK.add({ id: 'gray', cat: 'more', icon: 'drop', name: 'แปลงเป็นขาวดำ', desc: 'ทำทั้งไฟล์เป็นโทนเทา ประหยัดหมึกพิมพ์', act: 'แปลงเป็นขาวดำ',
  opts: () => '<p class="hint">แต่ละหน้าจะกลายเป็นภาพโทนเทา ข้อความจะคัดลอกไม่ได้</p>',
  run: async (files, prog) => { const pdf = await PK.openJs(files[0]); const out = await PK.rasterPdf(pdf, prog, { scale: 2, q: 0.8, fx: gray }); pdf.destroy(); return { name: baseName(files[0]) + '-ขาวดำ.pdf', blob: pdfBlob(await out.save()), note: 'แปลง ' + out.getPageCount() + ' หน้าเป็นโทนเทา' }; } });

PK.add({ id: 'nup', cat: 'more', icon: 'grid', name: 'หลายหน้าต่อแผ่น', desc: 'ย่อ 2 หรือ 4 หน้าลงกระดาษแผ่นเดียว', act: 'จัดหน้า',
  opts: () => sel('nu-n', 'จำนวนหน้าต่อแผ่น A4', [['2', '2 หน้า (แนวนอน)'], ['4', '4 หน้า (2 × 2)']]),
  run: async files => {
    const f = files[0], src = await PK.openLib(f), n = +val('nu-n') || 2, out = await L().PDFDocument.create(), emb = await out.embedPdf(await PK.bytes(f), src.getPageIndices());
    const PW = n === 2 ? 841.89 : 595.28, PH = n === 2 ? 595.28 : 841.89, cols = 2, rows = n === 2 ? 1 : 2, m = 14, cw = PW / cols, ch = PH / rows;
    for (let i = 0; i < emb.length; i += n) {
      const pg = out.addPage([PW, PH]);
      for (let j = 0; j < n && i + j < emb.length; j++) { const e = emb[i + j], k = Math.min((cw - 2 * m) / e.width, (ch - 2 * m) / e.height), w = e.width * k, h = e.height * k, c = j % cols, r = Math.floor(j / cols); pg.drawPage(e, { x: c * cw + (cw - w) / 2, y: PH - (r + 1) * ch + (ch - h) / 2, width: w, height: h }); }
    }
    return { name: baseName(f) + '-' + n + 'หน้าต่อแผ่น.pdf', blob: pdfBlob(await out.save()), note: 'จาก ' + emb.length + ' หน้า เหลือ ' + out.getPageCount() + ' แผ่น' };
  } });

PK.add({ id: 'a4', cat: 'more', icon: 'doc', name: 'ปรับขนาดเป็น A4', desc: 'ย่อหรือขยายทุกหน้าให้พอดี A4', act: 'ปรับเป็น A4',
  run: async files => {
    const f = files[0], src = await PK.openLib(f), out = await L().PDFDocument.create(), emb = await out.embedPdf(await PK.bytes(f), src.getPageIndices());
    emb.forEach(e => { const land = e.width > e.height, PW = land ? 841.89 : 595.28, PH = land ? 595.28 : 841.89, k = Math.min(PW / e.width, PH / e.height), w = e.width * k, h = e.height * k; out.addPage([PW, PH]).drawPage(e, { x: (PW - w) / 2, y: (PH - h) / 2, width: w, height: h }); });
    return { name: baseName(f) + '-A4.pdf', blob: pdfBlob(await out.save()), note: 'ปรับ ' + emb.length + ' หน้าเป็นขนาด A4' };
  } });

PK.add({ id: 'meta', cat: 'more', icon: 'info', name: 'แก้ข้อมูลไฟล์', desc: 'ตั้งชื่อเรื่อง ผู้เขียน คำค้นของ PDF', act: 'บันทึกข้อมูล',
  opts: () => txt('mt-title', 'ชื่อเรื่อง') + txt('mt-author', 'ผู้เขียน') + txt('mt-subject', 'หัวข้อ') + txt('mt-keys', 'คำค้น (คั่นด้วยจุลภาค)'),
  onFiles: async files => { if (!files.length) return; const d = await PK.openLib(files[0]); $('mt-title').value = d.getTitle() || ''; $('mt-author').value = d.getAuthor() || ''; $('mt-subject').value = d.getSubject() || ''; $('mt-keys').value = d.getKeywords() || ''; },
  run: async files => {
    const f = files[0], d = await PK.openLib(f); d.setTitle(val('mt-title')); d.setAuthor(val('mt-author')); d.setSubject(val('mt-subject'));
    d.setKeywords(val('mt-keys').split(',').map(s => s.trim()).filter(Boolean));
    return { name: baseName(f) + '-แก้ข้อมูล.pdf', blob: pdfBlob(await d.save()), note: 'บันทึกข้อมูลไฟล์แล้ว' };
  } });
})();
