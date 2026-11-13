import JSZip from 'jszip';
import templateUrl from '../../../assets/templates/solicitud-compra-template.xlsx?url';
import { formatDateEs } from './pdfTemplates';

const SHEET_PATH = 'xl/worksheets/sheet1.xml';

function escapeXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Reemplaza el contenido de una celda <c r="REF" .../> o <c r="REF" ...>...</c>
// existente en el XML de la hoja, sin tocar nada más (estilos, merges, imagen).
function setCell(xml, ref, { text, number } = {}) {
  const re = new RegExp(`<c r="${ref}"([^>]*?)(?:\\s*/>|>([\\s\\S]*?)</c>)`);
  if (!re.test(xml)) return xml; // celda no encontrada: no rompe nada, solo se omite
  return xml.replace(re, (_match, attrs) => {
    const cleanAttrs = attrs.replace(/\s*t="[^"]*"/, '');
    if (number !== undefined) {
      const n = Number(number) || 0;
      return `<c r="${ref}"${cleanAttrs}><v>${n}</v></c>`;
    }
    return `<c r="${ref}"${cleanAttrs} t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
  });
}

function pad(width, marked) {
  if (!marked) return ' '.repeat(width);
  const left = Math.floor((width - 1) / 2);
  const right = width - 1 - left;
  return ' '.repeat(Math.max(left, 0)) + 'X' + ' '.repeat(Math.max(right, 0));
}

function buildInvoiceLine(issuesInvoice) {
  const si = pad(3, issuesInvoice === true);
  const no = pad(7, issuesInvoice === false);
  return `¿EMITE FACTURA?  SÍ (${si})     NO (${no}) `;
}

function buildConditionsLine(method) {
  const efectivo = pad(9, method === 'efectivo');
  const transferencia = pad(3, method === 'transferencia');
  const credito = pad(9, method === 'credito');
  const tdc = pad(3, method === 'tdc');
  const otro = pad(9, method === 'otro');
  return `CONDICIONES DE PAGO: EFECTIVO (${efectivo})    TRANSFERENCIA (${transferencia})    CRÉDITO (${credito})    TDC (${tdc})    OTRO (${otro})    `;
}

const MAX_ITEMS = 5;

export async function exportSolicitudCompraFromTemplate(data, filename) {
  const res = await fetch(templateUrl);
  if (!res.ok) throw new Error('No se pudo cargar la plantilla de Solicitud de Compra.');
  const buf = await res.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);

  let xml = await zip.file(SHEET_PATH).async('string');

  const items = (data.items || []).slice(0, MAX_ITEMS);
  if ((data.items || []).length > MAX_ITEMS) {
    // eslint-disable-next-line no-console
    console.warn(`La plantilla de Solicitud de Compra admite máximo ${MAX_ITEMS} partidas; se omitieron las adicionales.`);
  }

  xml = setCell(xml, 'A3', { text: data.folio ? `SOLICITUD DE COMPRA   No. ${data.folio}` : 'SOLICITUD DE COMPRA' });
  xml = setCell(xml, 'B5', { text: formatDateEs(data.request_date) });
  xml = setCell(xml, 'D5', { text: `ÁREA SOLICITANTE:                      ${data.requesting_area || ''}` });
  xml = setCell(xml, 'B6', { text: data.requester || '' });
  xml = setCell(xml, 'D6', { text: `CENTRO DE COSTO:   ${data.cost_center || ''}` });
  xml = setCell(xml, 'A8', { text: `PROVEEDOR:  ${data.provider || ''}` });
  xml = setCell(xml, 'A9', { text: buildInvoiceLine(data.issues_invoice) });
  xml = setCell(xml, 'A10', { text: buildConditionsLine(data.payment_method) });
  xml = setCell(xml, 'A11', { text: `DATOS BANCARIOS:  ${data.bank_details || ''}` });
  xml = setCell(xml, 'A13', {
    text: `FECHA DE PAGO (CONSIDERA QUE LOS PAGOS SE REALIZAN LOS DIAS JUEVES):  ${formatDateEs(data.payment_date)}`,
  });

  items.forEach((it, i) => {
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
    text: `1. Fecha de producto y/o servicio requerido (CONSIDERA MINIMO 5 DIAS HABILES): ${formatDateEs(data.required_date)}`,
  });
  xml = setCell(xml, 'A30', { text: `Justificación de la compra: ${data.justification || ''}` });

  zip.file(SHEET_PATH, xml);
  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `solicitud-compra-${Date.now()}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
