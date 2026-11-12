/* editor: text, highlighter (strokes and shapes), pen, shapes, signature, images, redaction */
(function(){
"use strict";
const { $, esc, tick, baseName, pdfBlob, E } = PK;
const L = () => PDFLib;
const TL = {
  pan: ['เลื่อนดู', 'ลากเพื่อเลื่อนดูหน้าเอกสาร'],
  sel: ['เลือก ย้าย หมุน', 'แตะสิ่งที่ใส่ไว้เพื่อเลือก ลากเพื่อย้าย แล้วหมุน เปลี่ยนสี หรือปรับขนาดได้'],
  text: ['ข้อความ', 'แตะตรงที่จะพิมพ์ข้อความ'],
  hl: ['ไฮไลท์', 'ลากเพื่อเน้นข้อความ เลือกได้ทั้งแบบเส้นและแบบรูปร่าง'],
  pen: ['ปากกา', 'ลากนิ้วเพื่อวาด ขีดเส้นตรง หรือลูกศร'],
  shape: ['รูปร่าง', 'ลากเพื่อวาดสี่เหลี่ยม วงรี เส้นตรง หรือลูกศร'],
  white: ['ลบทับขาว', 'ลากคลุมส่วนที่จะปิดด้วยสีขาว แล้วพิมพ์ข้อความใหม่ทับได้ ข้อมูลเดิมยังอยู่ในไฟล์'],
  redact: ['ถมดำ', 'ลากคลุมข้อมูลที่จะลบ หน้าที่ถมดำจะถูกแปลงเป็นภาพ ข้อมูลใต้แถบดำจึงถูกลบจริง'],
  sign: ['ลายเซ็น', 'วาดลายเซ็น แล้วแตะตรงที่จะวาง'],
  image: ['รูปภาพ', 'เลือกรูป แล้วแตะตรงที่จะวาง']
};
const SETS = { edit: ['text', 'hl', 'pen', 'shape', 'white', 'sign', 'image', 'sel', 'pan'], sign: ['sign', 'text', 'image', 'sel', 'pan'], redact: ['redact', 'sel', 'pan'] };
const PAL = ['#111111', '#6b7280', '#ffffff', '#d11a1a', '#f97316', '#f59e0b', '#facc15', '#84cc16', '#16a34a', '#14b8a6', '#06b6d4', '#2563eb', '#16307a', '#7c3aed', '#d946ef', '#ec4899'];
const HPAL = ['#ffd60a', '#ffa94d', '#ff6b6b', '#ff8fc7', '#d0a2ff', '#7cc7ff', '#66d9e8', '#63e6be', '#7cf58a', '#c0eb75'];
const TSIZE = { s: 10, m: 14, l: 20, x: 28 }, LSIZE = { s: 1, m: 2.5, l: 4, x: 7 }, HSIZE = { s: 8, m: 14, l: 22, x: 32 };
const MODES = {
  hl: [['free', 'เส้นอิสระ'], ['line', 'เส้นตรง'], ['rect', 'สี่เหลี่ยม'], ['ellipse', 'วงรี']],
  pen: [['free', 'เส้นอิสระ'], ['line', 'เส้นตรง'], ['arrow', 'ลูกศร']],
  shape: [['rect', 'สี่เหลี่ยม'], ['ellipse', 'วงรี'], ['line', 'เส้นตรง'], ['arrow', 'ลูกศร']]
};
let ED = null;

const hexRgb = h => { const n = parseInt(h.slice(1), 16); return L().rgb((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255); };
const bbox = a => { if (a.type !== 'pen') return a; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; a.pts.forEach(p => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }); return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; };
const center = a => { const b = bbox(a); return [b.x + b.w / 2, b.y + b.h / 2]; };
const rotPt = (p, c, deg) => { if (!deg) return p; const r = deg * Math.PI / 180, s = Math.sin(r), k = Math.cos(r), dx = p[0] - c[0], dy = p[1] - c[1]; return [c[0] + dx * k - dy * s, c[1] + dx * s + dy * k]; };
const color = () => ED.tool === 'hl' ? ED.hc : ED.c;
const snapEnd = (s, p, step) => { if (!step) return p; const dx = p[0] - s[0], dy = p[1] - s[1], len = Math.hypot(dx, dy), st = step * Math.PI / 180, an = Math.round(Math.atan2(dy, dx) / st) * st; return [s[0] + Math.cos(an) * len, s[1] + Math.sin(an) * len]; };
const arrowHead = a => { const n = a.pts.length, e = a.pts[n - 1]; let i = n - 2; while (i > 0 && Math.hypot(e[0] - a.pts[i][0], e[1] - a.pts[i][1]) < 2) i--; const s = a.pts[i], an = Math.atan2(e[1] - s[1], e[0] - s[0]), sz = Math.max(9, a.lw * 4.5); return [e, [e[0] - sz * Math.cos(an - 0.45), e[1] - sz * Math.sin(an - 0.45)], [e[0] - sz * Math.cos(an + 0.45), e[1] - sz * Math.sin(an + 0.45)]]; };

function view(root, t) {
  ED = { mode: t.mode, file: null, pdf: null, n: 0, cur: 1, annots: [], tool: SETS[t.mode][0], c: t.mode === 'sign' ? '#16307a' : '#111111', hc: HPAL[0], size: 'm', sel: null, vw: 1, vh: 1, zoom: 1, stamp: null, sig: null, drag: null, token: 0,
    hlMode: 'free', penMode: 'free', shapeMode: 'rect', fill: 'n', alpha: 0.4, lock: 0 };
  root.style.cssText = 'display:flex;flex-direction:column;gap:18px';
  root.innerHTML =
    '<section class="panel" id="ed-pick"><label class="drop"><input type="file" id="ed-file" accept="application/pdf,.pdf"><span class="pick">เลือกไฟล์ PDF</span><span class="small muted">เลือกได้ครั้งละ 1 ไฟล์</span></label></section>' +
    '<section class="panel ed" id="ed" hidden>' +
      '<div class="edtools" id="ed-tools" role="toolbar" aria-label="เครื่องมือแก้ไข"></div>' +
      '<div class="edrow" id="ed-style"></div>' +
      '<p class="hint" id="ed-tip"></p>' +
      '<div class="selbar edrow" id="ed-sel" hidden></div>' +
      '<div class="edstage" id="ed-stage"><div class="edpage" id="ed-page"><canvas id="ed-base"></canvas><canvas class="ov" id="ed-ov"></canvas></div></div>' +
      '<div class="ednav"><button type="button" class="ib" id="ed-prev" aria-label="หน้าก่อน">◀</button><span id="ed-pg"></span><button type="button" class="ib" id="ed-next" aria-label="หน้าถัดไป">▶</button>' +
        '<button type="button" class="ib" id="ed-zo" aria-label="ย่อ">−</button><button type="button" class="ib" id="ed-zi" aria-label="ขยาย">+</button><button type="button" class="chip" id="ed-undo">ย้อนกลับ</button></div>' +
      '<button type="button" class="chip" id="ed-change" style="align-self:flex-start">เปลี่ยนไฟล์</button>' +
    '</section>' +
    '<button type="button" class="run" id="run" disabled>บันทึก PDF</button>' +
    '<div><div class="bar" id="bar" hidden><i></i></div><p class="status" id="status" role="status" aria-live="polite"></p></div>' +
    '<section class="panel result" id="result" hidden></section>' +
    '<input type="file" id="ed-img" accept="image/*" aria-label="เลือกรูปที่จะวาง" style="position:absolute;width:1px;height:1px;opacity:0">' +
    '<div id="ed-modal"></div>';
  $('ed-file').onchange = () => { const f = $('ed-file').files[0]; $('ed-file').value = ''; if (f) openFile(f); };
  $('ed-change').onclick = () => { $('ed').hidden = true; $('ed-pick').hidden = false; $('run').disabled = true; PK.hideResult(); };
  $('ed-prev').onclick = () => goPage(ED.cur - 1); $('ed-next').onclick = () => goPage(ED.cur + 1);
  $('ed-zi').onclick = () => zoom(1); $('ed-zo').onclick = () => zoom(-1);
  $('ed-undo').onclick = () => { if (ED.annots.length) { const a = ED.annots.pop(); if (ED.sel === a) ED.sel = null; drawOv(); drawSel(); } };
  $('ed-tools').onclick = e => { const b = e.target.closest('[data-t]'); if (b) setTool(b.getAttribute('data-t'), true); };
  $('ed-style').onclick = e => { const b = e.target.closest('[data-c]'); if (b) pickColor(b.getAttribute('data-c')); };
  $('ed-sel').onclick = selClick;
  $('ed-img').onchange = async () => { const f = $('ed-img').files[0]; $('ed-img').value = ''; if (!f) return; try { ED.stamp = await stampFromImage(f); tip('แตะบนหน้าเอกสารตรงที่จะวางรูป'); } catch (e) { PK.setStatus(e.message, true); } };
  $('run').onclick = save;
  const ov = $('ed-ov'); ov.onpointerdown = down; ov.onpointermove = move; ov.onpointerup = up; ov.onpointercancel = up;
  PK.leave = () => { if (ED && ED.pdf) { try { ED.pdf.destroy(); } catch (e) { /* already closed */ } } ED = null; };
  drawTools(); drawStyle();
}

async function openFile(f) {
  PK.setStatus('กำลังเปิดไฟล์'); PK.hideResult();
  try {
    PK.needLibs(); const pdf = await PK.openJs(f);
    if (ED.pdf) { try { ED.pdf.destroy(); } catch (e) { /* ignore */ } }
    Object.assign(ED, { file: f, pdf, n: pdf.numPages, cur: 1, annots: [], sel: null, zoom: 1, stamp: null });
    $('ed-pick').hidden = true; $('ed').hidden = false; $('run').disabled = false; PK.setStatus('');
    await renderCur(); setTool(SETS[ED.mode][0], true);
  } catch (e) { PK.setStatus(e.message || 'เปิดไฟล์ไม่ได้', true); }
}
async function renderCur() {
  const my = ++ED.token, stage = $('ed-stage'), pg = $('ed-page');
  const page = await ED.pdf.getPage(ED.cur), v1 = page.getViewport({ scale: 1 }); if (!ED || my !== ED.token) return;
  ED.vw = v1.width; ED.vh = v1.height;
  const cssW = Math.max(200, stage.clientWidth - 18) * ED.zoom, dpr = Math.min(2, window.devicePixelRatio || 1), s = Math.min(cssW * dpr, 2600) / v1.width;
  const vp = page.getViewport({ scale: s }), tmp = document.createElement('canvas'); tmp.width = Math.round(vp.width); tmp.height = Math.round(vp.height);
  const tc = tmp.getContext('2d'); tc.fillStyle = '#fff'; tc.fillRect(0, 0, tmp.width, tmp.height);
  await page.render({ canvasContext: tc, viewport: vp }).promise; if (!ED || my !== ED.token) return;
  const base = $('ed-base'), ov = $('ed-ov'); base.width = ov.width = tmp.width; base.height = ov.height = tmp.height; base.getContext('2d').drawImage(tmp, 0, 0); PK.free(tmp);
  pg.style.width = cssW + 'px'; $('ed-pg').textContent = 'หน้า ' + ED.cur + ' / ' + ED.n;
  $('ed-prev').disabled = ED.cur <= 1; $('ed-next').disabled = ED.cur >= ED.n;
  drawOv();
}
function goPage(n) { if (!ED.pdf || n < 1 || n > ED.n) return; ED.cur = n; ED.sel = null; drawSel(); renderCur(); }
function zoom(d) { const z = [1, 1.5, 2, 3], i = Math.max(0, Math.min(z.length - 1, z.indexOf(ED.zoom) + d)); if (z[i] !== ED.zoom) { ED.zoom = z[i]; renderCur(); } }

function drawTools() {
  $('ed-tools').innerHTML = SETS[ED.mode].map(k => '<button type="button" class="chip' + (ED.tool === k ? ' on' : '') + '" data-t="' + k + '" aria-pressed="' + (ED.tool === k) + '">' + TL[k][0] + '</button>').join('');
}
const pick = (id, label, opts, cur) => '<select id="' + id + '" aria-label="' + label + '" style="width:auto;flex:1 1 130px;min-width:120px">' + opts.map(o => '<option value="' + o[0] + '"' + (String(o[0]) === String(cur) ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>';
const LOCKS = [[0, 'องศาอิสระ'], [15, 'ล็อกทุก 15°'], [45, 'ล็อกทุก 45°'], [90, 'ล็อกแนวนอน แนวตั้ง']];
function drawStyle() {
  const t = ED.tool, box = $('ed-style'), a = ED.sel;
  if (['pan', 'white', 'redact', 'image'].indexOf(t) >= 0 || (t === 'sel' && (!a || !a.color))) { box.innerHTML = t === 'sel' ? pick('ed-lock', 'ล็อกองศา', LOCKS, ED.lock) : ''; bindStyle(); return; }
  const isHl = t === 'hl' || (t === 'sel' && a && a.mul), pal = isHl ? HPAL.concat(PAL) : PAL.concat(HPAL), cur = t === 'sel' ? a.color : color();
  let h = '<div class="edrow" style="width:100%;gap:8px;flex-wrap:nowrap;overflow-x:auto;padding:4px 2px 8px" role="group" aria-label="สี">' + pal.map(c => '<button type="button" class="sw' + (c === cur ? ' on' : '') + '" data-c="' + c + '" style="background:' + c + '" aria-label="สี ' + c + '" aria-pressed="' + (c === cur) + '"></button>').join('') +
    '<label class="chip" style="display:flex;align-items:center;gap:8px;cursor:pointer;flex:none;white-space:nowrap;order:-1">สีอื่น<input type="color" id="ed-custom" value="' + cur + '" style="width:30px;height:30px;padding:0;border:0;background:none"></label></div>';
  if (MODES[t]) h += pick('ed-mode', 'รูปแบบ', MODES[t], ED[t + 'Mode']);
  const sz = t === 'text' ? ['ตัวเล็ก', 'ตัวปกติ', 'ตัวใหญ่', 'ตัวใหญ่มาก'] : ['เส้นบาง', 'เส้นปกติ', 'เส้นหนา', 'เส้นหนามาก'];
  if (['text', 'pen', 'shape', 'hl'].indexOf(t) >= 0) h += pick('ed-size', 'ขนาด', ['s', 'm', 'l', 'x'].map((k, i) => [k, sz[i]]), ED.size);
  if (t === 'hl') h += pick('ed-alpha', 'ความเข้ม', [[0.25, 'สีจาง'], [0.4, 'สีปกติ'], [0.6, 'สีเข้ม']], ED.alpha);
  if (t === 'shape') h += pick('ed-fill', 'การเติมสี', [['n', 'เฉพาะเส้นขอบ'], ['y', 'เติมสีทึบ'], ['h', 'เติมสีโปร่ง']], ED.fill);
  if (['hl', 'pen', 'shape', 'sel'].indexOf(t) >= 0) h += pick('ed-lock', 'ล็อกองศา', LOCKS, ED.lock);
  if (t === 'sign' && ED.sig) h += '<button type="button" class="chip" id="ed-resign">วาดลายเซ็นใหม่</button>';
  box.innerHTML = h; bindStyle();
}
function bindStyle() {
  const on = (id, fn) => { const e = $(id); if (e) e.onchange = () => fn(e.value); };
  on('ed-size', v => { ED.size = v; }); on('ed-alpha', v => { ED.alpha = +v; }); on('ed-fill', v => { ED.fill = v; }); on('ed-lock', v => { ED.lock = +v; drawSel(); });
  on('ed-mode', v => { ED[ED.tool + 'Mode'] = v; });
  if ($('ed-custom')) { $('ed-custom').oninput = () => pickColor($('ed-custom').value, true); $('ed-custom').onchange = () => drawStyle(); }
  if ($('ed-resign')) $('ed-resign').onclick = signPad;
}
async function pickColor(c, keep) {
  if (ED.tool === 'sel' && ED.sel) { const a = ED.sel; a.color = c; if (a.type === 'text') a.el = await PK.textCanvas(a.text, { px: 72, color: c, weight: 400 }); drawOv(); }
  else if (ED.tool === 'hl') ED.hc = c; else ED.c = c;
  if (!keep) drawStyle();
}
const tip = s => { const e = $('ed-tip'); if (e) e.textContent = s; };
function setTool(k, user) {
  ED.tool = k; ED.stamp = null; if (k !== 'sel') { ED.sel = null; drawSel(); }
  $('ed-ov').style.touchAction = k === 'pan' ? 'auto' : 'none'; $('ed-ov').style.cursor = k === 'pan' ? 'default' : k === 'sel' ? 'move' : 'crosshair';
  drawTools(); drawStyle(); tip(TL[k][1]); drawOv();
  if (!user || !ED.pdf) return;
  if (k === 'sign') { if (ED.sig) { ED.stamp = ED.sig; tip('แตะบนหน้าเอกสารตรงที่จะวางลายเซ็น'); } else signPad(); }
  if (k === 'image') $('ed-img').click();
}

/* ---------- overlay ---------- */
function ellipsePath(g, a, k) { g.beginPath(); g.ellipse((a.x + a.w / 2) * k, (a.y + a.h / 2) * k, Math.abs(a.w / 2) * k, Math.abs(a.h / 2) * k, 0, 0, Math.PI * 2); }
function drawOv() {
  const ov = $('ed-ov'); if (!ov || !ED) return; const g = ov.getContext('2d'), k = ov.width / ED.vw; g.clearRect(0, 0, ov.width, ov.height);
  const list = ED.annots.filter(a => a.page === ED.cur); if (ED.drag && ED.drag.a && ED.annots.indexOf(ED.drag.a) < 0) list.push(ED.drag.a);
  list.forEach(a => {
    g.save(); const c = center(a);
    if (a.rot) { g.translate(c[0] * k, c[1] * k); g.rotate(a.rot * Math.PI / 180); g.translate(-c[0] * k, -c[1] * k); }
    if (a.mul) g.globalCompositeOperation = 'multiply';
    if (a.type === 'white') { g.fillStyle = '#fff'; g.fillRect(a.x * k, a.y * k, a.w * k, a.h * k); g.strokeStyle = '#b8c0cc'; g.setLineDash([4, 4]); g.lineWidth = 1; g.strokeRect(a.x * k, a.y * k, a.w * k, a.h * k); }
    else if (a.type === 'redact') { g.fillStyle = '#000'; g.fillRect(a.x * k, a.y * k, a.w * k, a.h * k); }
    else if (a.type === 'shape') {
      a.kind === 'ellipse' ? ellipsePath(g, a, k) : (g.beginPath(), g.rect(a.x * k, a.y * k, a.w * k, a.h * k));
      if (a.fill) { g.globalAlpha = a.alpha; g.fillStyle = a.color; g.fill(); } else { g.strokeStyle = a.color; g.lineWidth = a.lw * k; g.stroke(); }
    }
    else if (a.type === 'pen') {
      g.globalAlpha = a.alpha; g.strokeStyle = g.fillStyle = a.color; g.lineWidth = a.lw * k; g.lineJoin = 'round'; g.lineCap = a.cap === 'butt' ? 'butt' : 'round';
      g.beginPath(); a.pts.forEach((p, i) => i ? g.lineTo(p[0] * k, p[1] * k) : g.moveTo(p[0] * k, p[1] * k)); g.stroke();
      if (a.arrow && a.pts.length > 1) { const h = arrowHead(a); g.beginPath(); h.forEach((p, i) => i ? g.lineTo(p[0] * k, p[1] * k) : g.moveTo(p[0] * k, p[1] * k)); g.closePath(); g.fill(); }
    }
    else if (a.el) g.drawImage(a.el, a.x * k, a.y * k, a.w * k, a.h * k);
    if (ED.sel === a) { const b = bbox(a); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.strokeStyle = '#1d4ed8'; g.setLineDash([6, 4]); g.lineWidth = 2; g.strokeRect(b.x * k - 5, b.y * k - 5, b.w * k + 10, b.h * k + 10); }
    g.restore();
  });
}
function drawSel() {
  const box = $('ed-sel'); if (!box) return; const a = ED.sel; if (!a) { box.hidden = true; box.innerHTML = ''; if (ED.tool === 'sel') drawStyle(); return; }
  box.hidden = false; const step = ED.lock || 1, r = Math.round(a.rot || 0);
  box.innerHTML = (a.type === 'text' ? '<button type="button" class="chip" data-s="edit">แก้ข้อความ</button>' : '') +
    '<button type="button" class="chip" data-s="big">ใหญ่ขึ้น</button><button type="button" class="chip" data-s="small">เล็กลง</button>' +
    (a.type === 'pen' || (a.type === 'shape' && !a.fill) ? '<button type="button" class="chip" data-s="thick">เส้นหนาขึ้น</button><button type="button" class="chip" data-s="thin">เส้นบางลง</button>' : '') +
    '<button type="button" class="chip" data-s="del" style="color:var(--bad)">ลบ</button>' +
    '<div class="edrow" style="width:100%;flex-wrap:nowrap"><button type="button" class="ib" data-s="ccw" aria-label="หมุนทวนเข็ม">↺</button><input type="range" id="ed-rot" min="-180" max="180" step="' + step + '" value="' + r + '" aria-label="หมุน" style="flex:1;min-width:0"><button type="button" class="ib" data-s="cw" aria-label="หมุนตามเข็ม">↻</button><span class="small" id="ed-rotv" style="min-width:44px;text-align:right;font-variant-numeric:tabular-nums">' + r + '°</span></div>';
  $('ed-rot').oninput = () => { a.rot = +$('ed-rot').value; $('ed-rotv').textContent = a.rot + '°'; drawOv(); };
  if (ED.tool === 'sel') drawStyle();
}
function selClick(e) {
  const b = e.target.closest('[data-s]'), a = ED.sel; if (!b || !a) return; const o = b.getAttribute('data-s');
  if (o === 'del') { ED.annots.splice(ED.annots.indexOf(a), 1); ED.sel = null; }
  else if (o === 'edit') { textModal(a); return; }
  else if (o === 'cw' || o === 'ccw') { const st = ED.lock || 15; let r = Math.round(((a.rot || 0) + (o === 'cw' ? st : -st)) / st) * st; if (r > 180) r -= 360; if (r < -180) r += 360; a.rot = r; }
  else if (o === 'thick' || o === 'thin') a.lw = Math.max(0.5, Math.min(60, a.lw * (o === 'thick' ? 1.3 : 1 / 1.3)));
  else { const f = o === 'big' ? 1.2 : 1 / 1.2;
    if (a.type === 'pen') { const c = center(a); a.pts = a.pts.map(p => [c[0] + (p[0] - c[0]) * f, c[1] + (p[1] - c[1]) * f]); }
    else { const c = center(a); a.w *= f; a.h *= f; a.x = c[0] - a.w / 2; a.y = c[1] - a.h / 2; if (a.type === 'text') a.size *= f; } }
  drawOv(); drawSel();
}

/* ---------- pointer ---------- */
const toPt = e => { const r = $('ed-ov').getBoundingClientRect(); return [(e.clientX - r.left) / r.width * ED.vw, (e.clientY - r.top) / r.height * ED.vh]; };
const hit = p => { for (let i = ED.annots.length - 1; i >= 0; i--) { const a = ED.annots[i]; if (a.page !== ED.cur) continue; const b = bbox(a), s = 8 + (a.type === 'pen' ? a.lw / 2 : 0), q = rotPt(p, center(a), -(a.rot || 0)); if (q[0] >= b.x - s && q[0] <= b.x + b.w + s && q[1] >= b.y - s && q[1] <= b.y + b.h + s) return a; } return null; };
function down(e) {
  if (!ED || !ED.pdf || ED.tool === 'pan' || PK.busy) return; e.preventDefault();
  try { $('ed-ov').setPointerCapture(e.pointerId); } catch (er) { /* capture is optional */ }
  const p = toPt(e), t = ED.tool, base = { page: ED.cur, rot: 0, color: color() };
  if (t === 'sel') { const a = hit(p); ED.sel = a; ED.drag = a ? { move: a, last: p } : null; drawOv(); drawSel(); return; }
  if (t === 'white' || t === 'redact') { ED.drag = { start: p, a: Object.assign(base, { type: t, x: p[0], y: p[1], w: 0, h: 0 }) }; return; }
  const m = t === 'hl' ? ED.hlMode : t === 'pen' ? ED.penMode : t === 'shape' ? ED.shapeMode : '';
  if (!m) { ED.drag = { tap: p }; return; }
  if (m === 'rect' || m === 'ellipse') {
    const fill = t === 'hl' || ED.fill !== 'n', soft = t === 'hl' || ED.fill === 'h';
    ED.drag = { start: p, a: Object.assign(base, { type: 'shape', kind: m, x: p[0], y: p[1], w: 0, h: 0, fill, alpha: fill && soft ? (t === 'hl' ? ED.alpha : 0.35) : 1, mul: fill && soft, lw: LSIZE[ED.size] }) };
  } else {
    const hl = t === 'hl';
    ED.drag = { start: p, straight: m !== 'free', a: Object.assign(base, { type: 'pen', pts: [p], lw: hl ? HSIZE[ED.size] : LSIZE[ED.size], alpha: hl ? ED.alpha : 1, mul: hl, cap: hl && m === 'line' ? 'butt' : 'round', arrow: m === 'arrow' }) };
  }
}
function move(e) {
  const d = ED && ED.drag; if (!d) return; e.preventDefault(); const p = toPt(e);
  if (d.move) { const dx = p[0] - d.last[0], dy = p[1] - d.last[1], a = d.move; if (a.type === 'pen') a.pts = a.pts.map(q => [q[0] + dx, q[1] + dy]); else { a.x += dx; a.y += dy; } d.last = p; }
  else if (d.a && d.a.type === 'pen') { if (d.straight) d.a.pts = [d.start, snapEnd(d.start, p, ED.lock || (e.shiftKey ? 15 : 0))]; else d.a.pts.push(p); }
  else if (d.a) { const s = d.start; d.a.x = Math.min(s[0], p[0]); d.a.y = Math.min(s[1], p[1]); d.a.w = Math.abs(p[0] - s[0]); d.a.h = Math.abs(p[1] - s[1]); }
  else return;
  drawOv();
}
function up(e) {
  const d = ED && ED.drag; if (!d) return; ED.drag = null;
  if (d.a) { const a = d.a, b = bbox(a); if (a.type === 'pen' ? (a.pts.length > 1 && Math.hypot(b.w, b.h) > 3) : (a.w > 3 && a.h > 3)) ED.annots.push(a); drawOv(); return; }
  if (d.tap && e.type === 'pointerup') {
    const t = ED.tool, p = d.tap;
    if (t === 'text') textModal(null, p);
    else if (t === 'sign' || t === 'image') {
      if (!ED.stamp) { t === 'sign' ? signPad() : $('ed-img').click(); return; }
      const s = ED.stamp, w = ED.vw * (t === 'sign' ? 0.3 : 0.4), h = w * s.ratio;
      const a = { type: 'img', page: ED.cur, rot: 0, x: p[0] - w / 2, y: p[1] - h / 2, w, h, el: s.el, url: s.url };
      ED.annots.push(a); setTool('sel'); ED.sel = a; drawOv(); drawSel(); tip('ลากเพื่อย้าย ใช้ปุ่มด้านบนเพื่อปรับขนาด หมุน หรือลบ');
    }
  }
}

/* ---------- dialogs ---------- */
function modal(html) { const m = $('ed-modal'); m.innerHTML = '<div class="modal" role="dialog" aria-modal="true"><div class="panel">' + html + '</div></div>'; return m; }
const closeModal = () => { const m = $('ed-modal'); if (m) m.innerHTML = ''; };
function textModal(a, p) {
  modal('<h2>' + (a ? 'แก้ข้อความ' : 'พิมพ์ข้อความ') + '</h2><div class="field"><label for="ed-txt">ข้อความ</label><textarea id="ed-txt"></textarea></div><div class="btnrow"><button type="button" class="run" id="ed-ok">ตกลง</button><button type="button" class="run ghost" id="ed-no">ยกเลิก</button></div>');
  const ta = $('ed-txt'); ta.value = a ? a.text : ''; ta.focus();
  $('ed-no').onclick = closeModal;
  $('ed-ok').onclick = async () => {
    const text = ta.value.replace(/\s+$/, ''); closeModal(); if (!text.trim()) return;
    const size = a ? a.size : TSIZE[ED.size], col = a ? a.color : ED.c;
    const cv = await PK.textCanvas(text, { px: 72, color: col, weight: 400 }), w = cv.width * size / 72, h = cv.height * size / 72;
    if (a) Object.assign(a, { text, el: cv, w, h });
    else { a = { type: 'text', page: ED.cur, rot: 0, x: p[0], y: p[1] - h / 2, w, h, text, size, color: col, el: cv }; ED.annots.push(a); setTool('sel'); tip('ลากเพื่อย้าย ใช้ปุ่มด้านบนเพื่อแก้ ปรับขนาด หมุน หรือลบ'); }
    ED.sel = a; drawOv(); drawSel();
  };
}
function signPad() {
  modal('<h2>วาดลายเซ็น</h2><canvas class="pad" id="ed-pad" width="900" height="380" aria-label="พื้นที่วาดลายเซ็น"></canvas><p class="hint">ใช้นิ้วเซ็นในกรอบ เลือกสีได้จากแถบสีก่อนเปิดหน้านี้</p><div class="btnrow"><button type="button" class="run" id="ed-ok">ใช้ลายเซ็นนี้</button><button type="button" class="run ghost" id="ed-clear">ล้าง</button><button type="button" class="run ghost" id="ed-no">ยกเลิก</button></div>');
  const c = $('ed-pad'), g = c.getContext('2d'); let on = false, any = false, last = null;
  g.strokeStyle = ED.c; g.lineWidth = 5; g.lineCap = g.lineJoin = 'round';
  const pt = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * c.width, (e.clientY - r.top) / r.height * c.height]; };
  c.onpointerdown = e => { e.preventDefault(); try { c.setPointerCapture(e.pointerId); } catch (er) { /* optional */ } on = true; last = pt(e); g.beginPath(); g.arc(last[0], last[1], 2.5, 0, 7); g.fillStyle = ED.c; g.fill(); any = true; };
  c.onpointermove = e => { if (!on) return; e.preventDefault(); const p = pt(e); g.beginPath(); g.moveTo(last[0], last[1]); g.lineTo(p[0], p[1]); g.stroke(); last = p; };
  c.onpointerup = c.onpointercancel = () => { on = false; };
  $('ed-clear').onclick = () => { g.clearRect(0, 0, c.width, c.height); any = false; };
  $('ed-no').onclick = closeModal;
  $('ed-ok').onclick = () => {
    if (!any) { closeModal(); return; }
    const d = g.getImageData(0, 0, c.width, c.height).data; let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const w = Math.max(4, x1 - x0 + 12), h = Math.max(4, y1 - y0 + 12), o = document.createElement('canvas'); o.width = w; o.height = h; o.getContext('2d').drawImage(c, x0 - 6, y0 - 6, w, h, 0, 0, w, h);
    ED.sig = ED.stamp = { el: o, url: o.toDataURL('image/png'), ratio: h / w }; closeModal(); drawStyle(); tip('แตะบนหน้าเอกสารตรงที่จะวางลายเซ็น');
  };
}
async function stampFromImage(f) {
  const im = await PK.loadImage(f), s = Math.min(1, 1600 / Math.max(im.w, im.h)), c = document.createElement('canvas'); c.width = Math.round(im.w * s); c.height = Math.round(im.h * s);
  c.getContext('2d').drawImage(im.el, 0, 0, c.width, c.height); im.close();
  return { el: c, url: c.toDataURL('image/png'), ratio: c.height / c.width };
}

/* ---------- save ---------- */
const F = n => n.toFixed(2);
const poly = (pts, close) => pts.map((q, i) => (i ? 'L' : 'M') + F(q[0]) + ' ' + F(q[1])).join(' ') + (close ? ' Z' : '');
function shapePath(a) {
  const c = center(a), R = p => rotPt(p, c, a.rot || 0);
  if (a.kind !== 'ellipse') return poly([[a.x, a.y], [a.x + a.w, a.y], [a.x + a.w, a.y + a.h], [a.x, a.y + a.h]].map(R), true);
  const rx = a.w / 2, ry = a.h / 2, k = 0.5523, cx = c[0], cy = c[1], P = (x, y) => { const q = R([x, y]); return F(q[0]) + ' ' + F(q[1]); };
  return 'M' + P(cx + rx, cy) + ' C' + P(cx + rx, cy + ry * k) + ' ' + P(cx + rx * k, cy + ry) + ' ' + P(cx, cy + ry) + ' C' + P(cx - rx * k, cy + ry) + ' ' + P(cx - rx, cy + ry * k) + ' ' + P(cx - rx, cy) +
    ' C' + P(cx - rx, cy - ry * k) + ' ' + P(cx - rx * k, cy - ry) + ' ' + P(cx, cy - ry) + ' C' + P(cx + rx * k, cy - ry) + ' ' + P(cx + rx, cy - ry * k) + ' ' + P(cx + rx, cy) + ' Z';
}
function save() {
  PK.exec(async prog => {
    if (!ED.annots.length) throw E(ED.mode === 'redact' ? 'ยังไม่ได้ถมดำส่วนไหน ลากคลุมข้อมูลที่จะลบก่อน' : ED.mode === 'sign' ? 'ยังไม่ได้วางลายเซ็น' : 'ยังไม่ได้แก้ไขอะไร ลองใส่ข้อความหรือไฮไลท์ก่อน');
    const f = ED.file, doc = await PK.openLib(f), pages = doc.getPages(), emb = new Map(), P = L();
    prog('กำลังเขียนลงไฟล์', 0.2);
    for (const a of ED.annots) if (a.el && !emb.has(a.el)) emb.set(a.el, await doc.embedPng(a.type === 'img' && a.url ? a.url : a.el.toDataURL('image/png')));
    const byPage = {}; ED.annots.forEach(a => { (byPage[a.page] = byPage[a.page] || []).push(a); });
    Object.keys(byPage).forEach(pn => { const p = pages[pn - 1]; if (!p) return;
      PK.inView(p, (vw, vh) => byPage[pn].forEach(a => {
        const o = { x: 0, y: vh }, bm = a.mul ? { blendMode: P.BlendMode.Multiply } : {};
        if (a.type === 'white') p.drawSvgPath(shapePath(a), Object.assign(o, { color: P.rgb(1, 1, 1) }));
        else if (a.type === 'redact') p.drawSvgPath(shapePath(a), Object.assign(o, { color: P.rgb(0, 0, 0) }));
        else if (a.type === 'shape') p.drawSvgPath(shapePath(a), Object.assign(o, bm, a.fill ? { color: hexRgb(a.color), opacity: a.alpha } : { borderColor: hexRgb(a.color), borderWidth: a.lw }));
        else if (a.type === 'pen') {
          const c = center(a), R = q => rotPt(q, c, a.rot || 0);
          p.drawSvgPath(poly(a.pts.map(R)), Object.assign({ x: 0, y: vh }, bm, { borderColor: hexRgb(a.color), borderWidth: a.lw, borderOpacity: a.alpha, borderLineCap: a.cap === 'butt' ? P.LineCapStyle.Butt : P.LineCapStyle.Round }));
          if (a.arrow) p.drawSvgPath(poly(arrowHead(a).map(R), true), { x: 0, y: vh, color: hexRgb(a.color), opacity: a.alpha });
        }
        else if (a.el) { const r = -(a.rot || 0) * Math.PI / 180, cx = a.x + a.w / 2, cy = vh - (a.y + a.h / 2); p.drawImage(emb.get(a.el), { x: cx - (a.w / 2 * Math.cos(r) - a.h / 2 * Math.sin(r)), y: cy - (a.w / 2 * Math.sin(r) + a.h / 2 * Math.cos(r)), width: a.w, height: a.h, rotate: P.degrees(-(a.rot || 0)) }); }
      }));
    });
    let bytes = await doc.save(), note = 'แก้ไข ' + Object.keys(byPage).length + ' หน้า';
    const red = Array.from(new Set(ED.annots.filter(a => a.type === 'redact').map(a => a.page))).sort((x, y) => x - y);
    if (red.length) {
      const pdf = await PK.openJs(bytes), src = await P.PDFDocument.load(bytes), out = await P.PDFDocument.create(), copied = await out.copyPages(src, src.getPageIndices());
      for (let i = 0; i < copied.length; i++) {
        if (red.indexOf(i + 1) < 0) { out.addPage(copied[i]); continue; }
        prog('กำลังลบข้อมูลในหน้า ' + (i + 1), 0.4 + 0.5 * i / copied.length);
        const r = await PK.renderPage(pdf, i + 1, 2.2, 3400), img = await out.embedJpg(await (await PK.toBlob(r.canvas, 'image/jpeg', 0.88)).arrayBuffer()); PK.free(r.canvas); r.page.cleanup();
        out.addPage([r.w, r.h]).drawImage(img, { x: 0, y: 0, width: r.w, height: r.h }); await tick();
      }
      pdf.destroy(); bytes = await out.save(); note = 'ถมดำ ' + red.length + ' หน้า หน้าเหล่านี้ถูกแปลงเป็นภาพ ข้อมูลใต้แถบดำถูกลบแล้ว';
    }
    return { name: baseName(f) + (ED.mode === 'sign' ? '-เซ็นแล้ว.pdf' : ED.mode === 'redact' ? '-ถมดำ.pdf' : '-แก้ไข.pdf'), blob: pdfBlob(bytes), note };
  });
}

PK.add({ id: 'edit', cat: 'edit', icon: 'pen', name: 'แก้ไข PDF', desc: 'ใส่ข้อความ ไฮไลท์ ปากกา รูปร่าง รูป ลายเซ็น', kw: 'edit highlight text เน้น พิมพ์ ลูกศร เส้น', mode: 'edit', view,
  long: 'ใส่ข้อความ ไฮไลท์ ปากกา รูปร่าง รูป และลายเซ็นลงบนหน้าเอกสาร ข้อความเดิมในไฟล์แก้ตรง ๆ ไม่ได้ ให้ใช้ "ลบทับขาว" แล้วพิมพ์ใหม่ทับ' });
PK.add({ id: 'sign', cat: 'sec', icon: 'sign', name: 'เซ็นเอกสาร', desc: 'วาดลายเซ็นแล้ววางบนเอกสาร', kw: 'sign signature ลายเซ็น', mode: 'sign', view,
  long: 'วาดลายเซ็นด้วยนิ้ว แล้วแตะวางบนเอกสาร เพิ่มชื่อหรือวันที่ด้วยเครื่องมือข้อความได้ เป็นลายเซ็นแบบภาพ ไม่ใช่ลายเซ็นดิจิทัลที่มีใบรับรอง' });
PK.add({ id: 'redact', cat: 'sec', icon: 'block', name: 'ถมดำข้อมูล', desc: 'ลบข้อมูลลับออกจากไฟล์อย่างถาวร', kw: 'redact ปิดข้อมูล เซ็นเซอร์', mode: 'redact', view,
  long: 'ลากคลุมเลขบัตร เบอร์โทร หรือข้อมูลที่ไม่ต้องการให้เห็น หน้าที่ถมดำจะถูกแปลงเป็นภาพ ข้อมูลใต้แถบดำจึงกู้คืนไม่ได้' });
})();
