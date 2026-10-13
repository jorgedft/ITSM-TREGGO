import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import {
  Plus, FileSpreadsheet, FileText, CheckCircle2, AlertTriangle, XCircle,
  Trash2, Upload, Download,
} from 'lucide-react';
import { useRole } from '../../hooks/useRole';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

function normalizeHeader(h) {
  return String(h || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Alias de encabezados aceptados al importar -> campo real de la tabla "phones".
const IMPORT_HEADER_ALIASES = {
  'marca': 'brand',
  'modelo': 'model',
  'imei': 'imei',
  'numero sim': 'phone_number',
  'numero': 'phone_number',
  'telefono': 'phone_number',
  'linea': 'phone_number',
  'asignado a': 'assigned_to',
  'asignado': 'assigned_to',
  'dpto': 'department',
  'departamento': 'department',
  'plan contrato': 'contract_plan',
  'plan': 'contract_plan',
  'esim': 'esim',
  'tipo sim': 'esim',
  'inicio serv': 'service_start_date',
  'fecha inicio': 'service_start_date',
  'inicio': 'service_start_date',
  'fin serv': 'service_end_date',
  'fecha fin': 'service_end_date',
  'fin': 'service_end_date',
};

function parseEsimValue(raw) {
  const v = normalizeHeader(raw);
  if (!v) return null;
  if (['si', 'sí', 'esim', 'true', 'yes'].includes(v)) return true;
  if (['no', 'fisica', 'física', 'false'].includes(v)) return false;
  return null;
}

function parseImportDate(raw) {
  const str = String(raw || '').trim();
  if (!str) return null;
  // dd/mm/aaaa -> aaaa-mm-dd
  const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return str; // ya viene en formato aaaa-mm-dd u otro aceptado por <input type="date">
}

// Considera "placeholder" valores como "SNXXXXXXXXXX" (sin dato real).
function isPlaceholder(value) {
  return /x{3,}/i.test(String(value || ''));
}
function hasRealValue(value) {
  return Boolean(value && String(value).trim()) && !isPlaceholder(value);
}

// Campos clave para considerar un dispositivo "completo". No incluye
// "Asignado a": un teléfono disponible sin asignar es válido.
const PHONE_COMPLETENESS_FIELDS = ['brand', 'model', 'imei', 'phone_number', 'contract_plan', 'department'];

function getPhoneCompleteness(item) {
  const filled = PHONE_COMPLETENESS_FIELDS.filter((f) => hasRealValue(item[f])).length;
  if (filled === PHONE_COMPLETENESS_FIELDS.length) return 'complete';
  if (filled === 0) return 'empty';
  return 'partial';
}

const COMPLETENESS_META = {
  complete: { label: 'Completo',   icon: CheckCircle2,  className: 'text-emerald-500' },
  partial:  { label: 'Incompleto', icon: AlertTriangle, className: 'text-amber-500' },
  empty:    { label: 'Sin datos',  icon: XCircle,        className: 'text-red-500' },
};

const COMPLETENESS_PDF_FILL = {
  complete: [220, 252, 231], // emerald-100
  partial:  [254, 243, 199], // amber-100
  empty:    [254, 226, 226], // red-100
};

// Resumen estadístico del inventario de telefonía (respeta filtros activos).
function computePhoneStats(phones) {
  const count = (pred) => phones.filter(pred).length;
  const completenessCounts = phones.reduce((acc, item) => {
    const c = getPhoneCompleteness(item);
    acc[c] = (acc[c] || 0) + 1;
    return acc;
  }, {});
  return {
    total: phones.length,
    asignados: count((p) => p.assigned_to && p.assigned_to.trim() !== ''),
    sinAsignar: count((p) => !p.assigned_to || p.assigned_to.trim() === ''),
    esim: count((p) => p.esim === true || p.esim === 'true'),
    simFisica: count((p) => p.esim === false || p.esim === 'false'),
    datosCompletos: completenessCounts.complete || 0,
    datosIncompletos: completenessCounts.partial || 0,
    datosSinInfo: completenessCounts.empty || 0,
  };
}

function escapeCSV(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function PhoneList() {
  const { canManageTI } = useRole();
  const navigate = useNavigate();
  const [phones, setPhones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchPhones();
  }, []);

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected((prev) => (prev.size === phones.length ? new Set() : new Set(phones.map((p) => p.id))));
  };

  const handleDeleteOne = async (id) => {
    if (!window.confirm('¿Eliminar este dispositivo? Esta acción no se puede deshacer.')) return;
    const { error } = await supabase.from('phones').delete().eq('id', id);
    if (error) {
      alert('Error al eliminar: ' + error.message);
      return;
    }
    setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
    fetchPhones();
  };

  const handleDeleteSelected = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!window.confirm(`¿Eliminar ${ids.length} dispositivo(s) seleccionado(s)? Esta acción no se puede deshacer.`)) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('phones').delete().in('id', ids);
      if (error) throw error;
      setSelected(new Set());
      fetchPhones();
    } catch (err) {
      alert('Error al eliminar: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const headers = ['Marca', 'Modelo', 'IMEI', 'Número / SIM', 'Asignado a', 'Dpto.', 'Plan Contrato', 'eSIM', 'Inicio Serv.', 'Fin Serv.'];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
    XLSX.writeFile(wb, 'plantilla_telefonia.xlsx', { bookType: 'xlsx' });
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (rows.length === 0) {
        alert('El archivo no tiene filas para importar.');
        return;
      }

      const payload = rows.map((row) => {
        const record = {};
        Object.entries(row).forEach(([header, value]) => {
          const norm = normalizeHeader(header);
          const str = String(value ?? '').trim();
          if (norm === 'dispositivo') {
            // Compatibilidad con el formato de exportación actual (Marca + Modelo combinados).
            const [brand, ...rest] = str.split(' ');
            if (!record.brand) record.brand = brand || '';
            if (!record.model) record.model = rest.join(' ') || '';
            return;
          }
          const field = IMPORT_HEADER_ALIASES[norm];
          if (!field || str === '') return;
          if (field === 'esim') record[field] = parseEsimValue(str);
          else if (field === 'service_start_date' || field === 'service_end_date') record[field] = parseImportDate(str);
          else record[field] = str;
        });
        return record;
      }).filter((r) => r.brand || r.model || r.imei || r.phone_number);

      if (payload.length === 0) {
        alert('No se encontraron filas válidas (se necesita al menos Marca, Modelo, IMEI o Número).');
        return;
      }

      const { error } = await supabase.from('phones').insert(payload);
      if (error) throw error;

      alert(`Se importaron ${payload.length} dispositivo(s).`);
      fetchPhones();
    } catch (err) {
      alert('Error al importar: ' + err.message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const fetchPhones = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('phones')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      console.log('Datos traídos de Supabase:', data); // Log de depuración
      setPhones(data || []);
    } catch (err) {
      console.error('Error al cargar la telefonía:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const getEsimText = (esim) => {
    if (esim === true || esim === 'true') return 'eSIM';
    if (esim === false || esim === 'false') return 'Física';
    return '-';
  };

  const handleExportCSV = () => {
    try {
      setExporting(true);
      const headers = [
        'Dispositivo',
        'Número / SIM',
        'IMEI',
        'Asignado a',
        'Dpto.',
        'Plan Contrato',
        'Tipo SIM',
        'Inicio Serv.',
        'Fin Serv.',
      ];
      const rows = phones.map((phone) => [
        `${phone.brand || ''} ${phone.model || ''}`.trim() || 'Sin especificar',
        phone.phone_number || 'Sin Línea',
        phone.imei || phone.imei1 || '-',
        phone.assigned_to || 'Sin asignar',
        phone.department || '-',
        phone.contract_plan || phone.plan || '-',
        getEsimText(phone.esim),
        phone.service_start_date || '-',
        phone.service_end_date || '-',
      ]);

      const stats = computePhoneStats(phones);
      const metaLines = [
        ['Gestión de Telefonía Treggo'],
        [`Generado: ${new Date().toLocaleString('es-MX')}`],
        [],
        ['Resumen del Inventario'],
        ['Total de dispositivos', stats.total],
        ['Asignados', stats.asignados],
        ['Sin asignar', stats.sinAsignar],
        ['eSIM', stats.esim],
        ['SIM física', stats.simFisica],
        ['Con datos completos', stats.datosCompletos],
        ['Con datos incompletos', stats.datosIncompletos],
        ['Sin datos clave', stats.datosSinInfo],
        [],
      ];

      const csvContent = [...metaLines, headers, ...rows]
        .map((row) => row.map(escapeCSV).join(','))
        .join('\r\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      downloadBlob(blob, `telefonia-${todayStr()}.csv`);
    } catch (err) {
      alert('Error al exportar CSV: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = () => {
    try {
      setExporting(true);
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      // Configuración de colores
      const navyColor = [15, 23, 42];     // #0f172a
      const blueAccent = [37, 99, 235];   // #2563eb
      const grayLight = [248, 250, 252];  // #f8fafc
      const textMuted = [100, 116, 139];  // #64748b

      // Métrica y Estadísticas Rápidas
      const stats = computePhoneStats(phones);
      const totalPhones = stats.total;

      // 1. BANNER DE ENCABEZADO
      doc.setFillColor(...navyColor);
      doc.rect(0, 0, 297, 24, 'F'); // Ancho A4 en mm = 297

      // Línea de acento inferior en el banner
      doc.setFillColor(...blueAccent);
      doc.rect(0, 24, 297, 1.5, 'F');

      // Título y Subtítulo
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text('GESTION DE EQUIPOS DE TELEFONIA', 14, 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(203, 213, 225);
      doc.text('Reporte General de Dispositivos, Numeros y Asignaciones', 14, 18);

      // Metadata (Derecha del Banner)
      const dateStr = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
      doc.setFontSize(8);
      doc.text(`Fecha: ${dateStr}`, 283, 12, { align: 'right' });
      doc.text(`Total Registros: ${totalPhones}`, 283, 18, { align: 'right' });

      // 2. TARJETAS DE RESUMEN DEL INVENTARIO
      const summaryCards = [
        { label: 'Total Equipos', value: stats.total, fill: [226, 232, 240] },
        { label: 'Asignados', value: stats.asignados, fill: [219, 234, 254] },
        { label: 'Sin Asignar', value: stats.sinAsignar, fill: [241, 245, 249] },
        { label: 'eSIM', value: stats.esim, fill: [237, 233, 254] },
        { label: 'SIM Física', value: stats.simFisica, fill: [224, 242, 254] },
        { label: 'Datos Completos', value: stats.datosCompletos, fill: [209, 250, 229] },
      ];
      const cardY = 29;
      const cardH = 14;
      const cardGap = 2;
      const cardW = (269 - cardGap * (summaryCards.length - 1)) / summaryCards.length;
      summaryCards.forEach((card, i) => {
        const x = 14 + i * (cardW + cardGap);
        doc.setFillColor(...card.fill);
        doc.roundedRect(x, cardY, cardW, cardH, 1.5, 1.5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(...navyColor);
        doc.text(String(card.value), x + cardW / 2, cardY + 7, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(71, 85, 105);
        doc.text(card.label, x + cardW / 2, cardY + 11.5, { align: 'center' });
      });

      // 3. TABLA CON AUTOTABLE
      const head = [['Dispositivo', 'Número / SIM', 'IMEI', 'Asignado a', 'Dpto.', 'Plan Contrato', 'Tipo SIM', 'Inicio Serv.', 'Fin Serv.', 'Datos']];

      const body = phones.map((phone) => [
        `${phone.brand || ''} ${phone.model || ''}`.trim() || 'Sin Especificar',
        phone.phone_number || 'Sin Línea',
        phone.imei || phone.imei1 || '-',
        phone.assigned_to || 'Sin asignar',
        phone.department || '-',
        phone.contract_plan || phone.plan || '-',
        getEsimText(phone.esim),
        phone.service_start_date || '-',
        phone.service_end_date || '-',
        COMPLETENESS_META[getPhoneCompleteness(phone)].label,
      ]);

      const tableStartY = cardY + cardH + 4;
      autoTable(doc, {
        startY: tableStartY,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: {
          fillColor: navyColor,
          textColor: [255, 255, 255],
          fontSize: 7.5,
          fontStyle: 'bold',
          halign: 'left',
          cellPadding: 2.5,
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [30, 41, 59],
          cellPadding: 2,
          overflow: 'linebreak',
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: { cellWidth: 36, fontStyle: 'bold' }, // Dispositivo
          1: { cellWidth: 25, font: 'courier', fontSize: 7 },   // Número
          2: { cellWidth: 28, font: 'courier', fontSize: 7 },   // IMEI
          3: { cellWidth: 32 },                   // Asignado
          4: { cellWidth: 22 },                   // Dpto.
          5: { cellWidth: 32 },                   // Plan
          6: { cellWidth: 16, halign: 'center' },  // Tipo SIM
          7: { cellWidth: 19, halign: 'center', fontSize: 7 },  // Inicio
          8: { cellWidth: 19, halign: 'center', fontSize: 7 },  // Fin
          9: { cellWidth: 18, halign: 'center', fontStyle: 'bold', fontSize: 7 }, // Datos
        },
        didParseCell: (data) => {
          if (data.section === 'body') {
            const fill = COMPLETENESS_PDF_FILL[getPhoneCompleteness(phones[data.row.index])];
            if (fill) data.cell.styles.fillColor = fill;
          }
          // Destacar eSIM vs SIM Física
          if (data.section === 'body' && data.column.index === 6) {
            if (data.cell.raw === 'eSIM') {
              data.cell.styles.textColor = [107, 33, 168]; // Púrpura
              data.cell.styles.fontStyle = 'bold';
            } else if (data.cell.raw === 'Física') {
              data.cell.styles.textColor = [3, 105, 161];  // Azul marino
            }
          }
          // Destacar sin asignar / sin línea
          if (data.section === 'body' && (data.cell.raw === 'Sin asignar' || data.cell.raw === 'Sin Línea')) {
            data.cell.styles.textColor = textMuted;
            data.cell.styles.fontStyle = 'italic';
          }
        },
        margin: { top: 20, left: 14, right: 14, bottom: 15 },
        didDrawPage: (data) => {
          // Pie de Página
          const totalPages = doc.internal.getNumberOfPages();
          const pageCurrent = data.pageNumber;

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(...textMuted);

          // Texto a la izquierda
          doc.text('Sistemas & TI — Reporte de Telefonía Corporativa', 14, 202);

          // Paginación a la derecha
          doc.text(`Página ${pageCurrent} de ${totalPages}`, 283, 202, { align: 'right' });
        },
      });

      doc.save(`telefonia-${todayStr()}.pdf`);
    } catch (err) {
      alert('Error al exportar PDF: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Control de Telefonía</h1>
          <p className="text-sm text-gray-500">Gestión de dispositivos móviles, líneas corporativas y SIM cards.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExportCSV}
            disabled={exporting || loading || phones.length === 0}
            className="flex items-center gap-2 border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <FileSpreadsheet size={16} /> Exportar CSV
          </button>
          <button
            onClick={handleExportPDF}
            disabled={exporting || loading || phones.length === 0}
            className="flex items-center gap-2 border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <FileText size={16} /> Exportar PDF
          </button>
          {canManageTI && (
            <>
              <button
                onClick={handleDownloadTemplate}
                className="flex items-center gap-2 border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Download size={16} /> Plantilla
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="flex items-center gap-2 border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Upload size={16} /> {importing ? 'Importando...' : 'Importar CSV/XLSX'}
              </button>
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleImportFile} className="hidden" />
              {selected.size > 0 && (
                <button
                  onClick={handleDeleteSelected}
                  disabled={deleting}
                  className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <Trash2 size={16} /> {deleting ? 'Eliminando...' : `Eliminar (${selected.size})`}
                </button>
              )}
              <button
                onClick={() => navigate('/phones/new')}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus size={16} /> Nuevo Teléfono
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Cargando inventario de teléfonos...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                  {canManageTI && (
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={phones.length > 0 && selected.size === phones.length}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300"
                      />
                    </th>
                  )}
                  <th className="py-3 px-4">
                    <span className="inline-flex items-center gap-1.5">
                      Dispositivo
                      <span className="hidden lg:inline-flex items-center gap-2 normal-case font-normal text-[10px] text-gray-400 ml-1">
                        <span className="inline-flex items-center gap-0.5"><CheckCircle2 size={11} className="text-emerald-500" /> Completo</span>
                        <span className="inline-flex items-center gap-0.5"><AlertTriangle size={11} className="text-amber-500" /> Incompleto</span>
                        <span className="inline-flex items-center gap-0.5"><XCircle size={11} className="text-red-500" /> Sin datos</span>
                      </span>
                    </span>
                  </th>
                  <th className="py-3 px-4">Número / SIM</th>
                  <th className="py-3 px-4">IMEI</th>
                  <th className="py-3 px-4">Asignado a</th>
                  <th className="py-3 px-4">Dpto.</th>
                  <th className="py-3 px-4">Plan Contrato</th>
                  <th className="py-3 px-4">eSIM</th>
                  <th className="py-3 px-4">Inicio Serv.</th>
                  <th className="py-3 px-4">Fin Serv.</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm whitespace-nowrap">
                {phones.length === 0 ? (
                  <tr>
                    <td colSpan={canManageTI ? 11 : 10} className="py-8 text-center text-gray-400">
                      No hay teléfonos registrados.
                    </td>
                  </tr>
                ) : (
                  phones.map((phone) => {
                    const deviceName = `${phone.brand || ''} ${phone.model || ''}`.trim();
                    const contractPlan = phone.contract_plan || phone.plan || null;
                    const imeiVal = phone.imei || phone.imei1 || null;
                    const completeness = getPhoneCompleteness(phone);
                    const { icon: CompletenessIcon, className: completenessClass, label: completenessLabel } = COMPLETENESS_META[completeness];

                    return (
                      <tr key={phone.id} className="hover:bg-gray-50">
                        {canManageTI && (
                          <td className="py-3 px-4">
                            <input
                              type="checkbox"
                              checked={selected.has(phone.id)}
                              onChange={() => toggleSelect(phone.id)}
                              className="rounded border-gray-300"
                            />
                          </td>
                        )}
                        <td className="py-3 px-4 font-semibold text-gray-800">
                          <span className="inline-flex items-center gap-1.5">
                            <CompletenessIcon size={15} className={`shrink-0 ${completenessClass}`} title={completenessLabel} />
                            {deviceName || <span className="text-gray-400 italic font-normal">Sin especificar</span>}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-blue-600">
                          {phone.phone_number || <span className="text-gray-400 font-sans">Sin Línea</span>}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-gray-600">
                          {imeiVal || <span className="text-gray-400 font-sans">-</span>}
                        </td>
                        <td className="py-3 px-4 text-gray-700">
                          {phone.assigned_to || <span className="text-gray-400 italic">Sin asignar</span>}
                        </td>
                        <td className="py-3 px-4 text-gray-700">
                          {phone.department || <span className="text-gray-400">-</span>}
                        </td>
                        <td className="py-3 px-4 text-gray-700">
                          {contractPlan || <span className="text-gray-400">-</span>}
                        </td>
                        <td className="py-3 px-4">
                          {(phone.esim === true || phone.esim === 'true') && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                              eSIM
                            </span>
                          )}
                          {(phone.esim === false || phone.esim === 'false') && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                              Física
                            </span>
                          )}
                          {(phone.esim === null || phone.esim === undefined || phone.esim === '') && (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-gray-600">
                          {phone.service_start_date || <span className="text-gray-400">-</span>}
                        </td>
                        <td className="py-3 px-4 text-xs text-gray-600">
                          {phone.service_end_date || <span className="text-gray-400">-</span>}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                          {canManageTI ? (
                            <>
                              <button
                                onClick={() => navigate(`/phones/${phone.id}/edit`)}
                                className="text-blue-600 hover:text-blue-800 text-xs font-semibold"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => handleDeleteOne(phone.id)}
                                className="text-red-600 hover:text-red-800 text-xs font-semibold"
                              >
                                Eliminar
                              </button>
                            </>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}