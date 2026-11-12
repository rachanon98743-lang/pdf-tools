/* convert: office formats, text output, AI tools, compare */
(function(){
"use strict";
const { $, esc, val, on, tick, pad, baseName, fmtSize, pdfBlob, E } = PK;
const { sel, txt, chk, row } = PK.ui;
const L = () => PDFLib;
const xmlEsc = s => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const FMT = [['docx', 'Word (.docx)'], ['txt', 'ข้อความ (.txt)'], ['pdf', 'PDF']];

/* ---------- writers ---------- */
/* paras: [{text, size?, bold?, pageBreak?}] */
PK.makeDocx = async paras => {
  let body = '';
  for (const p of paras) {
    if (p.pageBreak) { body += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'; continue; }
    const sz = Math.max(16, Math.min(96, Math.round((p.size || 12) * 2)));
    body += '<w:p><w:pPr><w:spacing w:after="140"/></w:pPr><w:r><w:rPr>' + (p.bold ? '<w:b/><w:bCs/>' : '') + '<w:sz w:val="' + sz + '"/><w:szCs w:val="' + sz + '"/></w:rPr><w:t xml:space="preserve">' + xmlEsc(p.text) + '</w:t></w:r></w:p>';
  }
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + body + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>');
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
};

/* render HTML to an A4 PDF (pages are images). returns {bytes, pages, cut} */
PK.htmlToPdf = async (html, o) => {
  o = o || {}; await PK.load('html2canvas');
  const W = o.landscape ? 1123 : 794, PH = o.landscape ? 794 : 1123, M = 48, maxH = PH - 2 * M, MAXP = 80;
  const dp = new DOMParser().parseFromString(html, 'text/html');
  dp.querySelectorAll('script,iframe,frame,object,embed,link,meta,base,noscript,template').forEach(e => e.remove());
  dp.querySelectorAll('*').forEach(e => Array.from(e.attributes).forEach(a => { if (/^on/i.test(a.name) || (/^(href|src|action)$/i.test(a.name) && /^\s*javascript:/i.test(a.value))) e.removeAttribute(a.name); }));
  dp.querySelectorAll('img').forEach(i => { if (!/^(data:|blob:)/i.test(i.getAttribute('src') || '')) i.remove(); });
  const styles = Array.from(dp.querySelectorAll('style')).map(s => s.textContent.replace(/@import[^;]*;/g, '')).join('\n');
  dp.querySelectorAll('style').forEach(s => s.remove());
  const base = 'html,body{margin:0;background:#fff;color:#111}body{font-family:Tahoma,"Noto Sans Thai","Thonburi","Leelawadee UI","Loma",sans-serif;font-size:15px;line-height:1.6;padding:0 ' + M + 'px;width:' + W + 'px;box-sizing:border-box;overflow-wrap:anywhere;display:flow-root}img{max-width:100%;height:auto}table{border-collapse:collapse;max-width:100%}td,th{border:1px solid #999;padding:3px 7px;vertical-align:top}h1,h2,h3,h4{line-height:1.3}pre{white-space:pre-wrap}p{margin:0 0 .7em}';
  const fr = document.createElement('iframe'); fr.setAttribute('sandbox', 'allow-same-origin'); fr.setAttribute('aria-hidden', 'true');
  fr.style.cssText = 'position:fixed;left:-20000px;top:0;width:' + W + 'px;height:' + PH + 'px;border:0';
  let doc = null, host = null;
  try {
    await new Promise((res, rej) => { fr.onload = res; fr.onerror = rej; fr.srcdoc = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' + styles.replace(/<\/style/gi, '') + '</style><style>' + base + '</style></head><body>' + dp.body.innerHTML + '</body></html>'; document.body.appendChild(fr); setTimeout(rej, 8000); });
    doc = fr.contentDocument; if (!doc || !doc.body) throw 0;
  } catch (e) {
    fr.remove(); doc = null;
    host = document.createElement('div'); host.style.cssText = 'position:absolute;left:-20000px;top:0;width:' + W + 'px;background:#fff;color:#111;font-family:Tahoma,"Noto Sans Thai","Thonburi",sans-serif;font-size:15px;line-height:1.6;padding:0 ' + M + 'px;box-sizing:border-box;overflow-wrap:anywhere;display:flow-root';
    host.innerHTML = dp.body.innerHTML; document.body.appendChild(host);
  }
  try {
    const root = doc ? doc.body : host, top0 = root.getBoundingClientRect().top, H = Math.ceil(root.scrollHeight);
    if (H < 2) throw E('เอกสารนี้ไม่มีเนื้อหาให้แปลง');
    const cand = Array.from(root.querySelectorAll('p,li,tr,h1,h2,h3,h4,h5,h6,img,pre,blockquote,table,hr,div')).map(e => Math.round(e.getBoundingClientRect().bottom - top0)).filter(y => y > 0).sort((a, b) => a - b);
    const cuts = []; let y = 0;
    while (y < H && cuts.length < MAXP) { let y1 = y + maxH; if (y1 < H) { let best = 0; for (const c of cand) { if (c > y1) break; if (c > y + maxH * 0.35) best = c; } if (best) y1 = best; } else y1 = H; cuts.push([y, y1]); y = y1; }
    const out = await L().PDFDocument.create(), k = 0.75;
    for (let i = 0; i < cuts.length; i++) {
      o.prog && o.prog('กำลังสร้างหน้า ' + (i + 1) + ' จาก ' + cuts.length, 0.3 + 0.7 * i / cuts.length);
      const [a, b] = cuts[i];
      const cv = await html2canvas(root, { x: 0, y: top0 + (doc ? 0 : window.scrollY) + a, width: W, height: b - a, scale: 2, backgroundColor: '#ffffff', logging: false, windowWidth: W, windowHeight: PH });
      const img = await out.embedJpg(await (await PK.toBlob(cv, 'image/jpeg', 0.9)).arrayBuffer()); PK.free(cv);
      out.addPage([W * k, PH * k]).drawImage(img, { x: 0, y: PH * k - M * k - (b - a) * k, width: W * k, height: (b - a) * k });
      await tick();
    }
    return { bytes: await out.save(), pages: cuts.length, cut: y < H };
  } finally { fr.remove(); host && host.remove(); }
};
const textHtml = t => String(t).split(/\n/).map(l => l.trim() ? '<p>' + esc(l) + '</p>' : '').join('');
PK.textOut = async (text, fmt, base, prog) => {
  if (fmt === 'docx') return { name: base + '.docx', blob: await PK.makeDocx(text.split('\n').filter(l => l.trim()).map(l => ({ text: l }))) };
  if (fmt === 'pdf') { const r = await PK.htmlToPdf(textHtml(text), { prog }); return { name: base + '.pdf', blob: pdfBlob(r.bytes) }; }
  return { name: base + '.' + (fmt === 'md' ? 'md' : 'txt'), blob: new Blob([text], { type: 'text/plain' }) };
};

/* ================= แปลงจาก PDF ================= */
PK.add({ id: 'pdf2word', cat: 'from', icon: 'text', name: 'PDF เป็น Word', desc: 'ดึงข้อความเป็นไฟล์ .docx ที่แก้ไขได้', kw: 'docx', act: 'แปลงเป็น Word',
  opts: () => '<p class="hint">ได้ข้อความเป็นย่อหน้าพร้อมขนาดตัวอักษร แก้ไขต่อใน Word ได้ รูปภาพ ตาราง และการจัดหน้าของต้นฉบับจะไม่ตามมา</p>',
  run: async (files, prog) => {
    const f = files[0], d = await PK.docText(f, prog); if (d.text.trim().length < 2) throw E(PK.noText);
    const paras = []; d.pages.forEach((p, i) => { if (i) paras.push({ pageBreak: true }); const ps = PK.paragraphs(p), med = median(ps.map(x => x.size)); ps.forEach(x => paras.push({ text: x.text, size: x.size, bold: x.size > med * 1.25 })); });
    return { name: baseName(f) + '.docx', blob: await PK.makeDocx(paras), note: 'แปลง ' + d.read + ' หน้า' };
  } });
const median = a => { if (!a.length) return 12; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

PK.add({ id: 'pdf2ppt', cat: 'from', icon: 'slides', name: 'PDF เป็น PowerPoint', desc: 'แต่ละหน้ากลายเป็นสไลด์ใน .pptx', kw: 'pptx', act: 'แปลงเป็น PowerPoint',
  opts: () => '<p class="hint">แต่ละหน้าจะเป็นรูปเต็มสไลด์ หน้าตาเหมือนต้นฉบับ แต่แก้ข้อความในสไลด์ไม่ได้</p>',
  run: async (files, prog) => {
    const f = files[0]; await PK.load('pptx'); const pdf = await PK.openJs(f), n = pdf.numPages; const pres = new window.PptxGenJS(); let W = 10, H = 7.5;
    for (let i = 1; i <= n; i++) {
      prog('กำลังแปลงหน้า ' + i + ' จาก ' + n, (i - 1) / n);
      const r = await PK.renderPage(pdf, i, 2, 2600);
      if (i === 1) { W = r.w / 72; H = r.h / 72; pres.defineLayout({ name: 'PG', width: W, height: H }); pres.layout = 'PG'; }
      const k = Math.min(W / (r.w / 72), H / (r.h / 72)), w = r.w / 72 * k, h = r.h / 72 * k;
      pres.addSlide().addImage({ data: r.canvas.toDataURL('image/jpeg', 0.88), x: (W - w) / 2, y: (H - h) / 2, w, h }); PK.free(r.canvas); r.page.cleanup(); await tick();
    }
    pdf.destroy(); prog('กำลังสร้างไฟล์', 0.97);
    return { name: baseName(f) + '.pptx', blob: await pres.write({ outputType: 'blob' }), note: 'ได้ ' + n + ' สไลด์' };
  } });

PK.add({ id: 'pdf2excel', cat: 'from', icon: 'table', name: 'PDF เป็น Excel', desc: 'ดึงตารางและตัวเลขลงไฟล์ .xlsx', kw: 'xlsx ตาราง', act: 'แปลงเป็น Excel',
  opts: () => chk('xl-one', 'รวมทุกหน้าไว้ในชีตเดียว', false) + '<p class="hint">จัดคอลัมน์จากตำแหน่งข้อความบนหน้า เหมาะกับตารางที่เรียงเป็นแนวชัดเจน ตารางซับซ้อนอาจต้องจัดต่อเอง</p>',
  run: async (files, prog) => {
    const f = files[0]; await PK.load('xlsx'); const d = await PK.docText(f, prog); if (d.text.trim().length < 2) throw E(PK.noText);
    const X = window.XLSX, wb = X.utils.book_new(), one = on('xl-one'); let all = [];
    const num = s => (/^-?\d{1,3}(,\d{3})+(\.\d+)?$|^-?\d+(\.\d+)?$/.test(s) && !/^-?0\d/.test(s) && s.length < 16) ? Number(s.replace(/,/g, '')) : s;
    d.pages.forEach((p, pi) => {
      const rows = p.lines.map(Ln => { const cells = []; let cur = null, end = 0; for (const it of Ln.items) { if (cur && it.x - end < Math.max(7, Ln.h * 0.8)) cur.t += (it.x - end > Ln.h * 0.28 ? ' ' : '') + it.str; else { cur = { x: it.x, t: it.str }; cells.push(cur); } end = it.x + it.w; } return cells; });
      const xs = [].concat(...rows.map(r => r.map(c => c.x))).sort((a, b) => a - b), anchors = []; xs.forEach(x => { if (!anchors.length || x - anchors[anchors.length - 1] > 12) anchors.push(x); });
      const aoa = rows.map(r => { const out = []; r.forEach(c => { let bi = 0, bd = 1e9; anchors.forEach((a, i) => { const dd = Math.abs(a - c.x); if (dd < bd) { bd = dd; bi = i; } }); const t = c.t.trim(); out[bi] = out[bi] === undefined ? num(t) : out[bi] + ' ' + t; }); return Array.from(out, v => v === undefined ? '' : v); });
      if (one) { if (pi) all.push([]); all = all.concat(aoa); } else X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(aoa.length ? aoa : [['']]), 'หน้า ' + (pi + 1));
    });
    if (one) X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(all), 'ข้อมูล');
    return { name: baseName(f) + '.xlsx', blob: new Blob([X.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), note: 'แปลง ' + d.read + ' หน้า' };
  } });

const ICC = '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';
PK.add({ id: 'pdf2pdfa', cat: 'from', icon: 'doc', name: 'PDF เป็น PDF/A', desc: 'รูปแบบสำหรับเก็บเอกสารระยะยาว', kw: 'archive', act: 'แปลงเป็น PDF/A',
  opts: () => '<p class="hint">สร้างไฟล์ตามโครงสร้าง PDF/A-2b โดยแปลงแต่ละหน้าเป็นภาพ ฝังโปรไฟล์สี sRGB และข้อมูลกำกับมาตรฐาน ไฟล์ที่ได้ยังไม่ผ่านโปรแกรมตรวจรับรอง ถ้าหน่วยงานปลายทางเข้มงวด ให้ตรวจด้วย veraPDF ก่อนส่ง</p>',
  run: async (files, prog) => {
    const f = files[0], P = L(), pdf = await PK.openJs(f); const out = await PK.rasterPdf(pdf, prog, { scale: 2, q: 0.85, doc: await P.PDFDocument.create({ updateMetadata: false }) }); pdf.destroy();
    const ctx = out.context, bin = atob(ICC), icc = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) icc[i] = bin.charCodeAt(i);
    const iccRef = ctx.register(ctx.stream(icc, { N: 3 }));
    const intent = ctx.register(ctx.obj({ Type: 'OutputIntent', S: 'GTS_PDFA1', OutputConditionIdentifier: P.PDFString.of('sRGB IEC61966-2.1'), Info: P.PDFString.of('sRGB IEC61966-2.1'), DestOutputProfile: iccRef }));
    out.catalog.set(P.PDFName.of('OutputIntents'), ctx.obj([intent]));
    const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    const xmp = '<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>\n<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
      '<rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"><pdfaid:part>2</pdfaid:part><pdfaid:conformance>B</pdfaid:conformance></rdf:Description>' +
      '<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/"><xmp:CreateDate>' + now + '</xmp:CreateDate><xmp:ModifyDate>' + now + '</xmp:ModifyDate><xmp:MetadataDate>' + now + '</xmp:MetadataDate></rdf:Description>' +
      '</rdf:RDF></x:xmpmeta>\n' + ' '.repeat(200) + '\n<?xpacket end="w"?>';
    out.catalog.set(P.PDFName.of('Metadata'), ctx.register(ctx.stream(new TextEncoder().encode(xmp), { Type: 'Metadata', Subtype: 'XML' })));
    const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
    ctx.trailerInfo.ID = ctx.obj([P.PDFHexString.of(id), P.PDFHexString.of(id)]);
    return { name: baseName(f) + '-PDFA.pdf', blob: pdfBlob(await out.save({ useObjectStreams: false })), note: 'โครงสร้าง PDF/A-2b แบบภาพ ' + out.getPageCount() + ' หน้า ยังไม่ผ่านโปรแกรมตรวจรับรอง' };
  } });

PK.add({ id: 'pdf2md', cat: 'from', icon: 'code', name: 'PDF เป็น Markdown', desc: 'ดึงข้อความพร้อมหัวข้อเป็นไฟล์ .md', act: 'แปลงเป็น Markdown',
  run: async (files, prog) => {
    const f = files[0], d = await PK.docText(f, prog); if (d.text.trim().length < 2) throw E(PK.noText);
    const all = [].concat(...d.pages.map(p => PK.paragraphs(p))), med = median(all.map(x => x.size));
    const md = all.map(x => { const t = x.text; if (x.size > med * 1.6) return '# ' + t; if (x.size > med * 1.2) return '## ' + t; if (/^[•▪■●◦○\-–*]\s*/.test(t)) return '- ' + t.replace(/^[•▪■●◦○\-–*]\s*/, ''); return t; }).join('\n\n');
    return { name: baseName(f) + '.md', blob: new Blob([md], { type: 'text/plain' }), text: md, note: 'แปลง ' + d.read + ' หน้า' };
  } });
PK.add({ id: 'pdf2txt', cat: 'more', icon: 'text', name: 'PDF เป็นข้อความ', desc: 'ดึงข้อความล้วนออกมาคัดลอกหรือบันทึก', kw: 'txt text', act: 'ดึงข้อความ',
  run: async (files, prog) => { const f = files[0], d = await PK.docText(f, prog); if (d.text.trim().length < 2) throw E(PK.noText); return { name: baseName(f) + '.txt', blob: new Blob([d.text], { type: 'text/plain' }), text: d.text, note: 'อ่าน ' + d.read + ' หน้า ' + d.text.length.toLocaleString() + ' ตัวอักษร' }; } });

/* ================= แปลงเป็น PDF ================= */
const pdfNote = r => 'ได้ ' + r.pages + ' หน้า' + (r.cut ? ' เอกสารยาวเกิน จึงตัดที่ 80 หน้า' : '') + ' หน้าเป็นภาพ ข้อความคัดลอกไม่ได้';
PK.add({ id: 'word2pdf', cat: 'to', icon: 'text', name: 'Word เป็น PDF', desc: 'แปลงไฟล์ .docx เป็น PDF', in: 'docx', act: 'แปลงเป็น PDF',
  opts: () => '<p class="hint">รองรับข้อความ หัวข้อ รายการ ตาราง และรูป การจัดหน้าอาจต่างจากใน Word เล็กน้อย ไฟล์ .doc รุ่นเก่าต้องบันทึกเป็น .docx ก่อน</p>',
  run: async (files, prog) => {
    const f = files[0]; await PK.load('mammoth'); prog('กำลังอ่านไฟล์ Word', 0.1);
    let html; try { html = (await window.mammoth.convertToHtml({ arrayBuffer: await f.arrayBuffer() })).value; } catch (e) { throw E('อ่านไฟล์ Word นี้ไม่ได้ ต้องเป็นไฟล์ .docx'); }
    if (!html.trim()) throw E('ไฟล์นี้ไม่มีเนื้อหา');
    const r = await PK.htmlToPdf(html, { prog }); return { name: baseName(f) + '.pdf', blob: pdfBlob(r.bytes), note: pdfNote(r) };
  } });
PK.add({ id: 'excel2pdf', cat: 'to', icon: 'table', name: 'Excel เป็น PDF', desc: 'แปลงตาราง .xlsx .xls .csv เป็น PDF', in: 'xlsx', act: 'แปลงเป็น PDF',
  opts: () => sel('xp-or', 'แนวกระดาษ', [['l', 'แนวนอน'], ['p', 'แนวตั้ง']]) + '<p class="hint">แสดงค่าในเซลล์เป็นตาราง สี กราฟ และรูปในไฟล์จะไม่ตามมา</p>',
  run: async (files, prog) => {
    const f = files[0]; await PK.load('xlsx'); prog('กำลังอ่านไฟล์ Excel', 0.1); const X = window.XLSX; let wb;
    try { wb = X.read(await f.arrayBuffer(), { type: 'array' }); } catch (e) { throw E('อ่านไฟล์ Excel นี้ไม่ได้'); }
    let html = '<style>table{font-size:12px;margin-bottom:18px}h3{margin:14px 0 6px}</style>';
    wb.SheetNames.forEach(n => { const ws = wb.Sheets[n]; if (!ws || !ws['!ref']) return; const m = X.utils.sheet_to_html(ws).match(/<table[\s\S]*<\/table>/i); if (m) html += (wb.SheetNames.length > 1 ? '<h3>' + esc(n) + '</h3>' : '') + m[0]; });
    const r = await PK.htmlToPdf(html, { prog, landscape: val('xp-or') !== 'p' }); return { name: baseName(f) + '.pdf', blob: pdfBlob(r.bytes), note: pdfNote(r) };
  } });
PK.add({ id: 'html2pdf', cat: 'to', icon: 'code', name: 'HTML เป็น PDF', desc: 'แปลงไฟล์ HTML หรือโค้ดที่วางเป็น PDF', kw: 'web เว็บ', in: 'html', min: 0, act: 'แปลงเป็น PDF',
  long: 'เลือกไฟล์ .html หรือวางโค้ด HTML ด้านล่าง หน้านี้ดึงหน้าเว็บจากลิงก์ไม่ได้ ให้บันทึกหน้าเว็บเป็นไฟล์ก่อน',
  opts: () => '<div class="field"><label for="ht-src">หรือวางโค้ด HTML</label><textarea id="ht-src" placeholder="&lt;h1&gt;หัวข้อ&lt;/h1&gt;&lt;p&gt;เนื้อหา&lt;/p&gt;"></textarea></div><p class="hint">สคริปต์และรูปจากเว็บภายนอกจะไม่ถูกโหลด</p>',
  run: async (files, prog) => {
    const html = files[0] ? await files[0].text() : val('ht-src'); if (!html.trim()) throw E('เลือกไฟล์ HTML หรือวางโค้ดก่อน');
    const r = await PK.htmlToPdf(html, { prog }); return { name: (files[0] ? baseName(files[0]) : 'หน้าเว็บ') + '.pdf', blob: pdfBlob(r.bytes), note: pdfNote(r) };
  } });

/* PowerPoint: a compact slide renderer (text boxes, pictures, simple shapes, tables) */
async function pptToPdf(file, prog) {
  let zip; try { zip = await JSZip.loadAsync(await file.arrayBuffer()); } catch (e) { throw E('อ่านไฟล์นี้ไม่ได้ ต้องเป็นไฟล์ .pptx'); }
  const cache = {};
  const xml = async p => { if (p in cache) return cache[p]; const f = zip.file(p); return (cache[p] = f ? new DOMParser().parseFromString(await f.async('string'), 'application/xml') : null); };
  const resolve = (dir, t) => { if (t[0] === '/') return t.slice(1); const parts = dir.split('/'); t.split('/').forEach(s => { if (s === '..') parts.pop(); else if (s !== '.') parts.push(s); }); return parts.join('/'); };
  const rels = async p => { const i = p.lastIndexOf('/'), d = await xml(p.slice(0, i) + '/_rels/' + p.slice(i + 1) + '.rels'), m = {}; if (d) Array.from(d.getElementsByTagName('Relationship')).forEach(r => { m[r.getAttribute('Id')] = { type: r.getAttribute('Type') || '', target: r.getAttribute('TargetMode') === 'External' ? '' : resolve(p.slice(0, i), r.getAttribute('Target')) }; }); return m; };
  const T = (el, n) => el ? Array.from(el.getElementsByTagName(n)) : [];
  const kid = (el, n) => el ? Array.from(el.children).find(c => c.tagName === n) : null;
  const relOf = (m, suffix) => { for (const k in m) if (m[k].type.endsWith(suffix)) return m[k].target; return null; };
  const pres = await xml('ppt/presentation.xml'); if (!pres) throw E('ไฟล์นี้ไม่ใช่ PowerPoint (.pptx)');
  const sz = T(pres, 'p:sldSz')[0], CX = +(sz && sz.getAttribute('cx')) || 9144000, CY = +(sz && sz.getAttribute('cy')) || 6858000;
  const prel = await rels('ppt/presentation.xml');
  const slides = T(pres, 'p:sldId').map(s => prel[s.getAttribute('r:id')]).filter(Boolean).map(r => r.target);
  if (!slides.length) throw E('ไฟล์นี้ไม่มีสไลด์');
  const theme = {}; const th = await xml(relOf(prel, '/theme') || 'ppt/theme/theme1.xml');
  if (th) { const cs = T(th, 'a:clrScheme')[0]; cs && Array.from(cs.children).forEach(c => { const s = c.firstElementChild; if (s) theme[c.tagName.replace('a:', '')] = s.getAttribute('val') && s.tagName === 'a:srgbClr' ? s.getAttribute('val') : (s.getAttribute('lastClr') || '000000'); }); }
  const CW = 1600, S = CW / CX, CH = Math.round(CY * S), out = await L().PDFDocument.create(); let skipped = 0;
  const seg = (window.Intl && Intl.Segmenter) ? new Intl.Segmenter('th', { granularity: 'word' }) : null;
  const words = s => seg ? Array.from(seg.segment(s), x => x.segment) : s.split(/(\s+)/).filter(Boolean);
  for (let si = 0; si < slides.length; si++) {
    prog('กำลังวาดสไลด์ ' + (si + 1) + ' จาก ' + slides.length, si / slides.length);
    const sp = slides[si], sd = await xml(sp); if (!sd) continue; const srel = await rels(sp);
    const lp = relOf(srel, '/slideLayout'), ld = lp ? await xml(lp) : null, lrel = lp ? await rels(lp) : {};
    const mp = relOf(lrel, '/slideMaster'), md = mp ? await xml(mp) : null, mrel = mp ? await rels(mp) : {};
    const cm = {}; const cmEl = md && T(md, 'p:clrMap')[0]; if (cmEl) Array.from(cmEl.attributes).forEach(a => { cm[a.name] = a.value; });
    const clr = node => { if (!node) return null; const s = kid(node, 'a:srgbClr'); if (s) return '#' + s.getAttribute('val'); const sc = kid(node, 'a:schemeClr'); if (sc) { let v = sc.getAttribute('val'); v = cm[v] || v; return theme[v] ? '#' + theme[v] : null; } return null; };
    const txDef = '#' + (theme[cm.tx1 || 'dk1'] || '111111');
    const c = document.createElement('canvas'); c.width = CW; c.height = CH; const g = c.getContext('2d');
    let bg = null; for (const d of [sd, ld, md]) { const b = d && T(d, 'p:bg')[0]; if (b) { bg = clr(kid(kid(b, 'p:bgPr'), 'a:solidFill')) || clr(kid(b, 'p:bgRef')); if (bg) break; } }
    g.fillStyle = bg || '#' + (theme[cm.bg1 || 'lt1'] || 'ffffff'); g.fillRect(0, 0, CW, CH);
    const findPh = (d, type, idx) => { if (!d) return null; const list = T(d, 'p:sp').filter(x => T(x, 'p:ph')[0]); const same = t => t === type || (/title/i.test(t) && /title/i.test(type)); return (idx && list.find(x => T(x, 'p:ph')[0].getAttribute('idx') === idx)) || list.find(x => same(T(x, 'p:ph')[0].getAttribute('type') || 'body')) || null; };
    const boxOf = (el, tf) => { const x = T(el, 'a:xfrm')[0] || T(el, 'p:xfrm')[0]; if (!x) return null; const o = kid(x, 'a:off'), e = kid(x, 'a:ext'); if (!o || !e) return null; return { x: (tf.ox + (+o.getAttribute('x') - tf.cx) * tf.sx) * S, y: (tf.oy + (+o.getAttribute('y') - tf.cy) * tf.sy) * S, w: +e.getAttribute('cx') * tf.sx * S, h: +e.getAttribute('cy') * tf.sy * S, raw: x }; };
    const drawText = (tb, b, type, tf) => {
      const bp = kid(tb, 'a:bodyPr'), na = bp && kid(bp, 'a:normAutofit'); let fs = na && na.getAttribute('fontScale') ? +na.getAttribute('fontScale') / 100000 : 1;
      const def = /ctrTitle/.test(type) ? 44 : /title/i.test(type) ? 36 : type === 'subTitle' ? 24 : type === 'body' ? 22 : 18, isBody = type === 'body';
      const anchor = (bp && bp.getAttribute('anchor')) || (/title/i.test(type) ? 'ctr' : 't'), padX = 91440 * S, padY = 45720 * S, maxW = Math.max(20, b.w - 2 * padX);
      const paras = Array.from(tb.children).filter(x => x.tagName === 'a:p').map(p => {
        const pPr = kid(p, 'a:pPr'), lvl = +(pPr && pPr.getAttribute('lvl')) || 0, runs = [];
        Array.from(p.children).forEach(r => { if (r.tagName === 'a:br') runs.push({ br: 1 }); else if (r.tagName === 'a:r' || r.tagName === 'a:fld') { const rp = kid(r, 'a:rPr'), t = kid(r, 'a:t'); if (t && t.textContent) runs.push({ t: t.textContent, sz: rp && rp.getAttribute('sz') ? +rp.getAttribute('sz') / 100 : 0, b: rp && rp.getAttribute('b') === '1', i: rp && rp.getAttribute('i') === '1', c: rp && clr(kid(rp, 'a:solidFill')) }); } });
        const bullet = isBody && runs.length && !(pPr && kid(pPr, 'a:buNone'));
        return { runs, lvl, bullet, algn: (pPr && pPr.getAttribute('algn')) || (/ctrTitle|subTitle/.test(type) ? 'ctr' : 'l') };
      });
      if (!paras.some(p => p.runs.length)) return;
      const layout = k => { const lines = []; let H = 0;
        paras.forEach(p => { const ind = p.lvl * 0.35 * 914400 * S + (p.bullet ? def * 0.9 * 12700 * S * k : 0), w = Math.max(20, maxW - ind); let line = { parts: [], w: 0, h: 0, ind, algn: p.algn, bullet: p.bullet }, first = true;
          const push = () => { if (!line.h) line.h = (def - p.lvl * 2) * 12700 * S * k * 1.3; lines.push(line); H += line.h; line = { parts: [], w: 0, h: 0, ind, algn: p.algn }; first = false; };
          p.runs.forEach(r => { if (r.br) { push(); return; } const px = (r.sz || Math.max(10, def - p.lvl * 2)) * 12700 * S * k, font = (r.i ? 'italic ' : '') + (r.b || /title/i.test(type) ? '600 ' : '400 ') + px + 'px "IBM Plex Sans Thai","Loma",sans-serif'; g.font = font;
            words(r.t).forEach(wd => { const ww = g.measureText(wd).width; if (line.w + ww > w && line.parts.length) { push(); if (!wd.trim()) return; } line.parts.push({ t: wd, font, c: r.c || txDef, w: ww }); line.w += ww; line.h = Math.max(line.h, px * 1.3); }); });
          push(); void first; H += def * 12700 * S * k * 0.25; });
        return { lines, H }; };
      let lay = layout(fs); for (let i = 0; i < 7 && lay.H > b.h - 2 * padY && b.h > 30; i++) { fs *= 0.9; lay = layout(fs); }
      let y = b.y + padY + (anchor === 'ctr' ? Math.max(0, (b.h - 2 * padY - lay.H) / 2) : anchor === 'b' ? Math.max(0, b.h - 2 * padY - lay.H) : 0);
      g.textBaseline = 'alphabetic';
      lay.lines.forEach(ln => { let x = b.x + padX + ln.ind + (ln.algn === 'ctr' ? (maxW - ln.ind - ln.w) / 2 : ln.algn === 'r' ? maxW - ln.ind - ln.w : 0);
        if (ln.bullet && ln.parts.length) { g.font = ln.parts[0].font; g.fillStyle = ln.parts[0].c; g.fillText('•', x - ln.h * 0.55, y + ln.h * 0.78); }
        ln.parts.forEach(p => { g.font = p.font; g.fillStyle = p.c; g.fillText(p.t, x, y + ln.h * 0.78); x += p.w; }); y += ln.h; });
    };
    const walk = async (tree, tf, rel, masterMode) => {
      for (const el of Array.from(tree.children)) {
        const tag = el.tagName;
        if (tag === 'p:grpSp') { const x = T(el, 'a:xfrm')[0]; let t2 = tf; if (x) { const o = kid(x, 'a:off'), e = kid(x, 'a:ext'), co = kid(x, 'a:chOff'), ce = kid(x, 'a:chExt'); if (o && e && co && ce && +ce.getAttribute('cx') && +ce.getAttribute('cy')) t2 = { ox: tf.ox + (+o.getAttribute('x') - tf.cx) * tf.sx, oy: tf.oy + (+o.getAttribute('y') - tf.cy) * tf.sy, cx: +co.getAttribute('x'), cy: +co.getAttribute('y'), sx: tf.sx * +e.getAttribute('cx') / +ce.getAttribute('cx'), sy: tf.sy * +e.getAttribute('cy') / +ce.getAttribute('cy') }; } await walk(el, t2, rel, masterMode); continue; }
        const ph = T(el, 'p:ph')[0]; if (masterMode && ph) continue;
        if (tag === 'p:pic') { const b = boxOf(el, tf), bl = T(el, 'a:blip')[0], r = bl && rel[bl.getAttribute('r:embed')]; const zf = r && r.target && zip.file(r.target); if (!b || !zf) continue; try { const im = await PK.loadImage(new Blob([await zf.async('arraybuffer')], { type: /\.png$/i.test(r.target) ? 'image/png' : /\.jpe?g$/i.test(r.target) ? 'image/jpeg' : /\.gif$/i.test(r.target) ? 'image/gif' : /\.svg$/i.test(r.target) ? 'image/svg+xml' : '' })); g.drawImage(im.el, b.x, b.y, b.w, b.h); im.close(); } catch (e) { skipped++; } continue; }
        if (tag === 'p:sp' || tag === 'p:cxnSp') {
          const type = ph ? (ph.getAttribute('type') || 'body') : 'box', idx = ph && ph.getAttribute('idx');
          let b = boxOf(el, tf); if (!b && ph) { const src = findPh(ld, type, idx) || findPh(md, type, idx); b = src && boxOf(src, { ox: 0, oy: 0, cx: 0, cy: 0, sx: 1, sy: 1 }); }
          if (!b) b = /title/i.test(type) ? { x: CW * 0.06, y: CH * 0.06, w: CW * 0.88, h: CH * 0.2 } : { x: CW * 0.06, y: CH * 0.3, w: CW * 0.88, h: CH * 0.6 };
          const pr = kid(el, 'p:spPr'), fill = pr && clr(kid(pr, 'a:solidFill')), ln = pr && kid(pr, 'a:ln'), lc = ln && clr(kid(ln, 'a:solidFill')), geo = pr && kid(pr, 'a:prstGeom'), prst = geo ? geo.getAttribute('prst') : 'rect';
          g.beginPath();
          if (tag === 'p:cxnSp' || prst === 'line') { const fh = b.raw && b.raw.getAttribute('flipH') === '1', fv = b.raw && b.raw.getAttribute('flipV') === '1'; g.moveTo(fh ? b.x + b.w : b.x, fv ? b.y + b.h : b.y); g.lineTo(fh ? b.x : b.x + b.w, fv ? b.y : b.y + b.h); }
          else if (prst === 'ellipse') g.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
          else if (prst === 'roundRect' && g.roundRect) g.roundRect(b.x, b.y, b.w, b.h, Math.min(b.w, b.h) * 0.16);
          else g.rect(b.x, b.y, b.w, b.h);
          if (fill && tag === 'p:sp') { g.fillStyle = fill; g.fill(); }
          if (lc) { g.strokeStyle = lc; g.lineWidth = Math.max(1, (+ln.getAttribute('w') || 12700) * S); g.stroke(); }
          const tb = kid(el, 'p:txBody'); if (tb) drawText(tb, b, type, tf); continue;
        }
        if (tag === 'p:graphicFrame') {
          const tbl = T(el, 'a:tbl')[0], b = boxOf(el, tf); if (!tbl || !b) { if (!tbl) skipped++; continue; }
          const cols = T(tbl, 'a:gridCol').map(x => +x.getAttribute('w') * tf.sx * S); let y = b.y;
          Array.from(tbl.children).filter(x => x.tagName === 'a:tr').forEach((tr, ri) => { const h = +tr.getAttribute('h') * tf.sy * S; let x = b.x;
            Array.from(tr.children).filter(q => q.tagName === 'a:tc').forEach((tc, ci) => { const w = cols[ci] || 0, tp = kid(tc, 'a:tcPr'), f = tp && clr(kid(tp, 'a:solidFill')); g.fillStyle = f || (ri === 0 ? '#e5e7eb' : '#ffffff'); g.fillRect(x, y, w, h); g.strokeStyle = '#9ca3af'; g.lineWidth = 1; g.strokeRect(x, y, w, h); const tb = kid(tc, 'a:txBody'); if (tb) drawText(tb, { x, y, w, h }, 'cell', tf); x += w; }); y += h; });
        }
      }
    };
    const id = { ox: 0, oy: 0, cx: 0, cy: 0, sx: 1, sy: 1 };
    for (const [d, r] of [[md, mrel], [ld, lrel]]) { const tr = d && T(d, 'p:spTree')[0]; if (tr) await walk(tr, id, r, true); }
    const tr = T(sd, 'p:spTree')[0]; if (tr) await walk(tr, id, srel, false);
    const img = await out.embedJpg(await (await PK.toBlob(c, 'image/jpeg', 0.9)).arrayBuffer()); PK.free(c);
    const pw = CX / 12700, ph2 = CY / 12700; out.addPage([pw, ph2]).drawImage(img, { x: 0, y: 0, width: pw, height: ph2 }); await tick();
  }
  return { bytes: await out.save(), n: slides.length, skipped };
}
PK.add({ id: 'ppt2pdf', cat: 'to', icon: 'slides', name: 'PowerPoint เป็น PDF', desc: 'แปลงสไลด์ .pptx เป็น PDF', in: 'pptx', act: 'แปลงเป็น PDF',
  opts: () => '<p class="hint">วาดข้อความ รูป รูปทรงพื้นฐาน และตารางของแต่ละสไลด์ใหม่ กราฟ SmartArt เอฟเฟกต์ และฟอนต์เฉพาะจะไม่ตามมา หน้าตาจึงอาจต่างจากใน PowerPoint ตรวจผลลัพธ์ก่อนส่งต่อ</p>',
  run: async (files, prog) => { const r = await pptToPdf(files[0], prog); return { name: baseName(files[0]) + '.pdf', blob: pdfBlob(r.bytes), note: 'ได้ ' + r.n + ' หน้า' + (r.skipped ? ' ข้ามกราฟหรือรูปที่วาดไม่ได้ ' + r.skipped + ' ชิ้น' : '') }; } });

/* ================= AI ================= */
const clip = (s, max) => { const enc = new TextEncoder(); let cut = false; while (enc.encode(s).length > max) { s = s.slice(0, Math.floor(s.length * 0.9)); cut = true; } return { s, cut }; };
const AI_HINT = '<p class="hint">เมนูนี้ส่งเนื้อหาเอกสารให้ Claude และใช้โควตาบัญชี Claude ของคุณ ครั้งแรกจะมีหน้าต่างขออนุญาต</p>';
const LANGS = [['ไทย', 'ไทย'], ['อังกฤษ', 'อังกฤษ'], ['จีน', 'จีน'], ['ญี่ปุ่น', 'ญี่ปุ่น'], ['เกาหลี', 'เกาหลี'], ['มาเลย์', 'มาเลย์'], ['เวียดนาม', 'เวียดนาม'], ['พม่า', 'พม่า'], ['ลาว', 'ลาว']];
const readDoc = async (f, prog) => { const d = await PK.docText(f, prog); if (d.text.trim().length < 20) throw E(PK.noText); return d; };

PK.add({ id: 'summarize', cat: 'ai', icon: 'spark', ai: true, name: 'สรุปเอกสาร', desc: 'ให้ Claude อ่านแล้วสรุปประเด็นสำคัญ', kw: 'summary summarizer', act: 'สรุปเอกสาร',
  opts: () => row(sel('sm-len', 'ความยาว', [['สั้น กระชับ ไม่เกิน 6 ข้อ', 'สั้น'], ['ละเอียด แบ่งหัวข้อตามเนื้อหา', 'ละเอียด'], ['หนึ่งย่อหน้า', 'ย่อหน้าเดียว']]), sel('sm-lang', 'ภาษาของบทสรุป', LANGS)) + AI_HINT,
  run: async (files, prog, live) => {
    const f = files[0], d = await readDoc(f, prog), c = clip(d.text, 200000); prog('Claude กำลังอ่านเอกสาร', 0.6);
    const text = await PK.ai('สรุปเอกสารต่อไปนี้เป็นภาษา' + val('sm-lang') + ' แบบ' + val('sm-len') + ' ระบุตัวเลข วันที่ ชื่อ และเงื่อนไขสำคัญให้ครบ ตอบเป็นข้อความธรรมดา ไม่ใช้เครื่องหมาย Markdown\n\n<เอกสาร>\n' + c.s + '\n</เอกสาร>', { onText: u => live(u.text) });
    return { name: baseName(f) + '-สรุป.txt', blob: new Blob([text], { type: 'text/plain' }), text, note: 'อ่าน ' + d.read + ' หน้า' + (c.cut ? ' เอกสารยาวเกิน จึงสรุปจากส่วนต้น' : '') };
  } });

PK.add({ id: 'translate', cat: 'ai', icon: 'globe', ai: true, name: 'แปลภาษา PDF', desc: 'แปลข้อความทั้งไฟล์เป็นภาษาที่เลือก', kw: 'translate', act: 'แปลเอกสาร',
  opts: () => row(sel('tr-lang', 'แปลเป็นภาษา', LANGS), sel('tr-fmt', 'ไฟล์ผลลัพธ์', FMT)) + AI_HINT + '<p class="hint">ได้คำแปลเป็นข้อความเรียงตามต้นฉบับ การจัดหน้าและรูปจะไม่ตามมา</p>',
  run: async (files, prog, live) => {
    const f = files[0], d = await readDoc(f, prog), lang = val('tr-lang'), chunks = []; let cur = '';
    d.text.split('\n').forEach(p => { if (cur.length + p.length > 5000 && cur) { chunks.push(cur); cur = ''; } cur += (cur ? '\n' : '') + p; }); if (cur.trim()) chunks.push(cur);
    const MAX = 40, use = chunks.slice(0, MAX), outp = [];
    for (let i = 0; i < use.length; i++) {
      prog('Claude กำลังแปลส่วนที่ ' + (i + 1) + ' จาก ' + use.length, 0.5 + 0.5 * i / use.length);
      outp.push(await PK.ai('แปลข้อความต่อไปนี้เป็นภาษา' + lang + ' ให้อ่านเป็นธรรมชาติ คงการแบ่งบรรทัดและย่อหน้าตามเดิม คงตัวเลขและชื่อเฉพาะ ตอบเฉพาะคำแปล ไม่ต้องมีคำอธิบาย\n\n<ข้อความ>\n' + use[i] + '\n</ข้อความ>', { onText: u => live(outp.concat(u.text).join('\n\n')) }));
    }
    const text = outp.join('\n\n'), o = await PK.textOut(text, val('tr-fmt'), baseName(f) + '-แปล' + lang, prog);
    return Object.assign(o, { text, note: 'แปล ' + d.read + ' หน้า' + (chunks.length > MAX ? ' เอกสารยาวเกิน จึงแปลเฉพาะส่วนต้น' : '') });
  } });

PK.add({ id: 'ask', cat: 'ai', icon: 'chat', ai: true, name: 'ถามเอกสาร', desc: 'พิมพ์คำถาม ให้ Claude ตอบจากเนื้อหาในไฟล์', kw: 'chat ถาม', act: 'ถาม Claude',
  opts: () => '<div class="field"><label for="ak-q">คำถาม</label><textarea id="ak-q" placeholder="เช่น ค่างวดต่อเดือนเท่าไหร่ ผ่อนกี่งวด"></textarea></div>' + AI_HINT,
  run: async (files, prog, live) => {
    const q = val('ak-q').trim(); if (!q) throw E('พิมพ์คำถามก่อน');
    const f = files[0], d = await readDoc(f, prog), c = clip(d.text, 200000); prog('Claude กำลังหาคำตอบ', 0.6);
    const text = await PK.ai('ตอบคำถามโดยใช้ข้อมูลจากเอกสารด้านล่างเท่านั้น ถ้าเอกสารไม่มีคำตอบให้บอกตรง ๆ ตอบเป็นภาษาเดียวกับคำถาม เป็นข้อความธรรมดา ไม่ใช้เครื่องหมาย Markdown\n\nคำถาม: ' + q + '\n\n<เอกสาร>\n' + c.s + '\n</เอกสาร>', { onText: u => live(u.text), cache: false });
    return { name: baseName(f) + '-คำตอบ.txt', blob: new Blob(['คำถาม: ' + q + '\n\n' + text], { type: 'text/plain' }), text, note: c.cut ? 'เอกสารยาวเกิน จึงตอบจากส่วนต้น' : '' };
  } });

PK.add({ id: 'ocr', cat: 'opt', icon: 'text', ai: true, name: 'OCR อ่านข้อความจากภาพ', desc: 'ถอดข้อความจากไฟล์สแกนด้วย Claude', kw: 'สแกน scan', act: 'อ่านข้อความ',
  opts: () => row(sel('oc-q', 'ความละเอียดในการอ่าน', [['default', 'แม่นยำ'], ['quick', 'เร็ว']]), sel('oc-fmt', 'ไฟล์ผลลัพธ์', FMT)) + AI_HINT + '<p class="hint">อ่านได้ครั้งละไม่เกิน 20 หน้า ได้ข้อความออกมาเป็นไฟล์ใหม่ ไม่ได้ฝังข้อความกลับลงใน PDF เดิม</p>',
  run: async (files, prog, live) => {
    const lim = await PK.aiImages(); if (!lim) throw E('OCR ใช้ได้เมื่อเปิดหน้านี้ในแอป Claude หรือ claude.ai และอนุญาตให้ส่งรูปให้ Claude');
    const f = files[0], pdf = await PK.openJs(f), n = Math.min(pdf.numPages, 20), outp = [];
    for (let i = 1; i <= n; i++) {
      prog('Claude กำลังอ่านหน้า ' + i + ' จาก ' + n, (i - 1) / n);
      const r = await PK.renderPage(pdf, i, 1.7, 1500), b = await PK.toBlob(r.canvas, 'image/jpeg', 0.85); PK.free(r.canvas); r.page.cleanup();
      outp.push(await PK.ai('ถอดข้อความทั้งหมดในภาพหน้าเอกสารนี้ออกมาเป็นข้อความล้วน คงภาษาเดิม คงลำดับการอ่านและการขึ้นบรรทัด ตารางให้คั่นคอลัมน์ด้วยแท็บ ห้ามแปล ห้ามสรุป ห้ามเพิ่มคำอธิบาย ถ้าหน้านี้ไม่มีข้อความให้ตอบว่า [ไม่มีข้อความ]', { images: [b], modelTier: val('oc-q') === 'quick' ? 'quick' : 'default', onText: u => live(outp.concat(u.text).join('\n\n')) }));
    }
    const total = pdf.numPages; pdf.destroy();
    const text = outp.join('\n\n'), o = await PK.textOut(text, val('oc-fmt'), baseName(f) + '-ข้อความ', prog);
    return Object.assign(o, { text, note: 'อ่าน ' + n + ' หน้า' + (total > n ? ' จากทั้งหมด ' + total + ' หน้า แยกไฟล์แล้วทำต่อได้' : '') });
  } });

/* ================= เปรียบเทียบ ================= */
const diff = (a, b) => {
  const n = a.length, m = b.length, dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = []; let i = 0, j = 0;
  while (i < n && j < m) { if (a[i] === b[j]) { i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) out.push(['r', a[i++]]); else out.push(['a', b[j++]]); }
  while (i < n) out.push(['r', a[i++]]); while (j < m) out.push(['a', b[j++]]);
  return out;
};
PK.add({ id: 'compare', cat: 'sec', icon: 'compare', name: 'เปรียบเทียบ PDF', desc: 'หาข้อความที่ต่างกันระหว่างสองไฟล์', multi: true, min: 2, max: 2, act: 'เปรียบเทียบ',
  long: 'เลือกสองไฟล์ ไฟล์แรกคือฉบับเดิม ไฟล์ที่สองคือฉบับใหม่ จะแสดงบรรทัดที่ถูกลบและเพิ่มในแต่ละหน้า',
  opts: () => '<p class="hint">เทียบเฉพาะข้อความ ไม่ได้เทียบรูปภาพหรือการจัดหน้า</p>',
  run: async (files, prog) => {
    const A = await PK.docText(files[0], (m, v) => prog('ไฟล์ที่ 1: ' + m, v * 0.9)), B = await PK.docText(files[1], (m, v) => prog('ไฟล์ที่ 2: ' + m, 0.45 + v * 0.9));
    const n = Math.max(A.pages.length, B.pages.length); let html = '', report = '', add = 0, del = 0, changed = 0;
    for (let i = 0; i < n; i++) {
      const a = (A.pages[i] ? A.pages[i].lines.map(l => l.text) : []).slice(0, 500), b = (B.pages[i] ? B.pages[i].lines.map(l => l.text) : []).slice(0, 500), d = diff(a, b);
      if (!d.length) continue; changed++; html += '<span class="h">หน้า ' + (i + 1) + '</span>'; report += '\n== หน้า ' + (i + 1) + ' ==\n';
      d.forEach(x => { if (x[0] === 'a') { add++; html += '<span class="a">+ ' + esc(x[1]) + '</span>'; report += '+ ' + x[1] + '\n'; } else { del++; html += '<span class="r">− ' + esc(x[1]) + '</span>'; report += '- ' + x[1] + '\n'; } });
    }
    if (!changed) return { html: 'ข้อความเหมือนกันทุกหน้า', note: 'เทียบ ' + n + ' หน้า ไม่พบข้อความที่ต่างกัน' };
    const head = 'เปรียบเทียบ ' + files[0].name + ' กับ ' + files[1].name + '\nบรรทัดที่ถูกลบ ' + del + ' บรรทัดที่เพิ่ม ' + add + '\n';
    return { html, name: 'ผลเปรียบเทียบ.txt', blob: new Blob([head + report], { type: 'text/plain' }), note: 'ต่างกัน ' + changed + ' หน้า จาก ' + n + ' หน้า ลบ ' + del + ' บรรทัด เพิ่ม ' + add + ' บรรทัด' + (A.total !== B.total ? ' จำนวนหน้าไม่เท่ากัน (' + A.total + ' กับ ' + B.total + ')' : '') };
  } });
})();
