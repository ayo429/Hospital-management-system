// src/pages/dashboard/Dashboard.jsx
import { useAuth } from '../../context/AuthContext'
import OwnerDashboard from './OwnerDashboard'
import DoctorDashboard from './DoctorDashboard'
import NurseDashboard from './NurseDashboard'
 import PharmacistDashboard   from './PharmacistDashboard'

// Future imports (uncomment as you build each one):
// import ReceptionistDashboard from './ReceptionistDashboard'
// import AccountantDashboard   from './AccountantDashboard'
// import LabDashboard          from './LabDashboard'

export default function Dashboard() {
  const { profile } = useAuth()

  switch (profile?.role) {
    case 'owner':
    case 'admin':
      return <OwnerDashboard />

    case 'doctor':
      return <DoctorDashboard />

      case 'nurse':
        return <NurseDashboard/>

    case 'pharmacist':
      return <PharmacistDashboard />

    default:
      return (
        <div style={{ padding: '40px', color: '#64748b', fontFamily: 'sans-serif' }}>
          <h2>Unknown role: <code>{profile?.role}</code></h2>
          <p>Contact your administrator.</p>
        </div>
      )
  }
}