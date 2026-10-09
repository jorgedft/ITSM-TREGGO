import { Settings } from 'lucide-react';
import { ComingSoon } from '../../components/ui/ComingSoon';

export default function Administracion() {
    return (
        <ComingSoon
            icon={Settings}
            title="Administración"
            description="Configuración general del sistema. Funciones pendientes de definir."
        />
    );
}
