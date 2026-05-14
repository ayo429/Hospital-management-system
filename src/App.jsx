import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import PublicRoute from './components/PublicRoute'
import ProtectedRoute from './components/ProtectedRoute'
import AppShell from './components/AppShell'
import Login from './pages/auth/Login'
import Signup from './pages/auth/Signup'
import Dashboard from './pages/dashboards/Dashboard'
import Patients from './pages/patients/Patients'
import NewPatient from './pages/patients/NewPatient'
import PatientDetail from './pages/patients/PatientDetail'
import Visits from './pages/visits/Visits'
import NewVisit from './pages/visits/NewVisit'
import VisitDetail from './pages/visits/VisitDetail'
import Staff from './pages/staffs/Staff'

function ComingSoon({ name }) {
  return (
    <div style={{ padding: '40px' }}>
      <h2 style={{ fontFamily: 'sans-serif', color: '#0f172a' }}>{name}</h2>
      <p style={{ color: '#64748b', marginTop: 8 }}>This module is coming soon.</p>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login"  element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />

          {/* Protected */}
          <Route path="/dashboard"    element={<ProtectedRoute><AppShell><Dashboard /></AppShell></ProtectedRoute>} />
          <Route path="/patients"     element={<ProtectedRoute><AppShell><Patients /></AppShell></ProtectedRoute>} />
          <Route path="/patients/new" element={<ProtectedRoute><AppShell><NewPatient /></AppShell></ProtectedRoute>} />
          <Route path="/patients/:id" element={<ProtectedRoute><AppShell><PatientDetail /></AppShell></ProtectedRoute>} />
          <Route path="/appointments" element={<ProtectedRoute><AppShell><ComingSoon name="Appointments" /></AppShell></ProtectedRoute>} />
          <Route path="/staff"        element={<ProtectedRoute><AppShell><Staff /></AppShell></ProtectedRoute>} />
          <Route path="/billing"      element={<ProtectedRoute><AppShell><ComingSoon name="Billing" /></AppShell></ProtectedRoute>} />
          <Route path="/hmo"          element={<ProtectedRoute><AppShell><ComingSoon name="HMO" /></AppShell></ProtectedRoute>} />
          <Route path="/pharmacy"     element={<ProtectedRoute><AppShell><ComingSoon name="Pharmacy" /></AppShell></ProtectedRoute>} />
          <Route path="/laboratory"   element={<ProtectedRoute><AppShell><ComingSoon name="Laboratory" /></AppShell></ProtectedRoute>} />
          <Route path="/reports"      element={<ProtectedRoute><AppShell><ComingSoon name="Reports" /></AppShell></ProtectedRoute>} />
          <Route path="/settings"     element={<ProtectedRoute><AppShell><ComingSoon name="Settings" /></AppShell></ProtectedRoute>} />
          <Route path="/visits"        element={<ProtectedRoute><AppShell><Visits /></AppShell></ProtectedRoute>} />
          <Route path="/visits/new" element={<ProtectedRoute><AppShell><NewVisit /></AppShell></ProtectedRoute>} />
          <Route path="/visits/:id" element={<ProtectedRoute><AppShell><VisitDetail /></AppShell></ProtectedRoute>} />
          <Route path="/patients/:id/edit" element={<ProtectedRoute><AppShell><ComingSoon name="Edit Patient" /></AppShell></ProtectedRoute>} />
          {/* Default */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}