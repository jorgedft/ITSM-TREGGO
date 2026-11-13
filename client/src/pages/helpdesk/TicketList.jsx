import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { Plus, Ticket } from 'lucide-react';

export default function TicketList() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tickets')
        .select('*, profiles:user_id(full_name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (err) {
      console.error('Error al cargar tickets:', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Mesa de Ayuda / Tickets</h1>
          <p className="text-sm text-slate-400">Gestión de solicitudes de soporte técnico e incidencias.</p>
        </div>
        <button
          onClick={() => navigate('/tickets/new')}
          className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Crear Ticket
        </button>
      </div>

      <div className="glass-panel rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando tickets de soporte...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/20 border-b border-white/10 text-xs font-semibold text-slate-400 uppercase">
                  <th className="py-3 px-4">Folio / Asunto</th>
                  <th className="py-3 px-4">Solicitante</th>
                  <th className="py-3 px-4">Prioridad</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-100">
                      #{ticket.id.toString().slice(0, 8)} - {ticket.title}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {ticket.profiles?.full_name || 'Anónimo'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        ticket.priority === 'HIGH' ? 'bg-red-950 text-red-400' :
                        ticket.priority === 'MEDIUM' ? 'bg-amber-950 text-amber-400' : 'bg-slate-700 text-slate-300'
                      }`}>
                        {ticket.priority || 'NORMAL'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-1 bg-sky-950 text-sky-400 rounded-full text-xs font-semibold">
                        {ticket.status || 'OPEN'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => navigate(`/tickets/${ticket.id}`)}
                        className="text-sky-400 hover:text-sky-300 text-xs font-semibold"
                      >
                        Ver Detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}