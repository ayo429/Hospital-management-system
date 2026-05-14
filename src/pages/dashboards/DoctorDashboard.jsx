// src/pages/dashboard/DoctorDashboard.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

const TABS = ["My Queue", "Unassigned"];

export default function DoctorDashboard() {
  const { orgId, profile } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("My Queue");
  const [myQueue, setMyQueue] = useState([]);
  const [unassigned, setUnassigned] = useState([]);
  const [stats, setStats] = useState({
    seenToday: 0,
    pendingConsultations: 0,
    completedPrescriptions: 0,
  });
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(null);

  useEffect(() => {
    if (!orgId || !profile?.id) return;
    fetchAll();
  }, [orgId, profile?.id]);

  async function fetchAll() {
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];

      const [
        { data: myVisits },
        { data: unassignedVisits },
        { count: seenToday },
        { count: pendingConsultations },
        { data: labAlerts },
      ] = await Promise.all([
        // My assigned active visits
        supabase
          .from("visits")
          .select(
            `
            id, type, status, chief_complaint, admitted_at,
            patients(id, first_name, last_name, mrn, dob, gender)
          `,
          )
          .eq("org_id", orgId)
          .eq("attending_doctor_id", profile.id)
          .eq("status", "active")
          .order("admitted_at", { ascending: true }),

        // Unassigned active visits
        supabase
          .from("visits")
          .select(
            `
            id, type, status, chief_complaint, admitted_at,
            patients(id, first_name, last_name, mrn, dob, gender)
          `,
          )
          .eq("org_id", orgId)
          .is("attending_doctor_id", null)
          .eq("status", "active")
          .order("admitted_at", { ascending: true }),

        // Patients seen today (discharged by this doctor today)
        supabase
          .from("visits")
          .select("*", { count: "exact", head: true })
          .eq("org_id", orgId)
          .eq("attending_doctor_id", profile.id)
          .eq("status", "discharged")
          .gte("discharged_at", `${today}T00:00:00`)
          .lte("discharged_at", `${today}T23:59:59`),

        // Pending consultations (active visits assigned to me)
        supabase
          .from("visits")
          .select("*", { count: "exact", head: true })
          .eq("org_id", orgId)
          .eq("attending_doctor_id", profile.id)
          .eq("status", "active"),

        // Lab result alerts (completed lab orders for my patients)
        supabase
          .from("lab_orders")
          .select(
            "id, test_name, status, visits(patient_id, patients(first_name, last_name))",
          )
          .eq("status", "completed")
          .limit(5),
      ]);

      setMyQueue(myVisits ?? []);
      setUnassigned(unassignedVisits ?? []);
      setStats({
        seenToday: seenToday ?? 0,
        pendingConsultations: pendingConsultations ?? 0,
        completedPrescriptions: 0,
      });

      // Build alerts from lab results
      const labAlertItems = (labAlerts ?? []).map((l) => ({
        id: l.id,
        type: "lab",
        message: `Lab result ready: ${l.test_name} — ${l.visits?.patients?.first_name} ${l.visits?.patients?.last_name}`,
        icon: "🔬",
        color: "#3b82f6",
      }));
      setAlerts(labAlertItems);
    } catch (err) {
      console.error("DoctorDashboard error:", err.message);
    } finally {
      setLoading(false);
    }
  }

  async function acceptCase(visitId) {
    setAccepting(visitId);
    try {
      const { error } = await supabase
        .from("visits")
        .update({ attending_doctor_id: profile.id })
        .eq("id", visitId)
        .eq("org_id", orgId);

      if (error) throw error;
      await fetchAll(); // refresh queues
    } catch (err) {
      console.error("Accept case error:", err.message);
    } finally {
      setAccepting(null);
    }
  }

  const greeting = getGreeting();
  const queue = activeTab === "My Queue" ? myQueue : unassigned;

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-header__title">
            {greeting}, Dr. {profile?.first_name} 👨‍⚕️
          </h1>
          <p className="page-header__subtitle">
            {new Date().toLocaleDateString("en-NG", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <StatCard
          icon="👥"
          iconBg="#dcfce7"
          iconColor="#15803d"
          label="Patients Seen Today"
          value={loading ? "—" : stats.seenToday}
        />
        <StatCard
          icon="⏳"
          iconBg="#fef9c3"
          iconColor="#a16207"
          label="Pending Consultations"
          value={loading ? "—" : stats.pendingConsultations}
        />
        <StatCard
          icon="📋"
          iconBg="#ede9fe"
          iconColor="#6d28d9"
          label="Unassigned Cases"
          value={loading ? "—" : unassigned.length}
        />
        <StatCard
          icon="🔬"
          iconBg="#dbeafe"
          iconColor="#1d4ed8"
          label="Lab Results Ready"
          value={loading ? "—" : alerts.length}
        />
      </div>

      <div className="detail-grid">
        {/* Left — patient queue */}
        <div style={{ gridColumn: "1 / -1" }}>
          {/* Tabs */}
          <div className="tabs">
            {TABS.map((tab) => (
              <button
                key={tab}
                className={`tab ${activeTab === tab ? "tab--active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
                {tab === "My Queue" && myQueue.length > 0 && (
                  <span className="tab__badge">{myQueue.length}</span>
                )}
                {tab === "Unassigned" && unassigned.length > 0 && (
                  <span className="tab__badge tab__badge--red">
                    {unassigned.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Queue table */}
          <div
            className="card"
            style={{
              borderTopLeftRadius: 0,
              borderTopRightRadius: 0,
              borderTop: "none",
            }}
          >
            {loading ? (
              <div className="empty-state">Loading queue…</div>
            ) : queue.length === 0 ? (
              <div className="empty-state">
                {activeTab === "My Queue"
                  ? "No active patients assigned to you."
                  : "No unassigned cases waiting."}
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Age / Gender</th>
                    <th>Visit Type</th>
                    <th>Chief Complaint</th>
                    <th>Waiting Since</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <strong>
                          {v.patients?.first_name} {v.patients?.last_name}
                        </strong>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>
                          {v.patients?.mrn}
                        </div>
                      </td>
                      <td>
                        {v.patients?.dob ? calculateAge(v.patients.dob) : "—"}
                        {v.patients?.gender && (
                          <span
                            style={{
                              marginLeft: 4,
                              textTransform: "capitalize",
                              color: "#64748b",
                            }}
                          >
                            / {v.patients.gender}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="badge badge--blue">
                          {v.type ?? "—"}
                        </span>
                      </td>
                      <td>{v.chief_complaint ?? "—"}</td>
                      <td>{timeAgo(v.admitted_at)}</td>
                      <td>
                        <VisitStatusBadge status={v.status} />
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 8 }}>
                          {activeTab === "Unassigned" ? (
                            <button
                              className="btn btn--primary"
                              style={{ fontSize: 12, padding: "5px 12px" }}
                              disabled={accepting === v.id}
                              onClick={() => acceptCase(v.id)}
                            >
                              {accepting === v.id ? "…" : "Accept"}
                            </button>
                          ) : (
                            <button
                              className="btn btn--primary"
                              style={{ fontSize: 12, padding: "5px 12px" }}
                              onClick={() => navigate(`/visits/${v.id}`)}
                            >
                              Consult →
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="form-card" style={{ marginTop: 20 }}>
          <div className="form-card__title">🔔 Alerts</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {alerts.map((a) => (
              <div key={a.id} className="alert-item">
                <span style={{ fontSize: 18 }}>{a.icon}</span>
                <span style={{ fontSize: 13.5, color: "var(--text-primary)" }}>
                  {a.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="form-card" style={{ marginTop: 20 }}>
        <div className="form-card__title">⚡ Quick Actions</div>
        <div className="quick-actions">
          <QuickAction
            icon="💊"
            label="New Prescription"
            onClick={() => navigate("/pharmacy/prescriptions/new")}
          />
          <QuickAction
            icon="🔬"
            label="Request Lab"
            onClick={() => navigate("/laboratory/orders/new")}
          />
          <QuickAction
            icon="🏥"
            label="Admit Patient"
            onClick={() => navigate("/visits/new")}
          />
          <QuickAction
            icon="👤"
            label="Find Patient"
            onClick={() => navigate("/patients")}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Helper components ── */

function StatCard({ icon, iconBg, iconColor, label, value }) {
  return (
    <div className="stat-card">
      <div
        className="stat-card__icon"
        style={{ background: iconBg, color: iconColor }}
      >
        {icon}
      </div>
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value">{value}</div>
    </div>
  );
}

function VisitStatusBadge({ status }) {
  const map = {
    active: { bg: "#dcfce7", color: "#15803d", label: "Active" },
    discharged: { bg: "#fee2e2", color: "#b91c1c", label: "Discharged" },
    pending: { bg: "#fef9c3", color: "#a16207", label: "Pending" },
  };
  const s = map[status] ?? {
    bg: "#f1f5f9",
    color: "#475569",
    label: status ?? "—",
  };
  return (
    <span className="badge" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function QuickAction({ icon, label, onClick }) {
  return (
    <button className="quick-action" onClick={onClick}>
      <span className="quick-action__icon">{icon}</span>
      <span className="quick-action__label">{label}</span>
    </button>
  );
}

/* ── Helpers ── */

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function calculateAge(dob) {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function timeAgo(iso) {
  if (!iso) return "—";
  const diff = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (diff < 1) return "Just now";
  if (diff < 60) return `${diff}m ago`;
  const hrs = Math.floor(diff / 60);
  return `${hrs}h ${diff % 60}m ago`;
}
