import { CalendarCheck } from 'lucide-react';
import { ComingSoon } from '../../components/ui/ComingSoon';

export default function Asistencia() {
    return (
        <ComingSoon
            icon={CalendarCheck}
            title="Incidencias y Asistencia"
            description="Control de asistencia e incidencias del personal. Próximamente."
        />
    );
}
