import { useRole } from '../hooks/useRole';
import Dashboard from './Dashboard';
import DashboardRH from './DashboardRH';

export default function DashboardRouter() {
    const { isRH } = useRole();
    return isRH ? <DashboardRH /> : <Dashboard />;
}
