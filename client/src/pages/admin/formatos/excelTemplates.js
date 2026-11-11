import * as XLSX from 'xlsx';
import { PAYMENT_METHOD_LABELS, formatDateEs } from './pdfTemplates';

function downloadWorkbook(ws, sheetName, filename) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename, { bookType: 'xlsx' });
}

// Construye la hoja de "Solicitud de Compra" replicando el orden de campos
// del formato original (SOLICITUD DE COMPRAS NUEVO FORMATO TREGGO.xlsx),
// con fórmulas reales (no valores fijos) para costo total/subtotal/total.
export function exportSolicitudCompraExcel(data, filename) {
  const items = data.items || [];
  const rows = [];

  rows.push(['SOLICITUD DE COMPRA']);
  rows.push([]);
  rows.push(['Fecha de solicitud', formatDateEs(data.request_date), '', 'Área solicitante', data.requesting_area || '']);
  rows.push(['Solicitante', data.requester || '', '', 'Centro de costo', data.cost_center || '']);
  rows.push(['Proveedor', data.provider || '', '', '¿Emite factura?', data.issues_invoice ? 'Sí' : 'No']);
  rows.push(['Condiciones de pago', PAYMENT_METHOD_LABELS[data.payment_method] || data.payment_method || '', '', 'Fecha de pago', formatDateEs(data.payment_date)]);
  rows.push(['Datos bancarios', data.bank_details || '']);
  rows.push([]);

  rows.push(['Item', 'Descripción', 'Cantidad', 'Unidad', 'Costo Unitario', 'Costo Total', 'Proveedor']);
  const itemsStartRow = rows.length + 1; // fila Excel (1-indexada) del primer renglón de items
  items.forEach((it, i) => {
    rows.push([i + 1, it.description || '', it.quantity ?? '', it.unit || '', Number(it.unit_cost) || 0, null, it.provider || '']);
  });
  const itemsEndRow = rows.length; // fila Excel del último renglón de items
  rows.push([]);

  const subtotalRow = rows.length + 1;
  rows.push(['', '', '', '', 'SUBTOTAL', null]);
  const ivaRow = subtotalRow + 1;
  rows.push(['', '', '', '', 'IVA', Number(data.iva) || 0]);
  const otroRow = subtotalRow + 2;
  rows.push(['', '', '', '', 'OTRO IMPUESTO', Number(data.other_tax) || 0]);
  const totalRow = subtotalRow + 3;
  rows.push(['', '', '', '', 'TOTAL', null]);
  rows.push([]);

  rows.push(['Fecha de producto/servicio requerido', formatDateEs(data.required_date)]);
  rows.push(['Justificación de la compra', data.justification || '']);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  for (let r = itemsStartRow; r <= itemsEndRow; r += 1) {
    ws[`F${r}`] = { t: 'n', f: `C${r}*E${r}` };
  }
  ws[`F${subtotalRow}`] = {
    t: 'n',
    f: itemsEndRow >= itemsStartRow ? `SUM(F${itemsStartRow}:F${itemsEndRow})` : '0',
  };
  ws[`F${totalRow}`] = { t: 'n', f: `F${subtotalRow}+F${ivaRow}+F${otroRow}` };

  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
  ws['!cols'] = [{ wch: 8 }, { wch: 36 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 20 }];

  downloadWorkbook(ws, 'Solicitud de Compra', filename || `solicitud-compra-${Date.now()}.xlsx`);
}

// Construye la hoja de "Orden de Compra" replicando el orden de campos del
// formato original (Formato_Orden_de_Compra_OC-xxxx.xlsx).
export function exportOrdenCompraExcel(data, filename) {
  const items = data.items || [];
  const rows = [];

  rows.push(['TREGGO', '', 'ORDEN DE COMPRA']);
  rows.push([]);
  rows.push(['Folio de solicitud', data.folio || '']);
  rows.push([]);
  rows.push(['DATOS DE LA ORDEN DE COMPRA']);
  rows.push(['Fecha solicitud', formatDateEs(data.request_date), '', 'Estatus', data.status || '']);
  rows.push(['Solicitante', data.requester || '']);
  rows.push(['Depto / Centro de costo', data.department || '']);
  rows.push(['Tipo de gasto', data.expense_type || '']);
  rows.push(['Proveedor', data.provider || '']);
  rows.push(['Descripción de lo solicitado', data.description || '']);
  rows.push([]);

  rows.push(['Descripción del producto', 'Cantidad', 'Unidad', 'Precio unitario', 'Precio total']);
  const itemsStartRow = rows.length + 1;
  items.forEach((it) => {
    rows.push([it.description || '', it.quantity ?? '', it.unit || '', Number(it.unit_price) || 0, null]);
  });
  const itemsEndRow = rows.length;
  const subtotalRow = itemsEndRow + 1;
  rows.push(['', '', '', 'Subtotal', null]);
  const ivaRow = subtotalRow + 1;
  rows.push(['', '', '', 'I.V.A. (16%)', null]);
  const totalRow = subtotalRow + 2;
  rows.push(['', '', '', 'TOTAL CON I.V.A.', null]);
  rows.push([]);

  rows.push(['DATOS DE LA ORDEN DE COMPRA (seguimiento)']);
  rows.push(['No. de Orden de Compra', data.order_number || '']);
  rows.push(['Fecha de la orden', formatDateEs(data.order_date)]);
  rows.push(['Proveedor adjudicado', data.awarded_provider || '']);
  rows.push(['Condiciones de pago', data.payment_terms || '']);
  rows.push(['Tiempo de entrega', data.delivery_time || '']);
  rows.push(['No. PO en NetSuite', data.netsuite_po || '']);
  rows.push([]);
  rows.push(['Elaboró (Compras)', data.elaborated_by || '', '', 'Autorizó (Dirección)', data.authorized_by || '']);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  for (let r = itemsStartRow; r <= itemsEndRow; r += 1) {
    ws[`E${r}`] = { t: 'n', f: `B${r}*D${r}` };
  }
  ws[`E${subtotalRow}`] = {
    t: 'n',
    f: itemsEndRow >= itemsStartRow ? `SUM(E${itemsStartRow}:E${itemsEndRow})` : '0',
  };
  ws[`E${ivaRow}`] = { t: 'n', f: `E${subtotalRow}*0.16` };
  ws[`E${totalRow}`] = { t: 'n', f: `E${subtotalRow}+E${ivaRow}` };

  ws['!cols'] = [{ wch: 34 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 16 }];

  downloadWorkbook(ws, 'Orden de Compra', filename || `orden-compra-${data.order_number || Date.now()}.xlsx`);
}
