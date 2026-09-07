import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { Plus, FileSpreadsheet, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const navigate = useNavigate();
  const [phones, setPhones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchPhones();
  }, []);

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

      const csvContent = [headers, ...rows]
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
      const totalPhones = phones.length;
      const esimCount = phones.filter(p => p.esim === true || p.esim === 'true').length;
      const assignedCount = phones.filter(p => p.assigned_to && p.assigned_to.trim() !== '').length;

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
      doc.text('CONTROL DE TELEFONÍA CORPORATIVA', 14, 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(203, 213, 225);
      doc.text('Reporte General de Dispositivos, Líneas y Asignaciones', 14, 18);

      // Metadata (Derecha del Banner)
      const dateStr = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
      doc.setFontSize(8);
      doc.text(`Fecha: ${dateStr}`, 283, 12, { align: 'right' });
      doc.text(`Total Registros: ${totalPhones}`, 283, 18, { align: 'right' });

      // 2. BLOQUE DE MÉTRICAS / RESUMEN
      doc.setFillColor(...grayLight);
      doc.roundedRect(14, 29, 269, 14, 2, 2, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, 29, 269, 14, 2, 2, 'D');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...navyColor);
      
      // KPI 1: Dispositivos
      doc.text('TOTAL EQUIPOS:', 20, 37);
      doc.setFont('helvetica', 'normal');
      doc.text(`${totalPhones}`, 50, 37);

      // KPI 2: Asignados
      doc.setFont('helvetica', 'bold');
      doc.text('ASIGNADOS:', 90, 37);
      doc.setFont('helvetica', 'normal');
      doc.text(`${assignedCount} (${Math.round((assignedCount / (totalPhones || 1)) * 100)}%)`, 115, 37);

      // KPI 3: Tecnología SIM
      doc.setFont('helvetica', 'bold');
      doc.text('TECNOLOGÍA:', 170, 37);
      doc.setFont('helvetica', 'normal');
      doc.text(`${esimCount} eSIM / ${totalPhones - esimCount} SIM Física`, 198, 37);

      // 3. TABLA CON AUTOTABLE
      const head = [['Dispositivo', 'Número / SIM', 'IMEI', 'Asignado a', 'Dpto.', 'Plan Contrato', 'Tipo SIM', 'Inicio Serv.', 'Fin Serv.']];
      
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
      ]);

      autoTable(doc, {
        startY: 47,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: {
          fillColor: navyColor,
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold',
          halign: 'left',
          cellPadding: 3,
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [30, 41, 59],
          cellPadding: 2.5,
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: { cellWidth: 42, fontStyle: 'bold' }, // Dispositivo
          1: { cellWidth: 30, font: 'courier' },   // Número
          2: { cellWidth: 35, font: 'courier' },   // IMEI
          3: { cellWidth: 38 },                   // Asignado
          4: { cellWidth: 28 },                   // Dpto.
          5: { cellWidth: 38 },                   // Plan
          6: { cellWidth: 20, halign: 'center' },  // Tipo SIM
          7: { cellWidth: 23, halign: 'center' },  // Inicio
          8: { cellWidth: 23, halign: 'center' },  // Fin
        },
        didParseCell: (data) => {
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
        margin: { top: 47, left: 14, right: 14, bottom: 15 },
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
          <button
            onClick={() => navigate('/phones/new')}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} /> Nuevo Teléfono
          </button>
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
                  <th className="py-3 px-4">Dispositivo</th>
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
                    <td colSpan={10} className="py-8 text-center text-gray-400">
                      No hay teléfonos registrados.
                    </td>
                  </tr>
                ) : (
                  phones.map((phone) => {
                    const deviceName = `${phone.brand || ''} ${phone.model || ''}`.trim();
                    const contractPlan = phone.contract_plan || phone.plan || null;
                    const imeiVal = phone.imei || phone.imei1 || null;

                    return (
                      <tr key={phone.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4 font-semibold text-gray-800">
                          {deviceName || <span className="text-gray-400 italic font-normal">Sin especificar</span>}
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
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => navigate(`/phones/${phone.id}/edit`)}
                            className="text-blue-600 hover:text-blue-800 text-xs font-semibold"
                          >
                            Editar
                          </button>
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