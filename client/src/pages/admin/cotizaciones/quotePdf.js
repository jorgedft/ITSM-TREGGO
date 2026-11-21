import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDateEs } from '../formatos/pdfTemplates';
import { calcQuote, formatMoney } from './quoteMath';

// Paleta tomada del sitio de Consultoría JFT (servicios-tecno-jft-mx.vercel.app):
// esmeralda #10b981 → #047857 sobre fondos casi negros y grises neutros.
const C = {
  e50: [236, 253, 245], e100: [209, 250, 229], e300: [110, 231, 183], e500: [16, 185, 129], e600: [5, 150, 105], e700: [4, 120, 87],
  g950: [12, 17, 23], g900: [17, 24, 39], g700: [55, 65, 81], g500: [107, 114, 128], g300: [209, 213, 219], g200: [229, 231, 235], g50: [249, 250, 251],
  white: [255, 255, 255],
};

const PAGE_LIMIT = 276; // y máximo del contenido; el pie ocupa de 284 en adelante
const HERO_H = 52;

const clean = (v) => (v == null ? '' : String(v).trim());
const imageFormat = (dataUrl) => (/^data:image\/jpe?g/i.test(dataUrl) ? 'JPEG' : 'PNG');

function withOpacity(doc, opacity, draw) {
  doc.saveGraphicsState();
  doc.setGState(new doc.GState({ opacity }));
  draw();
  doc.restoreGraphicsState();
}

// jsPDF no tiene degradados: se simula con franjas verticales.
function gradientBar(doc, x, y, w, h, from, to) {
  const steps = Math.ceil(w / 1.5);
  const sw = w / steps;
  for (let i = 0; i < steps; i += 1) {
    const t = steps === 1 ? 0 : i / (steps - 1);
    doc.setFillColor(...from.map((v, k) => Math.round(v + (to[k] - v) * t)));
    doc.rect(x + i * sw, y, sw + 0.25, h, 'F');
  }
}

function drawBrand(doc, settings, businessName) {
  const top = 9;
  const iconH = 20;
  let textX = 14;

  if (settings.logo) {
    const ratio = Number(settings.logo_ratio) || 1;
    try {
      if (ratio > 2.2) {
        // Banner ancho (suele traer texto oscuro): sobre una tarjeta blanca para que se lea.
        let w = Math.min(60, iconH * ratio);
        let h = w / ratio;
        if (h > 16) { h = 16; w = h * ratio; }
        const y = top + (iconH - h) / 2;
        doc.setFillColor(...C.white);
        doc.roundedRect(14, y - 2.5, w + 5, h + 5, 2.5, 2.5, 'F');
        doc.addImage(settings.logo, imageFormat(settings.logo), 16.5, y, w, h);
        textX = null;
      } else {
        let h = iconH;
        let w = h * ratio;
        if (w > 30) { w = 30; h = w / ratio; }
        doc.addImage(settings.logo, imageFormat(settings.logo), 14, top + (iconH - h) / 2, w, h);
        textX = 14 + w + 5;
      }
    } catch {
      textX = 14;
    }
  }
  if (!settings.logo || textX === 14) {
    // Sin logo: monograma con la inicial del negocio.
    doc.setFillColor(...C.e600);
    doc.roundedRect(14, top, iconH, iconH, 4.5, 4.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(...C.white);
    doc.text(businessName.charAt(0).toUpperCase(), 14 + iconH / 2, top + iconH / 2 + 2.2, { align: 'center' });
    textX = 14 + iconH + 5;
  }

  if (textX) {
    // Nombre del negocio junto al logo: se parte en líneas según el ancho libre (a la derecha va
    // "COTIZACIÓN") y reduce la letra si es muy largo; el bloque queda centrado respecto al logo.
    const maxW = 190 - textX - 52;
    let size = 15;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    let lines = doc.splitTextToSize(businessName, maxW);
    if (lines.length > 2) {
      size = 12;
      doc.setFontSize(size);
      lines = doc.splitTextToSize(businessName, maxW);
    }
    lines = lines.slice(0, 2);
    const lineH = size * 0.44;
    const legal = clean(settings.legal_name);
    const showLegal = legal && legal !== businessName;
    const blockH = lines.length * lineH + (showLegal ? 5 : 0);
    let y = top + iconH / 2 - blockH / 2 + lineH * 0.78;
    doc.setTextColor(...C.white);
    lines.forEach((line) => { doc.text(line, textX, y); y += lineH; });
    if (showLegal) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...C.g300);
      doc.text(legal, textX, y + 0.8, { maxWidth: maxW });
    }
  }
}

