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
    // ... Tu JSX permanece igual
    <div className="p-6 space-y-6">
      {/* Tu componente actual */}
    </div>
  );
}