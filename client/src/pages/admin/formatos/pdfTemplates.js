import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TREGGO_LOGO_PNG } from './logoBase64';

const LOGO_ASPECT = 1583 / 114; // ancho/alto real del logo

const NAVY = [30, 41, 59];
const ACCENT = [37, 99, 235];
const MUTED = [100, 116, 139];
const INK = [15, 23, 42];
const LABEL = [71, 85, 105];

export const PAYMENT_METHOD_LABELS = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  credito: 'Crédito',
  tdc: 'TDC',
  otro: 'Otro',
};

export function formatDateEs(value) {
  if (!value) return '-';
  const [y, m, d] = String(value).split('-');
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

export function formatCurrency(value) {
  const n = Number(value || 0);
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

export function computeItemsSubtotal(items, qtyField, costField) {
  return (items || []).reduce((sum, it) => sum + (Number(it[qtyField]) || 0) * (Number(it[costField]) || 0), 0);
}

function drawHeader(doc, title, folio) {
  // Logo real (fondo transparente) sobre la banda blanca superior, antes del
  // banner de color — el logo tiene texto oscuro, así que no se dibuja sobre
  // fondo navy (quedaría ilegible).
  const logoW = 55;
  const logoH = logoW / LOGO_ASPECT;
  doc.addImage(TREGGO_LOGO_PNG, 'PNG', 14, 3.5, logoW, logoH);

  doc.setFillColor(...NAVY);
  doc.rect(0, 12, 210, 18, 'F');
  doc.setFillColor(...ACCENT);
  doc.rect(0, 30, 210, 1.3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(title, 14, 23);

  if (folio) {
    doc.setFontSize(8.5);
    doc.setTextColor(203, 213, 225);
    doc.text(`Folio: ${folio}`, 196, 18, { align: 'right' });
  }
  const nowStr = new Date().toLocaleString('es-MX');
  doc.setFontSize(7.5);
  doc.text(`Generado: ${nowStr}`, 196, 25, { align: 'right' });
}

function drawFooter(doc, text) {
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(14, 283, 196, 283);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(text, 14, 288);
    doc.text(`Página ${i} de ${pageCount}`, 196, 288, { align: 'right' });
  }
}

// Dibuja pares [etiqueta, valor] en una rejilla de `cols` columnas, respetando
// saltos de línea para valores largos. Devuelve el nuevo cursor Y.
function drawFieldGrid(doc, startY, fields, { cols = 2, colWidth = 90, rowHeight = 11, startX = 14 } = {}) {
  let y = startY;
  let maxExtra = 0;
  fields.forEach((pair, i) => {
    if (!pair) return;
    const [label, value] = pair;
    const col = i % cols;
    const x = startX + col * colWidth;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...LABEL);
    doc.text(label.toUpperCase(), x, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    const lines = doc.splitTextToSize(String(value ?? '-') || '-', colWidth - 4);
    doc.text(lines, x, y + 4.8);
    maxExtra = Math.max(maxExtra, (lines.length - 1) * 4.2);

    if (col === cols - 1 || i === fields.length - 1) {
      y += rowHeight + maxExtra;
      maxExtra = 0;
    }
  });
  return y;
}

function drawSectionTitle(doc, y, title) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...ACCENT);
  doc.text(title.toUpperCase(), 14, y);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(14, y + 1.5, 196, y + 1.5);
  return y + 7;
}

function drawTotalsBlock(doc, startY, rows, highlightLast = true) {
  const labelX = 140;
  const valueX = 196;
  let y = startY;
  rows.forEach(([label, value], idx) => {
    const isLast = idx === rows.length - 1;
    if (isLast && highlightLast) {
      doc.setDrawColor(203, 213, 225);
      doc.line(labelX, y - 4, valueX, y - 4);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...ACCENT);
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...LABEL);
    }
    doc.text(label, labelX, y);
    if (!(isLast && highlightLast)) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...INK);
    }
    doc.text(formatCurrency(value), valueX, y, { align: 'right' });
    y += isLast && highlightLast ? 7 : 5.5;
  });
  doc.setTextColor(...INK);
  return y;
}

