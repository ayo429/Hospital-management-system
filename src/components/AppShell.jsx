// src/components/AppShell.jsx
import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './AppShell.css'

const NAV_ITEMS = [
  { to: '/dashboard',    icon: '⊞',  label: 'Dashboard'    },
  { to: '/patients',     icon: '👤',  label: 'Patients'     },
  { to: '/visits',       icon: '🩺',  label: 'Visits'       },
  { to: '/appointments', icon: '📅',  label: 'Appointments' },
  { to: '/wards',        icon: '🏥',  label: 'Wards'        },
  { to: '/staff',        icon: '👥',  label: 'Staff'        },
  { to: '/billing',      icon: '₦',   label: 'Billing'      },
  { to: '/hmo',          icon: '🏛',  label: 'HMO'          },
  { to: '/pharmacy',     icon: '💊',  label: 'Pharmacy'     },
  { to: '/laboratory',   icon: '🧪',  label: 'Laboratory'   },
  { to: '/reports',      icon: '📊',  label: 'Reports'      },
  { to: '/settings',     icon: '⚙',   label: 'Settings'     },
]

export default function AppShell({ children }) {
  const { profile, org, signOut } = useAuth()
  const navigate = useNavigate()
  const [collapsed,     setCollapsed]     = useState(false)
  const [mobileOpen,    setMobileOpen]    = useState(false)
  const [showUserMenu,  setShowUserMenu]  = useState(false)

  // Close sidebar when navigating on mobile
  function handleNavClick() {
    setMobileOpen(false)
    setShowUserMenu(false)
  }

  // Close sidebar on outside click (handled via overlay)
  // Close user menu when clicking elsewhere
  useEffect(() => {
    function handler(e) {
      if (showUserMenu && !e.target.closest('.sidebar__bottom')) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showUserMenu])

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const initials = [profile?.first_name?.[0], profile?.last_name?.[0]]
    .filter(Boolean).join('').toUpperCase() || '?'

  return (
    <div className={`shell ${collapsed ? 'shell--collapsed' : ''} ${mobileOpen ? 'shell--mobile-open' : ''}`}>

      {/* ── Mobile hamburger ── */}
      <button
        className="sidebar__hamburger"
        onClick={() => setMobileOpen(o => !o)}
        aria-label="Toggle menu"
      >
        <span className="sidebar__hamburger-icon">
          {mobileOpen ? '✕' : '☰'}
        </span>
      </button>

      {/* ── Mobile overlay ── */}
      {mobileOpen && (
        <div className="sidebar__overlay" onClick={() => setMobileOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar__top">
          <div className="sidebar__logo">
            <span className="sidebar__logo-icon">🏥</span>
            {!collapsed && (
              <span className="sidebar__logo-text">MedCore</span>
            )}
          </div>
          {/* Collapse button — desktop only */}
          <button
            className="sidebar__collapse-btn"
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? '›' : '‹'}
          </button>
        </div>

        {!collapsed && org && (
          <div className="sidebar__org">
            <span className="sidebar__org-name">{org.name}</span>
            <span className="sidebar__org-branch">Main Branch</span>
          </div>
        )}

        <nav className="sidebar__nav">
          {NAV_ITEMS.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={handleNavClick}
              className={({ isActive }) =>
                `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
              }
              title={collapsed ? label : undefined}
            >
              <span className="sidebar__link-icon">{icon}</span>
              {!collapsed && (
                <span className="sidebar__link-label">{label}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__bottom">
          <button
            className="sidebar__user"
            onClick={() => setShowUserMenu(m => !m)}
          >
            <div className="sidebar__avatar">{initials}</div>
            {!collapsed && (
              <div className="sidebar__user-info">
                <span className="sidebar__user-name">
                  {profile?.first_name} {profile?.last_name}
                </span>
                <span className="sidebar__user-role">{profile?.role}</span>
              </div>
            )}
          </button>
          {showUserMenu && (
            <div className="sidebar__user-menu">
              <button onClick={handleSignOut}>Sign out</button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="shell__main">
        {children}
      </main>
    </div>
  )
}