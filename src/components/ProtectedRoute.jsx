import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Wrap any route that requires login.
// Optional: pass allowedRoles={['owner','admin']} to restrict by role.
export default function ProtectedRoute({ children, allowedRoles }) {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', fontFamily: 'sans-serif', color: '#888'
      }}>
        Loading…
      </div>
    )
  }

  // Not logged in → go to login
  if (!session) return <Navigate to="/login" replace />

  // Logged in but role not allowed → go to dashboard (not a hard error)
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
