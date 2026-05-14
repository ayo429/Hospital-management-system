import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import '../../styles/Auth.css'

function slugify(str) {
  return str.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export default function Signup() {
  const [step, setStep]       = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const [form, setForm] = useState({
    hospitalName : '',
    state        : '',
    phone        : '',
    firstName    : '',
    lastName     : '',
    email        : '',
    password     : '',
    confirmPass  : '',
  })

  function update(field) {
    return (e) => setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  function nextStep(e) {
    e.preventDefault()
    setError('')
    if (!form.hospitalName.trim()) return setError('Hospital name is required.')
    if (!form.state.trim())        return setError('State is required.')
    setStep(2)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.firstName.trim() || !form.lastName.trim())
      return setError('Full name is required.')
    if (form.password.length < 8)
      return setError('Password must be at least 8 characters.')
    if (form.password !== form.confirmPass)
      return setError('Passwords do not match.')

    setLoading(true)

    try {
      // Step 1: Create auth user first (no org_id yet)
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email    : form.email.trim(),
        password : form.password,
        options  : {
          data: {
            first_name : form.firstName.trim(),
            last_name  : form.lastName.trim(),
            role       : 'owner',
          }
        }
      })

      if (authErr) throw new Error(authErr.message)

      const userId = authData.user.id

      // Step 2: Call secure DB function to create org, branch and update profile
      const { error: orgErr } = await supabase.rpc('create_org_and_branch', {
        org_name  : form.hospitalName.trim(),
        org_slug  : slugify(form.hospitalName),
        org_phone : form.phone.trim(),
        org_state : form.state.trim(),
        user_id   : userId,
      })

      if (orgErr) throw new Error(orgErr.message)

    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">

        <div className="auth-logo">
          <span className="auth-logo-icon">🏥</span>
          <span className="auth-logo-text">MedCore</span>
        </div>

        <div className="auth-steps">
          <div className={`auth-step ${step >= 1 ? 'active' : ''}`}>
            <span>1</span> Hospital info
          </div>
          <div className="auth-step-line" />
          <div className={`auth-step ${step >= 2 ? 'active' : ''}`}>
            <span>2</span> Your account
          </div>
        </div>

        {error && <p className="auth-error">{error}</p>}

        {step === 1 && (
          <form onSubmit={nextStep} className="auth-form">
            <label>
              Hospital / clinic name
              <input
                type="text"
                placeholder="e.g. Sunshine Medical Centre"
                value={form.hospitalName}
                onChange={update('hospitalName')}
                required
              />
            </label>
            <label>
              State
              <select value={form.state} onChange={update('state')} required>
                <option value="">Select state</option>
                {NIGERIAN_STATES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Hospital phone <span className="optional">(optional)</span>
              <input
                type="tel"
                placeholder="e.g. 08012345678"
                value={form.phone}
                onChange={update('phone')}
              />
            </label>
            <button type="submit" className="auth-btn">
              Continue →
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-row">
              <label>
                First name
                <input
                  type="text"
                  placeholder="Emeka"
                  value={form.firstName}
                  onChange={update('firstName')}
                  required
                />
              </label>
              <label>
                Last name
                <input
                  type="text"
                  placeholder="Okonkwo"
                  value={form.lastName}
                  onChange={update('lastName')}
                  required
                />
              </label>
            </div>
            <label>
              Email address
              <input
                type="email"
                placeholder="you@hospital.com"
                value={form.email}
                onChange={update('email')}
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                placeholder="At least 8 characters"
                value={form.password}
                onChange={update('password')}
                required
              />
            </label>
            <label>
              Confirm password
              <input
                type="password"
                placeholder="Repeat password"
                value={form.confirmPass}
                onChange={update('confirmPass')}
                required
              />
            </label>
            <div className="auth-btn-row">
              <button
                type="button"
                className="auth-btn-ghost"
                onClick={() => setStep(1)}
              >
                ← Back
              </button>
              <button type="submit" className="auth-btn" disabled={loading}>
                {loading ? 'Creating account…' : 'Create account'}
              </button>
            </div>
          </form>
        )}

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>

      </div>
    </div>
  )
}

const NIGERIAN_STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo',
  'Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa',
  'Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba',
  'Yobe','Zamfara',
]