import JSZip from 'jszip';
import solicitudTemplateUrl from '../../../assets/templates/solicitud-compra-template.xlsx?url';
import ordenTemplateUrl from '../../../assets/templates/orden-compra-template.xlsx?url';
import { formatDateEs } from './pdfTemplates';

// Los Excel se generan a partir de las plantillas reales de la empresa (con
// logo, estilos, merges y fórmulas). Solo se inyectan valores en el XML de la
// hoja: SheetJS descarta las imágenes incrustadas al reescribir un libro.

const SHEET_PATH = 'xl/worksheets/sheet1.xml';
export const MAX_TEMPLATE_ITEMS = 5;

function escapeXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setCell(xml, ref, { text, number } = {}) {
  const re = new RegExp(`<c r="${ref}"([^>]*?)(?:\\s*/>|>([\\s\\S]*?)</c>)`);
  if (!re.test(xml)) return xml;
  return xml.replace(re, (_match, attrs) => {
    const cleanAttrs = attrs.replace(/\s*t="[^"]*"/, '');
    if (number !== undefined) {
      return `<c r="${ref}"${cleanAttrs}><v>${Number(number) || 0}</v></c>`;
    }
    return `<c r="${ref}"${cleanAttrs} t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
  });
}

async function fillTemplate(templateUrl, fill, filename) {
  const res = await fetch(templateUrl);
  if (!res.ok) throw new Error('No se pudo cargar la plantilla de Excel.');
  const zip = await JSZip.loadAsync(await res.arrayBuffer());
  const xml = await zip.file(SHEET_PATH).async('string');
  zip.file(SHEET_PATH, fill(xml));
  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function pad(width, marked) {
  if (!marked) return ' '.repeat(width);
  const left = Math.floor((width - 1) / 2);
  return ' '.repeat(left) + 'X' + ' '.repeat(width - 1 - left);
}

function buildInvoiceLine(issuesInvoice) {
  return `¿EMITE FACTURA?  SÍ (${pad(3, issuesInvoice === true)})     NO (${pad(7, issuesInvoice === false)}) `;
}

function buildConditionsLine(method) {
  return `CONDICIONES DE PAGO: EFECTIVO (${pad(9, method === 'efectivo')})    TRANSFERENCIA (${pad(3, method === 'transferencia')})    CRÉDITO (${pad(9, method === 'credito')})    TDC (${pad(3, method === 'tdc')})    OTRO (${pad(9, method === 'otro')})    `;
}

const dateOrBlank = (value) => (value ? formatDateEs(value) : '');

export function exportSolicitudCompraExcel(data, filename) {
  return fillTemplate(solicitudTemplateUrl, (source) => {
    let xml = source;
    xml = setCell(xml, 'A3', { text: data.folio ? `SOLICITUD DE COMPRA   No. ${data.folio}` : 'SOLICITUD DE COMPRA' });
    xml = setCell(xml, 'B5', { text: dateOrBlank(data.request_date) });
    xml = setCell(xml, 'D5', { text: `ÁREA SOLICITANTE:                      ${data.requesting_area || ''}` });
    xml = setCell(xml, 'B6', { text: data.requester || '' });
    xml = setCell(xml, 'D6', { text: `CENTRO DE COSTO:   ${data.cost_center || ''}` });
    xml = setCell(xml, 'A8', { text: `PROVEEDOR:  ${data.provider || ''}` });
    xml = setCell(xml, 'A9', { text: buildInvoiceLine(data.issues_invoice) });
    xml = setCell(xml, 'A10', { text: buildConditionsLine(data.payment_method) });
    xml = setCell(xml, 'A11', { text: `DATOS BANCARIOS:  ${data.bank_details || ''}` });
    xml = setCell(xml, 'A13', {
      text: `FECHA DE PAGO (CONSIDERA QUE LOS PAGOS SE REALIZAN LOS DIAS JUEVES):  ${dateOrBlank(data.payment_date)}`,
    });

    (data.items || []).slice(0, MAX_TEMPLATE_ITEMS).forEach((it, i) => {
      const row = 18 + i;
      xml = setCell(xml, `B${row}`, { text: it.description || '' });
      xml = setCell(xml, `C${row}`, { number: it.quantity });
      xml = setCell(xml, `D${row}`, { text: it.unit || '' });
      xml = setCell(xml, `E${row}`, { number: it.unit_cost });
      xml = setCell(xml, `G${row}`, { text: it.provider || '' });
    });

    xml = setCell(xml, 'F24', { number: data.iva });
    xml = setCell(xml, 'F25', { number: data.other_tax });
    xml = setCell(xml, 'A28', {
      text: `1. Fecha de producto y/o servicio requerido (CONSIDERA MINIMO 5 DIAS HABILES): ${dateOrBlank(data.required_date)}`,
    });
    xml = setCell(xml, 'A30', { text: `Justificación de la compra: ${data.justification || ''}` });
    return xml;
  }, filename);
}

const STATUS_LABELS = { pendiente: 'Pendiente', aprobada: 'Aprobada', rechazada: 'Rechazada' };

export function exportOrdenCompraExcel(data, filename) {
  return fillTemplate(ordenTemplateUrl, (source) => {
    let xml = source;
    xml = setCell(xml, 'B5', { text: data.folio || '' });
    xml = setCell(xml, 'B8', { text: dateOrBlank(data.request_date) });
    xml = setCell(xml, 'D8', { text: STATUS_LABELS[data.status] || data.status || '' });
    xml = setCell(xml, 'B9', { text: data.requester || '' });
    xml = setCell(xml, 'B10', { text: data.department || '' });
    xml = setCell(xml, 'B11', { text: data.expense_type || '' });
    xml = setCell(xml, 'B12', { text: data.provider || '' });
    xml = setCell(xml, 'B13', { text: data.description || '' });

    (data.items || []).slice(0, MAX_TEMPLATE_ITEMS).forEach((it, i) => {
      const row = 17 + i;
      xml = setCell(xml, `A${row}`, { text: it.description || '' });
      xml = setCell(xml, `B${row}`, { number: it.quantity });
      xml = setCell(xml, `C${row}`, { text: it.unit || '' });
      xml = setCell(xml, `D${row}`, { number: it.unit_price });
    });

    xml = setCell(xml, 'B27', { text: data.order_number || '' });
    xml = setCell(xml, 'B28', { text: dateOrBlank(data.order_date) });
    xml = setCell(xml, 'B29', { text: data.awarded_provider || '' });
    xml = setCell(xml, 'B30', { text: data.payment_terms || '' });
    xml = setCell(xml, 'B31', { text: data.delivery_time || '' });
    xml = setCell(xml, 'B32', { text: data.netsuite_po || '' });
    xml = setCell(xml, 'A35', { text: `Elaboró (Compras)${data.elaborated_by ? `: ${data.elaborated_by}` : ''}` });
    xml = setCell(xml, 'D35', { text: `Autorizó (Dirección)${data.authorized_by ? `: ${data.authorized_by}` : ''}` });
    return xml;
  }, filename);
}
