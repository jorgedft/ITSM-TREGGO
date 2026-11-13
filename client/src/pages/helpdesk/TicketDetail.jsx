import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { ArrowLeft, Ticket as TicketIcon } from 'lucide-react';

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTicket();
  }, [id]);

  const fetchTicket = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tickets')
        .select('*, profiles:user_id(full_name, email)')
        .eq('id', id)
        .single();

      if (error) throw error;
      setTicket(data);
    } catch (err) {
      console.error('Error al cargar ticket:', err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Cargando ticket...</div>;
  if (!ticket) return <div className="p-8 text-center text-red-500">Ticket no encontrado.</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <button
        onClick={() => navigate('/tickets')}
        className="flex items-center gap-2 text-slate-400 hover:text-slate-100"
      >
        <ArrowLeft size={18} /> Volver a Tickets
      </button>

      <div className="glass-panel rounded-xl p-6 space-y-6">
        <div className="flex items-start justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-sky-950 text-sky-400 rounded-lg">
              <TicketIcon size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">{ticket.title}</h1>
              <p className="text-sm text-slate-400">Solicitado por: {ticket.profiles?.full_name || 'Desconocido'}</p>
            </div>
          </div>
          <span className="px-3 py-1 bg-sky-950 text-sky-400 border border-sky-800 rounded-full text-xs font-semibold">
            {ticket.status || 'OPEN'}
          </span>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-400 uppercase">Detalles del Requerimiento</h3>
          <p className="text-slate-300 bg-slate-900 p-4 rounded-lg border border-slate-700 text-sm whitespace-pre-wrap">
            {ticket.description}
          </p>
        </div>
      </div>
    </div>
  );
}