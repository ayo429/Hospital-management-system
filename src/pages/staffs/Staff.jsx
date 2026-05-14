import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

const ROLES = ["doctor", "nurse", "pharmacist", "accountant", "admin"];

const ROLE_LABELS = {
  owner: "Owner",
  admin: "Admin",
  doctor: "Doctor",
  nurse: "Nurse",
  pharmacist: "Pharmacist",
  accountant: "Accountant",
};

const ROLE_BADGE_CLASS = {
  owner: "badge badge--blue",
  admin: "badge badge--blue",
  doctor: "badge badge--green",
  nurse: "badge badge--yellow",
  pharmacist: "badge badge--gray",
  accountant: "badge badge--gray",
};

function getInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join("");
}

// ── Invite Modal ──────────────────────────────────────────────────────────────
function InviteModal({ onClose, onInvited, orgId }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("doctor");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  async function handleInvite() {
    if (!email || !firstName || !lastName) {
      setError("All fields are required.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // Send invite via Supabase Auth Admin — inviteUserByEmail
      const { data, error: inviteError } =
        await supabase.auth.admin.inviteUserByEmail(email, {
          data: {
            first_name: firstName,
            last_name: lastName,
            role,
            org_id: orgId,
          },
        });

      if (inviteError) throw inviteError;

      setSuccess(true);
      onInvited?.();
      setTimeout(onClose, 2000);
    } catch (err) {
      // Supabase admin invite not available from client SDK in most setups —
      // fall back to creating a pending_invites record or show instruction.
      setError(
        err.message.includes("not allowed") || err.message.includes("admin")
          ? "Admin invite requires a server function. For now, create this user via the Supabase dashboard and assign org_id + role manually."
          : err.message
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="staff-modal-overlay" onClick={onClose}>
      <div
        className="staff-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="staff-modal__header">
          <h2 className="staff-modal__title">Invite staff member</h2>
          <button className="staff-modal__close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        {success ? (
          <div className="staff-modal__success">
            <span style={{ fontSize: 32 }}>✓</span>
            <p>Invitation sent to <strong>{email}</strong></p>
          </div>
        ) : (
          <div className="staff-modal__body">
            {error && (
              <div className="staff-modal__error">{error}</div>
            )}

            <div className="form-grid">
              <div className="form-field">
                <label className="form-label">First name</label>
                <input
                  className="input"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Adaeze"
                />
              </div>
              <div className="form-field">
                <label className="form-label">Last name</label>
                <input
                  className="input"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Okafor"
                />
              </div>
              <div className="form-field form-field--full">
                <label className="form-label">Email address</label>
                <input
                  className="input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="adaeze@hospital.ng"
                />
              </div>
              <div className="form-field form-field--full">
                <label className="form-label">Role</label>
                <select
                  className="input"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-actions" style={{ marginTop: "1.5rem" }}>
              <button className="btn btn--secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn btn--primary"
                onClick={handleInvite}
                disabled={loading}
              >
                {loading ? "Sending…" : "Send invitation"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Change Role Modal ─────────────────────────────────────────────────────────
function ChangeRoleModal({ member, onClose, onChanged }) {
  const [role, setRole] = useState(member.role);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSave() {
    setLoading(true);
    setError(null);
    const { error: err } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", member.id);

    if (err) {
      setError(err.message);
      setLoading(false);
    } else {
      onChanged?.();
      onClose();
    }
  }

  const fullName = `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim();

  return (
    <div className="staff-modal-overlay" onClick={onClose}>
      <div className="staff-modal staff-modal--sm" onClick={(e) => e.stopPropagation()}>
        <div className="staff-modal__header">
          <h2 className="staff-modal__title">Change role</h2>
          <button className="staff-modal__close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <div className="staff-modal__body">
          <p style={{ marginBottom: "1rem", color: "var(--text-secondary)" }}>
            Updating role for <strong>{fullName}</strong>
          </p>
          {error && <div className="staff-modal__error">{error}</div>}
          <div className="form-field">
            <label className="form-label">New role</label>
            <select
              className="input"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <div className="form-actions" style={{ marginTop: "1.5rem" }}>
            <button className="btn btn--secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn btn--primary"
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Deactivate Confirm ────────────────────────────────────────────────────────
function DeactivateModal({ member, onClose, onDone }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const isActive = member.is_active !== false;
  const fullName = `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim();

  async function handleToggle() {
    setLoading(true);
    const { error: err } = await supabase
      .from("profiles")
      .update({ is_active: !isActive })
      .eq("id", member.id);

    if (err) {
      setError(err.message);
      setLoading(false);
    } else {
      onDone?.();
      onClose();
    }
  }

  return (
    <div className="staff-modal-overlay" onClick={onClose}>
      <div className="staff-modal staff-modal--sm" onClick={(e) => e.stopPropagation()}>
        <div className="staff-modal__header">
          <h2 className="staff-modal__title">
            {isActive ? "Deactivate" : "Reactivate"} staff member
          </h2>
          <button className="staff-modal__close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <div className="staff-modal__body">
          {error && <div className="staff-modal__error">{error}</div>}
          <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
            {isActive
              ? `${fullName} will lose access to the system immediately. You can reactivate them at any time.`
              : `${fullName} will regain access to the system.`}
          </p>
          <div className="form-actions">
            <button className="btn btn--secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              className={`btn ${isActive ? "btn--danger" : "btn--primary"}`}
              onClick={handleToggle}
              disabled={loading}
            >
              {loading
                ? "Saving…"
                : isActive
                ? "Deactivate"
                : "Reactivate"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Staff() {
  const { orgId, profile, isOwner, isAdmin } = useAuth();
  const canManage = isOwner || isAdmin;

  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const [showInvite, setShowInvite] = useState(false);
  const [changeRoleMember, setChangeRoleMember] = useState(null);
  const [deactivateMember, setDeactivateMember] = useState(null);

  async function fetchStaff() {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email, role, is_active, created_at, avatar_url")
      .order("first_name", { ascending: true });

    if (!error) setStaff(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (orgId) fetchStaff();
  }, [orgId]);

  // ── Filtering ──
  const filtered = staff.filter((m) => {
    const name = `${m.first_name ?? ""} ${m.last_name ?? ""}`.toLowerCase();
    const email = (m.email ?? "").toLowerCase();
    const q = search.toLowerCase();

    const matchSearch = !q || name.includes(q) || email.includes(q);
    const matchRole = filterRole === "all" || m.role === filterRole;
    const matchStatus =
      filterStatus === "all"
        ? true
        : filterStatus === "active"
        ? m.is_active !== false
        : m.is_active === false;

    return matchSearch && matchRole && matchStatus;
  });

  // ── Stats ──
  const totalActive = staff.filter((m) => m.is_active !== false).length;
  const roleCounts = ROLES.reduce((acc, r) => {
    acc[r] = staff.filter((m) => m.role === r && m.is_active !== false).length;
    return acc;
  }, {});

  return (
    <>
      {/* ── Inline styles for modal (appended once) ── */}
      <style>{`
        .staff-modal-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.45);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }
        .staff-modal {
          background: var(--bg-card);
          border-radius: var(--radius);
          width: 100%; max-width: 520px;
          box-shadow: var(--shadow-card);
          max-height: 90vh; overflow-y: auto;
        }
        .staff-modal--sm { max-width: 420px; }
        .staff-modal__header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--border);
        }
        .staff-modal__title {
          font-family: var(--font-display);
          font-size: 1rem; font-weight: 600;
          color: var(--text-primary); margin: 0;
        }
        .staff-modal__close {
          background: none; border: none; cursor: pointer;
          font-size: 1.4rem; line-height: 1;
          color: var(--text-muted); padding: 0;
        }
        .staff-modal__close:hover { color: var(--text-primary); }
        .staff-modal__body { padding: 1.5rem; }
        .staff-modal__error {
          background: rgba(239,68,68,0.08);
          color: var(--danger);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 6px;
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          margin-bottom: 1rem;
        }
        .staff-modal__success {
          padding: 2.5rem 1.5rem;
          text-align: center;
          color: var(--success);
        }
        .staff-modal__success p { margin-top: 0.75rem; color: var(--text-primary); }

        .staff-avatar {
          width: 36px; height: 36px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-weight: 600; font-size: 0.75rem;
          flex-shrink: 0;
        }
        .staff-avatar--blue  { background: var(--blue-50); color: var(--blue-900); }
        .staff-avatar--green { background: rgba(16,185,129,0.12); color: #065f46; }
        .staff-avatar--amber { background: rgba(245,158,11,0.12); color: #92400e; }
        .staff-avatar--gray  { background: rgba(100,116,139,0.12); color: #334155; }

        .staff-name-cell {
          display: flex; align-items: center; gap: 10px;
        }
        .staff-name-cell__info { min-width: 0; }
        .staff-name-cell__name {
          font-weight: 500; font-size: 0.875rem;
          color: var(--text-primary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .staff-name-cell__email {
          font-size: 0.75rem; color: var(--text-muted);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        .staff-actions {
          display: flex; gap: 6px; align-items: center; justify-content: flex-end;
        }
        .staff-actions .btn { padding: 4px 10px; font-size: 0.75rem; }

        .badge--inactive {
          background: rgba(100,116,139,0.1);
          color: var(--text-muted);
          border: 1px solid rgba(100,116,139,0.2);
        }

        .staff-stat-strip {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
          gap: 12px;
          margin-bottom: 1.5rem;
        }
        .staff-stat {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 0.875rem 1rem;
        }
        .staff-stat__label {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          margin-bottom: 4px;
        }
        .staff-stat__value {
          font-size: 1.4rem;
          font-weight: 700;
          font-family: var(--font-display);
          color: var(--text-primary);
        }
      `}</style>

      <div style={{ padding: "1.5rem 2rem" }}>

        {/* ── Page header ── */}
        <div className="page-header" style={{ marginBottom: "1.5rem" }}>
          <div>
            <h1 className="page-header__title">Staff</h1>
            <p className="page-header__subtitle">
              Manage team members, roles, and access
            </p>
          </div>
          {canManage && (
            <button
              className="btn btn--primary"
              onClick={() => setShowInvite(true)}
            >
              + Invite staff
            </button>
          )}
        </div>

        {/* ── Stats strip ── */}
        <div className="staff-stat-strip">
          <div className="staff-stat">
            <div className="staff-stat__label">Total active</div>
            <div className="staff-stat__value">{totalActive}</div>
          </div>
          {ROLES.map((r) => (
            <div className="staff-stat" key={r}>
              <div className="staff-stat__label">{ROLE_LABELS[r]}s</div>
              <div className="staff-stat__value">{roleCounts[r] ?? 0}</div>
            </div>
          ))}
        </div>

        {/* ── Filter bar ── */}
        <div
          className="filter-bar"
          style={{ marginBottom: "1rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}
        >
          <input
            className="input"
            style={{ flex: "1 1 200px", maxWidth: 280 }}
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="input"
            style={{ width: "auto" }}
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
          >
            <option value="all">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
          <select
            className="input"
            style={{ width: "auto" }}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* ── Table ── */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
              Loading staff…
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <p>No staff members found.</p>
              {canManage && (
                <button
                  className="btn btn--primary"
                  style={{ marginTop: "0.75rem" }}
                  onClick={() => setShowInvite(true)}
                >
                  Invite your first staff member
                </button>
              )}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                  {canManage && <th style={{ textAlign: "right" }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((member) => {
                  const fullName = `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || "—";
                  const initials = getInitials(fullName);
                  const isActive = member.is_active !== false;
                  const isSelf = member.id === profile?.id;
                  const isOwnerRow = member.role === "owner";

                  const avatarColors = ["--blue", "--green", "--amber", "--gray"];
                  // deterministic color from id
                  const colorIdx =
                    member.id
                      ? member.id.charCodeAt(0) % 4
                      : 0;
                  const avatarClass = `staff-avatar staff-avatar${avatarColors[colorIdx]}`;

                  return (
                    <tr key={member.id} style={{ opacity: isActive ? 1 : 0.55 }}>
                      <td>
                        <div className="staff-name-cell">
                          <div className={avatarClass}>{initials}</div>
                          <div className="staff-name-cell__info">
                            <div className="staff-name-cell__name">
                              {fullName}
                              {isSelf && (
                                <span
                                  style={{
                                    marginLeft: 6,
                                    fontSize: "0.7rem",
                                    color: "var(--text-muted)",
                                    fontWeight: 400,
                                  }}
                                >
                                  (you)
                                </span>
                              )}
                            </div>
                            <div className="staff-name-cell__email">{member.email ?? "—"}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={ROLE_BADGE_CLASS[member.role] ?? "badge badge--gray"}>
                          {ROLE_LABELS[member.role] ?? member.role}
                        </span>
                      </td>
                      <td>
                        <span className={isActive ? "badge badge--green" : "badge badge--inactive"}>
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                        {member.created_at
                          ? new Date(member.created_at).toLocaleDateString("en-NG", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      {canManage && (
                        <td>
                          {!isSelf && !isOwnerRow && (
                            <div className="staff-actions">
                              <button
                                className="btn btn--secondary"
                                onClick={() => setChangeRoleMember(member)}
                              >
                                Change role
                              </button>
                              <button
                                className={`btn ${isActive ? "btn--danger" : "btn--secondary"}`}
                                onClick={() => setDeactivateMember(member)}
                              >
                                {isActive ? "Deactivate" : "Reactivate"}
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Result count ── */}
        {!loading && filtered.length > 0 && (
          <div className="pagination" style={{ marginTop: "0.75rem" }}>
            <span className="pagination__info">
              Showing {filtered.length} of {staff.length} staff member
              {staff.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* ── Note about invite flow ── */}
        {canManage && (
          <div
            style={{
              marginTop: "1.5rem",
              padding: "0.875rem 1rem",
              background: "rgba(6,182,212,0.06)",
              border: "1px solid rgba(6,182,212,0.2)",
              borderRadius: "var(--radius)",
              fontSize: "0.8rem",
              color: "var(--text-secondary)",
            }}
          >
            <strong style={{ color: "var(--text-primary)" }}>Note:</strong> The invite
            flow requires a Supabase Edge Function or service-role key to call{" "}
            <code>auth.admin.inviteUserByEmail()</code>. Until that's set up, new staff
            can be created via the Supabase dashboard and their{" "}
            <code>org_id</code> + <code>role</code> set in the{" "}
            <code>profiles</code> table.
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showInvite && (
        <InviteModal
          orgId={orgId}
          onClose={() => setShowInvite(false)}
          onInvited={fetchStaff}
        />
      )}
      {changeRoleMember && (
        <ChangeRoleModal
          member={changeRoleMember}
          onClose={() => setChangeRoleMember(null)}
          onChanged={fetchStaff}
        />
      )}
      {deactivateMember && (
        <DeactivateModal
          member={deactivateMember}
          onClose={() => setDeactivateMember(null)}
          onDone={fetchStaff}
        />
      )}
    </>
  );
}