function drawHero(doc, quote, settings, businessName) {
  doc.setFillColor(...C.g950);
  doc.rect(0, 0, 210, HERO_H, 'F');
  // Brillos esmeralda, como el fondo del sitio (completamente dentro de la banda).
  withOpacity(doc, 0.16, () => { doc.setFillColor(...C.e500); doc.circle(196, 6, 30, 'F'); });
  withOpacity(doc, 0.1, () => { doc.setFillColor(...C.e300); doc.circle(170, 31, 14, 'F'); });
  gradientBar(doc, 0, HERO_H, 210, 1.6, C.e500, C.e700);

  drawBrand(doc, settings, businessName);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...C.white);
  doc.text('COTIZACIÓN', 196, 18, { align: 'right' });

  const chips = [
    ['FOLIO', quote.folio || 'Borrador'],
    ['FECHA', formatDateEs(quote.quote_date)],
    ['VIGENCIA', quote.valid_until ? formatDateEs(quote.valid_until) : '—'],
  ];
  const w = 58;
  chips.forEach(([label, value], i) => {
    const x = 14 + i * (w + 4);
    withOpacity(doc, 0.08, () => { doc.setFillColor(...C.white); doc.roundedRect(x, 36, w, 11, 2.5, 2.5, 'F'); });
    withOpacity(doc, 0.45, () => { doc.setDrawColor(...C.e500); doc.setLineWidth(0.25); doc.roundedRect(x, 36, w, 11, 2.5, 2.5, 'S'); });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...C.e300);
    doc.text(label, x + 4, 40.6);
    doc.setFontSize(10);
    doc.setTextColor(...C.white);
    doc.text(value, x + 4, 45);
  });
}

function drawMiniHeader(doc, quote, businessName) {
  doc.setFillColor(...C.g950);
  doc.rect(0, 0, 210, 11, 'F');
  gradientBar(doc, 0, 11, 210, 1, C.e500, C.e700);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.white);
  doc.text(businessName, 14, 7);
  doc.setTextColor(...C.e300);
  doc.text(`COTIZACIÓN ${quote.folio || ''}`.trim(), 196, 7, { align: 'right' });
}

// Texto de una tarjeta ya partido en líneas según el ancho disponible.
function wrapLines(doc, width, lines) {
  const out = [];
  lines.filter((l) => clean(l.text)).forEach(({ text, bold }) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 10.5 : 8.8);
    doc.splitTextToSize(clean(text), width - 11).forEach((t) => out.push({ t, bold }));
  });
  return out;
}
const cardHeight = (wrapped) => 14 + wrapped.reduce((h, l) => h + (l.bold ? 5.2 : 4.3), 0);

function drawCard(doc, x, y, w, h, title, wrapped) {
  doc.setFillColor(...C.g50);
  doc.setDrawColor(...C.g200);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, w, h, 2.5, 2.5, 'FD');
  doc.setFillColor(...C.e500);
  doc.roundedRect(x + 3, y + 3.5, 1.4, h - 7, 0.7, 0.7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.e700);
  doc.text(title, x + 8, y + 7);
  let ty = y + 12.5;
  wrapped.forEach(({ t, bold }) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 10.5 : 8.8);
    doc.setTextColor(...(bold ? C.g900 : C.g700));
    doc.text(t, x + 8, ty);
    ty += bold ? 5.2 : 4.3;
  });
}

