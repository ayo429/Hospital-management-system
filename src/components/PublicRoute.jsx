import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Redirects logged-in users away from /login and /signup
export default function PublicRoute({ children }) {
  const { session, loading } = useAuth()

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

  if (session) return <Navigate to="/dashboard" replace />

  return children
}