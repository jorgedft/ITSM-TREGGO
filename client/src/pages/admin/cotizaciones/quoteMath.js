// Cálculo de cotizaciones. Es la única fuente de verdad: el editor, la lista y
// el PDF muestran lo que devuelve calcQuote (y lo que se guarda en la base).
//
// tax_mode:
//   none     -> sin IVA / exento
//   add      -> los precios NO incluyen IVA; se suma al subtotal
//   included -> los precios YA incluyen IVA; se desglosa subtotal e IVA
// Las retenciones (ISR / IVA) se calculan sobre el subtotal, ya sin IVA.

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const num = (v) => Number(v) || 0;

export const TAX_MODES = [
  { value: 'add', label: 'Más IVA', hint: 'Los precios no incluyen IVA; se suma al subtotal' },
  { value: 'included', label: 'IVA incluido', hint: 'Los precios ya incluyen IVA; se desglosa' },
  { value: 'none', label: 'Sin IVA', hint: 'Exento o sin impuesto' },
];

// 10% ISR y 2/3 del IVA (10.6667%): retenciones habituales de servicios profesionales.
export const DEFAULT_RET_ISR = 10;
export const DEFAULT_RET_IVA = 10.6667;

export function lineAmounts(item) {
  const gross = num(item.quantity) * num(item.unit_price);
  const discount = gross * (num(item.discount_pct) / 100);
  return { gross, discount, net: gross - discount };
}

export function calcQuote({ items = [], tax_mode = 'add', tax_rate = 16, ret_isr_rate = 0, ret_iva_rate = 0 }) {
  const lines = items.map((it) => {
    const { gross, discount, net } = lineAmounts(it);
    return { gross: round2(gross), discount: round2(discount), net: round2(net) };
  });
  const netTotal = round2(lines.reduce((s, l) => s + l.net, 0));
  const discountTotal = round2(lines.reduce((s, l) => s + l.discount, 0));
  const rate = num(tax_rate) / 100;

  let subtotal = netTotal;
  let tax = 0;
  if (tax_mode === 'add') {
    tax = round2(netTotal * rate);
  } else if (tax_mode === 'included') {
    tax = round2(netTotal - netTotal / (1 + rate));
    subtotal = round2(netTotal - tax);
  }

  const retIsr = round2(subtotal * (num(ret_isr_rate) / 100));
  const retIva = tax_mode === 'none' ? 0 : round2(subtotal * (num(ret_iva_rate) / 100));
  const total = round2(subtotal + tax - retIsr - retIva);

  return { lines, subtotal, discountTotal, tax, retIsr, retIva, total };
}

export function formatMoney(value, currency = 'MXN') {
  return Number(value || 0).toLocaleString('es-MX', { style: 'currency', currency });
}

export function addDays(dateStr, days) {
  const d = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

export const QUOTE_STATUSES = [
  { value: 'borrador', label: 'Borrador', tone: 'slate' },
  { value: 'enviada', label: 'Enviada', tone: 'sky' },
  { value: 'aceptada', label: 'Aceptada', tone: 'emerald' },
  { value: 'rechazada', label: 'Rechazada', tone: 'red' },
];

export const TONES = {
  slate: 'bg-slate-800 text-slate-300 border-slate-700',
  sky: 'bg-sky-950/60 text-sky-400 border-sky-800/60',
  emerald: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60',
  red: 'bg-red-950/60 text-red-400 border-red-800/60',
  amber: 'bg-amber-950/60 text-amber-400 border-amber-800/60',
};

export function emptyItem() {
  return { description: '', detail: '', quantity: 1, unit: 'PZA', unit_price: 0, discount_pct: 0, catalog_id: null };
}

export function newQuote(settings) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    quote_date: today,
    valid_until: addDays(today, settings?.default_validity_days ?? 15),
    client_id: '',
    client_free: '',
    status: 'borrador',
    currency: 'MXN',
    items: [emptyItem()],
    tax_mode: 'add',
    tax_rate: 16,
    ret_isr_rate: 0,
    ret_iva_rate: 0,
    payment_terms: settings?.default_payment_terms || '',
    delivery_time: settings?.default_delivery || '',
    notes: settings?.default_notes || '',
  };
}

// Registro de la base -> estado del editor
export function quoteFromRow(row) {
  return {
    id: row.id,
    folio: row.folio,
    quote_date: row.quote_date,
    valid_until: row.valid_until || '',
    client_id: row.client_id || '',
    client_free: row.client_id ? '' : row.client_snapshot?.name || '',
    status: row.status,
    currency: row.currency,
    items: (row.items?.length ? row.items : [emptyItem()]).map((it) => ({ ...emptyItem(), ...it })),
    tax_mode: row.tax_mode,
    tax_rate: row.tax_rate,
    ret_isr_rate: row.ret_isr_rate,
    ret_iva_rate: row.ret_iva_rate,
    payment_terms: row.payment_terms || '',
    delivery_time: row.delivery_time || '',
    notes: row.notes || '',
  };
}

// Estado del editor -> registro de la base (con totales calculados y datos del cliente congelados)
export function quoteToRow(q, clients) {
  const items = q.items
    .filter((it) => (it.description || '').trim())
    .map((it) => ({
      description: it.description.trim(),
      detail: (it.detail || '').trim(),
      quantity: num(it.quantity),
      unit: it.unit || '',
      unit_price: num(it.unit_price),
      discount_pct: num(it.discount_pct),
      catalog_id: it.catalog_id || null,
    }));
  const calc = calcQuote({ ...q, items });
  const client = clients.find((c) => c.id === q.client_id);
  const snapshot = client
    ? { name: client.name, contact_name: client.contact_name, rfc: client.rfc, email: client.email, phone: client.phone, address: client.address }
    : { name: (q.client_free || '').trim() };

  return {
    quote_date: q.quote_date,
    valid_until: q.valid_until || null,
    client_id: client ? client.id : null,
    client_snapshot: snapshot,
    status: q.status,
    currency: q.currency,
    items,
    tax_mode: q.tax_mode,
    tax_rate: num(q.tax_rate),
    ret_isr_rate: num(q.ret_isr_rate),
    ret_iva_rate: q.tax_mode === 'none' ? 0 : num(q.ret_iva_rate),
    subtotal: calc.subtotal,
    discount_total: calc.discountTotal,
    tax_amount: calc.tax,
    ret_isr_amount: calc.retIsr,
    ret_iva_amount: calc.retIva,
    total: calc.total,
    payment_terms: (q.payment_terms || '').trim() || null,
    delivery_time: (q.delivery_time || '').trim() || null,
    notes: (q.notes || '').trim() || null,
  };
}