// quote: registro con la forma de la tabla quotes (o el estado del editor ya convertido con quoteToRow).
export function renderQuotePDF(quote, settings = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const currency = quote.currency || 'MXN';
  const money = (v) => formatMoney(v, currency);
  const calc = calcQuote(quote);
  const client = quote.client_snapshot || {};
  const items = quote.items || [];
  const businessName = clean(settings.business_name) || clean(settings.legal_name) || 'Cotización';

  drawHero(doc, quote, settings, businessName);

  // ---- Emisor y cliente
  const issuer = wrapLines(doc, 88, [
    { text: clean(settings.legal_name) || clean(settings.business_name), bold: true },
    { text: settings.rfc ? `RFC: ${settings.rfc}` : '' },
    { text: settings.address },
    { text: [settings.phone, settings.email].filter(clean).join('  ·  ') },
  ]);
  const clientLines = wrapLines(doc, 88, [
    { text: client.name || 'Cliente sin especificar', bold: true },
    { text: client.contact_name ? `Atención: ${client.contact_name}` : '' },
    { text: client.rfc ? `RFC: ${client.rfc}` : '' },
    { text: client.address },
    { text: [client.phone, client.email].filter(clean).join('  ·  ') },
  ]);
  const cardsY = HERO_H + 10;
  const cardsH = Math.max(cardHeight(issuer), cardHeight(clientLines));
  drawCard(doc, 14, cardsY, 88, cardsH, 'EMISOR', issuer);
  drawCard(doc, 108, cardsY, 88, cardsH, 'CLIENTE', clientLines);

  // ---- Partidas
  autoTable(doc, {
    startY: cardsY + cardsH + 8,
    head: [['#', 'DESCRIPCIÓN', 'CANT.', 'UNIDAD', 'P. UNITARIO', 'DESC.', 'IMPORTE']],
    body: items.length
      ? items.map((it, i) => [
          i + 1,
          clean(it.detail) ? `${it.description}\n${it.detail}` : it.description,
          Number(it.quantity) || 0,
          it.unit || '',
          money(it.unit_price),
          Number(it.discount_pct) ? `${Number(it.discount_pct)}%` : '-',
          money(calc.lines[i].net),
        ])
      : [['-', 'Sin partidas', '', '', '', '', '']],
    theme: 'plain',
    styles: {
      font: 'helvetica', fontSize: 9, cellPadding: 3, textColor: C.g900, overflow: 'linebreak',
      lineColor: C.g200, lineWidth: { top: 0, right: 0, bottom: 0.2, left: 0 },
    },
    headStyles: { fillColor: C.e700, textColor: C.white, fontStyle: 'bold', fontSize: 7.5, lineWidth: 0 },
    alternateRowStyles: { fillColor: C.g50 },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center', textColor: C.g500 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 15, halign: 'center' },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 27, halign: 'right' },
      5: { cellWidth: 14, halign: 'center', textColor: C.g500 },
      6: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (d) => {
      if (d.section === 'head' && [0, 2, 3, 5].includes(d.column.index)) d.cell.styles.halign = 'center';
      if (d.section === 'head' && [4, 6].includes(d.column.index)) d.cell.styles.halign = 'right';
    },
    didDrawPage: (d) => { if (d.pageNumber > 1) drawMiniHeader(doc, quote, businessName); },
    margin: { left: 14, right: 14, top: 19, bottom: 24 },
  });

  const state = { y: doc.lastAutoTable.finalY + 9 };
  const ensure = (h) => {
    if (state.y + h > PAGE_LIMIT) {
      doc.addPage();
      drawMiniHeader(doc, quote, businessName);
      state.y = 22;
    }
  };

  // ---- Totales (a la derecha) y datos de pago (a la izquierda)
  const rows = [['Subtotal', money(calc.subtotal)]];
  if (calc.discountTotal > 0) rows.push(['Descuento ya aplicado', money(calc.discountTotal), true]);
  if (quote.tax_mode === 'none') rows.push(['IVA', 'Sin IVA', true]);
  else rows.push([`IVA (${Number(quote.tax_rate) || 0}%)${quote.tax_mode === 'included' ? ' incluido' : ''}`, money(calc.tax)]);
  if (calc.retIsr > 0) rows.push([`Retención ISR (${Number(quote.ret_isr_rate)}%)`, `- ${money(calc.retIsr)}`]);
  if (calc.retIva > 0) rows.push([`Retención IVA (${Number(quote.ret_iva_rate)}%)`, `- ${money(calc.retIva)}`]);

  const rowsH = rows.length * 6.2;
  const totalsH = 8 + rowsH + 17;
  const bank = clean(settings.bank_info)
    ? wrapLines(doc, 96, [{ text: settings.bank_info }])
    : null;
  const bankH = bank ? cardHeight(bank) : 0;

  ensure(Math.max(totalsH, bankH) + 4);
  const boxY = state.y;
  doc.setFillColor(...C.g50);
  doc.setDrawColor(...C.g200);
  doc.setLineWidth(0.25);
  doc.roundedRect(124, boxY, 72, totalsH, 2.5, 2.5, 'FD');
  let ry = boxY + 8;
  rows.forEach(([label, value, muted]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(muted ? 8.3 : 9.3);
    doc.setTextColor(...(muted ? C.g500 : C.g700));
    doc.text(label, 128, ry);
    doc.setTextColor(...(muted ? C.g500 : C.g900));
    doc.text(value, 192, ry, { align: 'right' });
    ry += 6.2;
  });
  doc.setFillColor(...C.e600);
  doc.roundedRect(127, ry - 1, 66, 12.5, 2.5, 2.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.e100);
  doc.text(currency === 'MXN' ? 'TOTAL MXN' : 'TOTAL', 131, ry + 6.2);
  doc.setFontSize(12.5);
  doc.setTextColor(...C.white);
  doc.text(money(calc.total), 190, ry + 6.8, { align: 'right' });

  if (bank) {
    doc.setFillColor(...C.e50);
    doc.setDrawColor(...C.e100);
    doc.roundedRect(14, boxY, 104, bankH, 2.5, 2.5, 'FD');
    doc.setFillColor(...C.e500);
    doc.roundedRect(17, boxY + 3.5, 1.4, bankH - 7, 0.7, 0.7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.e700);
    doc.text('DATOS PARA PAGO', 22, boxY + 7);
    let by = boxY + 12.5;
    bank.forEach(({ t }) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.8);
      doc.setTextColor(...C.g700);
      doc.text(t, 22, by);
      by += 4.3;
    });
  }
  state.y = boxY + Math.max(totalsH, bankH) + 10;

  // ---- Condiciones
  const section = (title, text) => {
    if (!clean(text)) return;
    ensure(14);
    doc.setFillColor(...C.e500);
    doc.roundedRect(14, state.y - 3, 1.6, 4.2, 0.6, 0.6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...C.e700);
    doc.text(title.toUpperCase(), 18, state.y);
    state.y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...C.g700);
    doc.splitTextToSize(clean(text), 178).forEach((line) => {
      ensure(5);
      doc.text(line, 18, state.y);
      state.y += 4.3;
    });
    state.y += 4;
  };
  section('Condiciones de pago', quote.payment_terms);
  section('Tiempo de entrega', quote.delivery_time);
  section('Notas', quote.notes);

  // ---- Pie de página en todas las hojas
  const pages = doc.internal.getNumberOfPages();
  const contact = [settings.email, settings.phone, settings.website].filter(clean).join('  ·  ') || businessName;
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setFillColor(...C.g950);
    doc.rect(0, 285, 210, 12, 'F');
    gradientBar(doc, 0, 284, 210, 1, C.e500, C.e700);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.g300);
    doc.text(contact, 14, 291.5, { maxWidth: 150 });
    doc.setTextColor(...C.e300);
    doc.text(`Página ${i} de ${pages}`, 196, 291.5, { align: 'right' });
  }
  return doc;
}
