import { FolderOpen } from 'lucide-react';

export function EmptyState({ 
  icon: Icon = FolderOpen, 
  title = "No se encontraron registros", 
  description = "No hay datos disponibles para mostrar en este momento.",
  action
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-900/40 rounded-xl border border-dashed border-slate-700 my-4">
      <div className="p-3 bg-slate-800 text-slate-400 rounded-full mb-3">
        <Icon size={32} />
      </div>
      <h3 className="text-base font-semibold text-slate-200 mb-1">{title}</h3>
      <p className="text-sm text-slate-400 max-w-sm mb-4">{description}</p>
      {action && (
        <div>
          {action}
        </div>
      )}
    </div>
  );
}

export default EmptyState;