import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDateEs } from '../formatos/pdfTemplates';
import { calcQuote, formatMoney } from './quoteMath';

const NAVY = [30, 41, 59];
const ACCENT = [37, 99, 235];
const INK = [15, 23, 42];
const LABEL = [71, 85, 105];
const MUTED = [100, 116, 139];
const PAGE_LIMIT = 262;

const clean = (v) => (v == null ? '' : String(v).trim());

function imageFormat(dataUrl) {
  return /^data:image\/jpe?g/i.test(dataUrl) ? 'JPEG' : 'PNG';
}

// Bloque de texto (título pequeño + líneas) dentro de un ancho dado; devuelve el nuevo y.
function drawBlock(doc, x, y, width, title, lines) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...LABEL);
  doc.text(title, x, y);
  y += 5;
  lines.filter((l) => clean(l.text)).forEach(({ text, bold }) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 10.5 : 9);
    doc.setTextColor(...INK);
    doc.splitTextToSize(clean(text), width).forEach((line) => {
      doc.text(line, x, y);
      y += bold ? 5 : 4.3;
    });
  });
  return y;
}

function drawLongText(doc, state, label, text) {
  if (!clean(text)) return;
  if (state.y + 14 > PAGE_LIMIT) { doc.addPage(); state.y = 20; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...LABEL);
  doc.text(label.toUpperCase(), 14, state.y);
  state.y += 4.8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.splitTextToSize(clean(text), 182).forEach((line) => {
    if (state.y > PAGE_LIMIT) { doc.addPage(); state.y = 20; }
    doc.text(line, 14, state.y);
    state.y += 4.3;
  });
  state.y += 3;
}

// quote: registro con la forma de la tabla quotes (o el estado del editor ya convertido con quoteToRow).
export function renderQuotePDF(quote, settings = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const currency = quote.currency || 'MXN';
  const money = (v) => formatMoney(v, currency);
  const calc = calcQuote(quote);
  const client = quote.client_snapshot || {};
  const items = quote.items || [];

  // ---- Encabezado: logo o nombre comercial a la izquierda, datos del folio a la derecha
  const businessName = clean(settings.business_name) || clean(settings.legal_name) || 'Cotización';
  if (settings.logo) {
    const ratio = Number(settings.logo_ratio) || 3;
    let h = 20;
    let w = h * ratio;
    if (w > 62) { w = 62; h = w / ratio; }
    try {
      doc.addImage(settings.logo, imageFormat(settings.logo), 14, 10, w, h);
    } catch {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(17);
      doc.setTextColor(...INK);
      doc.text(businessName, 14, 20);
    }
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(...INK);
    doc.text(businessName, 14, 20);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...NAVY);
  doc.text('COTIZACIÓN', 196, 16, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...LABEL);
  doc.text(`Folio: ${quote.folio || 'Borrador'}`, 196, 22.5, { align: 'right' });
  doc.text(`Fecha: ${formatDateEs(quote.quote_date)}`, 196, 27.5, { align: 'right' });
  if (quote.valid_until) doc.text(`Vigencia: ${formatDateEs(quote.valid_until)}`, 196, 32.5, { align: 'right' });

  doc.setFillColor(...ACCENT);
  doc.rect(14, 38, 182, 1.2, 'F');

  // ---- Emisor y cliente
  const issuerName = clean(settings.legal_name) || clean(settings.business_name);
  const issuerEnd = drawBlock(doc, 14, 46, 86, 'DE', [
    { text: issuerName, bold: true },
    { text: settings.rfc ? `RFC: ${settings.rfc}` : '' },
    { text: settings.address },
    { text: [settings.phone, settings.email].filter(clean).join('  ·  ') },
    { text: settings.website },
  ]);
  const clientEnd = drawBlock(doc, 110, 46, 86, 'PARA', [
    { text: client.name || 'Cliente sin especificar', bold: true },
    { text: client.contact_name ? `Atención: ${client.contact_name}` : '' },
    { text: client.rfc ? `RFC: ${client.rfc}` : '' },
    { text: client.address },
    { text: [client.phone, client.email].filter(clean).join('  ·  ') },
  ]);

  // ---- Partidas
  autoTable(doc, {
    startY: Math.max(issuerEnd, clientEnd) + 6,
    head: [['#', 'Descripción', 'Cant.', 'Unidad', 'P. unitario', 'Desc.', 'Importe']],
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
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.4, textColor: INK, lineColor: [226, 232, 240], lineWidth: 0.1, overflow: 'linebreak' },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 15, halign: 'center' },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 27, halign: 'right' },
      5: { cellWidth: 14, halign: 'center' },
      6: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14, bottom: 20 },
  });

  // ---- Totales
  const state = { y: doc.lastAutoTable.finalY + 8 };
  const rows = [['Subtotal', money(calc.subtotal)]];
  if (calc.discountTotal > 0) rows.push([`Descuento ya aplicado`, money(calc.discountTotal), 'muted']);
  if (quote.tax_mode === 'none') rows.push(['IVA', 'Sin IVA', 'muted']);
  else rows.push([`IVA (${Number(quote.tax_rate) || 0}%)${quote.tax_mode === 'included' ? ' incluido' : ''}`, money(calc.tax)]);
  if (calc.retIsr > 0) rows.push([`Retención ISR (${Number(quote.ret_isr_rate)}%)`, `- ${money(calc.retIsr)}`]);
  if (calc.retIva > 0) rows.push([`Retención IVA (${Number(quote.ret_iva_rate)}%)`, `- ${money(calc.retIva)}`]);

  if (state.y + rows.length * 5.5 + 16 > PAGE_LIMIT) { doc.addPage(); state.y = 20; }
  rows.forEach(([label, value, tone]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(tone === 'muted' ? 8.5 : 9.5);
    doc.setTextColor(...(tone === 'muted' ? MUTED : LABEL));
    doc.text(label, 140, state.y);
    doc.setTextColor(...(tone === 'muted' ? MUTED : INK));
    doc.text(value, 196, state.y, { align: 'right' });
    state.y += 5.5;
  });
  doc.setDrawColor(203, 213, 225);
  doc.line(140, state.y - 2.5, 196, state.y - 2.5);
  state.y += 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...ACCENT);
  doc.text(currency === 'MXN' ? 'TOTAL MXN' : 'TOTAL', 140, state.y);
  doc.text(money(calc.total), 196, state.y, { align: 'right' });
  state.y += 12;

  // ---- Condiciones
  drawLongText(doc, state, 'Condiciones de pago', quote.payment_terms);
  drawLongText(doc, state, 'Tiempo de entrega', quote.delivery_time);
  if (quote.valid_until) drawLongText(doc, state, 'Vigencia de la cotización', `Esta cotización es válida hasta el ${formatDateEs(quote.valid_until)}.`);
  drawLongText(doc, state, 'Notas', quote.notes);
  drawLongText(doc, state, 'Datos para pago', settings.bank_info);

  // ---- Pie de página en todas las hojas
  const pages = doc.internal.getNumberOfPages();
  const contact = [businessName, settings.email, settings.phone, settings.website].filter(clean).join('  ·  ');
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(14, 283, 196, 283);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(contact, 14, 288, { maxWidth: 150 });
    doc.text(`Página ${i} de ${pages}`, 196, 288, { align: 'right' });
  }
  return doc;
}