function drawSignatures(doc, startY, labels) {
  let y = startY + 14;
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.line(14, y, 90, y);
  doc.line(120, y, 196, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(labels[0], 14, y + 4);
  doc.text(labels[1], 120, y + 4);
  return y + 4;
}

export function renderSolicitudCompraPDF(data) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  drawHeader(doc, 'Solicitud de Compra', data.folio);

  let y = drawFieldGrid(doc, 37, [
    ['Fecha de solicitud', formatDateEs(data.request_date)],
    ['Área solicitante', data.requesting_area],
    ['Solicitante', data.requester],
    ['Centro de costo', data.cost_center],
    ['Proveedor', data.provider],
    ['¿Emite factura?', data.issues_invoice ? 'Sí' : 'No'],
    ['Condiciones de pago', PAYMENT_METHOD_LABELS[data.payment_method] || data.payment_method],
    ['Fecha de pago', formatDateEs(data.payment_date)],
    data.bank_details ? ['Datos bancarios', data.bank_details] : null,
  ].filter(Boolean));

  y += 3;
  y = drawSectionTitle(doc, y, 'Partidas solicitadas');

  const items = data.items || [];
  autoTable(doc, {
    startY: y,
    head: [['Item', 'Descripción', 'Cant.', 'Unidad', 'Costo Unit.', 'Costo Total', 'Proveedor']],
    body: items.length
      ? items.map((it, i) => [
          i + 1,
          it.description || '-',
          it.quantity ?? '-',
          it.unit || '-',
          formatCurrency(it.unit_cost),
          formatCurrency((Number(it.quantity) || 0) * (Number(it.unit_cost) || 0)),
          it.provider || '-',
        ])
      : [['-', 'Sin partidas registradas', '-', '-', '-', '-', '-']],
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.3, textColor: INK, lineColor: [226, 232, 240], lineWidth: 0.1 },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 14, halign: 'center' },
      3: { cellWidth: 16, halign: 'center' },
      4: { cellWidth: 24, halign: 'right' },
      5: { cellWidth: 26, halign: 'right' },
      6: { cellWidth: 28 },
    },
    margin: { left: 14, right: 14, bottom: 20 },
  });

  const subtotal = computeItemsSubtotal(items, 'quantity', 'unit_cost');
  const total = subtotal + (Number(data.iva) || 0) + (Number(data.other_tax) || 0);

  y = drawTotalsBlock(doc, doc.lastAutoTable.finalY + 8, [
    ['SUBTOTAL:', subtotal],
    ['IVA:', data.iva],
    ['OTRO IMPUESTO:', data.other_tax],
    ['TOTAL:', total],
  ]);

  y += 4;
  if (data.required_date) {
    y = drawFieldGrid(doc, y, [['Fecha de producto/servicio requerido (mínimo 5 días hábiles)', formatDateEs(data.required_date)]], { cols: 1, colWidth: 182 });
  }
  if (data.justification) {
    y = drawFieldGrid(doc, y, [['Justificación de la compra', data.justification]], { cols: 1, colWidth: 182 });
  }

  drawSignatures(doc, y, ['Elaboró', 'Autorizó']);
  drawFooter(doc, 'ITSM Sistema de Gestión de TI - Formato de Solicitud de Compra');
  return doc;
}

export function renderOrdenCompraPDF(data) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  drawHeader(doc, 'Orden de Compra', data.folio || data.order_number);

  let y = drawFieldGrid(doc, 37, [
    ['Fecha de solicitud', formatDateEs(data.request_date)],
    ['Estatus', data.status],
    ['Solicitante', data.requester],
    ['Depto. / Centro de costo', data.department],
    ['Tipo de gasto', data.expense_type],
    ['Proveedor', data.provider],
    data.description ? ['Descripción de lo solicitado', data.description] : null,
  ].filter(Boolean));

  y += 3;
  y = drawSectionTitle(doc, y, 'Partidas — detalle de productos');

  const items = data.items || [];
  autoTable(doc, {
    startY: y,
    head: [['Descripción', 'Cantidad', 'Unidad', 'Precio Unitario', 'Precio Total']],
    body: items.length
      ? items.map((it) => [
          it.description || '-',
          it.quantity ?? '-',
          it.unit || '-',
          formatCurrency(it.unit_price),
          formatCurrency((Number(it.quantity) || 0) * (Number(it.unit_price) || 0)),
        ])
      : [['Sin partidas registradas', '-', '-', '-', '-']],
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.3, textColor: INK, lineColor: [226, 232, 240], lineWidth: 0.1 },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 28, halign: 'right' },
      4: { cellWidth: 28, halign: 'right' },
    },
    margin: { left: 14, right: 14, bottom: 20 },
  });

  const subtotal = computeItemsSubtotal(items, 'quantity', 'unit_price');
  const iva = subtotal * 0.16;
  const total = subtotal + iva;

  y = drawTotalsBlock(doc, doc.lastAutoTable.finalY + 8, [
    ['Subtotal:', subtotal],
    ['I.V.A. (16%):', iva],
    ['TOTAL CON I.V.A.:', total],
  ]);

  y += 4;
  y = drawSectionTitle(doc, y, 'Datos de la orden de compra');
  y = drawFieldGrid(doc, y, [
    ['No. de orden de compra', data.order_number],
    ['Fecha de la orden', formatDateEs(data.order_date)],
    ['Proveedor adjudicado', data.awarded_provider],
    ['Condiciones de pago', data.payment_terms],
    ['Tiempo de entrega', data.delivery_time],
    ['No. PO en NetSuite', data.netsuite_po],
  ].filter(([, v]) => v));

  drawSignatures(doc, y, [data.elaborated_by ? `Elaboró: ${data.elaborated_by}` : 'Elaboró (Compras)', data.authorized_by ? `Autorizó: ${data.authorized_by}` : 'Autorizó (Dirección)']);
  drawFooter(doc, 'ITSM Sistema de Gestión de TI - Formato de Orden de Compra');
  return doc;
}

export function printPdf(doc) {
  doc.autoPrint();
  const blobUrl = doc.output('bloburl');
  window.open(blobUrl, '_blank');
}
