import { useEffect, useMemo } from 'react';
import { X, FileDown, Printer, FileSpreadsheet } from 'lucide-react';
import { printPdf } from './pdfTemplates';

// Vista previa del formato tal como saldrá impreso. `buildDoc` devuelve un
// jsPDF nuevo cada vez (imprimir y descargar mutan el documento).
export default function PdfPreviewModal({ title, filename, buildDoc, onExportExcel, onClose }) {
  const previewUrl = useMemo(() => {
    const blob = buildDoc().output('blob');
    return URL.createObjectURL(blob);
  }, [buildDoc]);

  useEffect(() => () => URL.revokeObjectURL(previewUrl), [previewUrl]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6" onClick={onClose}>
      <div
        className="glass-modal rounded-xl w-full max-w-4xl h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-700">
          <h3 className="font-bold text-slate-100 text-sm">Vista previa — {title}</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => buildDoc().save(`${filename}.pdf`)} className="btn-secondary text-xs flex items-center gap-1.5 py-1.5">
              <FileDown size={14} /> PDF
            </button>
            {onExportExcel && (
              <button onClick={onExportExcel} className="btn-secondary text-xs flex items-center gap-1.5 py-1.5">
                <FileSpreadsheet size={14} /> Excel
              </button>
            )}
            <button onClick={() => printPdf(buildDoc())} className="btn-primary text-xs flex items-center gap-1.5 py-1.5">
              <Printer size={14} /> Imprimir
            </button>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300 ml-1" aria-label="Cerrar vista previa">
              <X size={20} />
            </button>
          </div>
        </div>
        <iframe title={`Vista previa ${title}`} src={`${previewUrl}#toolbar=0&navpanes=0`} className="flex-1 w-full bg-slate-900" />
      </div>
    </div>
  );
}
