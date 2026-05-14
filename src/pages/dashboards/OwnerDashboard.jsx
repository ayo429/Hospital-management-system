// src/pages/dashboards/OwnerDashboard.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

const EMPTY_STATS = {
  totalPatients: 0,
  todayAppointments: 0,
  revenueToday: 0,
  revenueMonth: 0,
  pendingHMO: 0,
  totalStaff: 0,
};

export default function OwnerDashboard() {
  const { orgId, profile } = useAuth();
  const [stats, setStats] = useState(EMPTY_STATS);
  const [appointments, setAppointments] = useState([]);
  const [recentPatients, setRecentPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split("T")[0];

      const [
        { count: totalPatients },
        { count: todayAppointments },
        { count: totalStaff },
        { count: pendingHMO },
        { data: appts },
        { data: patients },
      ] = await Promise.all([
        supabase
          .from("patients")
          .select("*", { count: "exact", head: true })
          .eq("org_id", orgId),
        supabase
          .from("appointments")
          .select("*", { count: "exact", head: true })
          .eq("org_id", orgId)
          .gte("appointment_date", `${today}T00:00:00`)
          .lte("appointment_date", `${today}T23:59:59`),
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("org_id", orgId)
          .neq("role", "owner"),
        supabase
          .from("hmo_claims")
          .select("*", { count: "exact", head: true })
          .eq("org_id", orgId)
          .eq("status", "pending"),
        supabase
          .from("appointments")
          .select(
            "id, appointment_date, status, patients(first_name, last_name), profiles(first_name, last_name)"
          )
          .eq("org_id", orgId)
          .gte("appointment_date", `${today}T00:00:00`)
          .lte("appointment_date", `${today}T23:59:59`)
          .order("appointment_date", { ascending: true })
          .limit(6),
        supabase
          .from("patients")
          .select("id, first_name, last_name, phone, created_at, hmo_plan_id")
          .eq("org_id", orgId)
          .order("created_at", { ascending: false })
          .limit(6),
      ]);

      setStats({
        totalPatients: totalPatients ?? 0,
        todayAppointments: todayAppointments ?? 0,
        totalStaff: totalStaff ?? 0,
        pendingHMO: pendingHMO ?? 0,
        revenueToday: 0,
        revenueMonth: 0,
      });
      setAppointments(appts ?? []);
      setRecentPatients(patients ?? []);
    } catch (err) {
      console.log("Error fetching dashboard data:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!orgId) return;
    fetchAll();
  }, [orgId]);

  const greeting = getGreeting();
  const firstName = profile?.first_name ?? "";

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <h1 className="page-header__title">
          {greeting}, {firstName} 👋
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

      {/* Stat cards */}
      <div className="stat-grid">
        <StatCard
          icon="👤"
          iconBg="#dbeafe"
          iconColor="#1d4ed8"
          label="Total Patients"
          value={loading ? "—" : stats.totalPatients.toLocaleString()}
          change="All time"
          changeType="neutral"
        />
        <StatCard
          icon="📅"
          iconBg="#dcfce7"
          iconColor="#15803d"
          label="Today's Appointments"
          value={loading ? "—" : stats.todayAppointments.toLocaleString()}
          change="Scheduled today"
          changeType="neutral"
        />
        <StatCard
          icon="₦"
          iconBg="#fef9c3"
          iconColor="#a16207"
          label="Revenue Today"
          value={loading ? "—" : `₦${stats.revenueToday.toLocaleString()}`}
          change="Billing coming soon"
          changeType="neutral"
        />
        <StatCard
          icon="🏛"
          iconBg="#fce7f3"
          iconColor="#9d174d"
          label="Pending HMO Claims"
          value={loading ? "—" : stats.pendingHMO.toLocaleString()}
          change="Awaiting approval"
          changeType={stats.pendingHMO > 0 ? "down" : "neutral"}
        />
        <StatCard
          icon="👥"
          iconBg="#ede9fe"
          iconColor="#6d28d9"
          label="Total Staff"
          value={loading ? "—" : stats.totalStaff.toLocaleString()}
          change="Active accounts"
          changeType="neutral"
        />
        <StatCard
          icon="📊"
          iconBg="#ccfbf1"
          iconColor="#0f766e"
          label="Revenue This Month"
          value={loading ? "—" : `₦${stats.revenueMonth.toLocaleString()}`}
          change="Billing coming soon"
          changeType="neutral"
        />
      </div>

      {/* Two-column content */}
      <div className="content-grid">
        {/* Today's appointments */}
        <div className="card">
          <div className="card__header">
            <span className="card__title">Today's Appointments</span>
            <Link to="/appointments" className="card__link">
              View all →
            </Link>
          </div>
          <div>
            {loading ? (
              <div className="empty-state">Loading…</div>
            ) : appointments.length === 0 ? (
              <div className="empty-state">
                No appointments scheduled today.
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Time</th>
                    <th>Doctor</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((a) => (
                    <tr key={a.id}>
                      <td>
                        {a.patients?.first_name} {a.patients?.last_name}
                      </td>
                      <td>{formatTime(a.appointment_date)}</td>
                      <td>
                        {a.profiles?.first_name} {a.profiles?.last_name}
                      </td>
                      <td>
                        <StatusBadge status={a.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Recent patients */}
        <div className="card">
          <div className="card__header">
            <span className="card__title">Recent Patients</span>
            <Link to="/patients" className="card__link">
              View all →
            </Link>
          </div>
          <div>
            {loading ? (
              <div className="empty-state">Loading…</div>
            ) : recentPatients.length === 0 ? (
              <div className="empty-state">No patients registered yet.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>HMO</th>
                    <th>Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPatients.map((p) => (
                    <tr key={p.id}>
                      <td>
                        {p.first_name} {p.last_name}
                      </td>
                      <td>{p.phone ?? "—"}</td>
                      <td>
                        {p.hmo_plan_id ? (
                          <span className="badge badge--blue">HMO</span>
                        ) : (
                          <span className="badge badge--gray">None</span>
                        )}
                      </td>
                      <td>{formatDate(p.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Helper components ── */

function StatCard({ icon, iconBg, iconColor, label, value, change, changeType }) {
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
      <div className={`stat-card__change stat-card__change--${changeType}`}>
        {changeType === "up" && "↑ "}
        {changeType === "down" && "↓ "}
        {change}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    scheduled: ["badge--blue", "Scheduled"],
    confirmed: ["badge--green", "Confirmed"],
    completed: ["badge--gray", "Completed"],
    cancelled: ["badge--red", "Cancelled"],
    waiting: ["badge--yellow", "Waiting"],
  };
  const [cls, label] = map[status] ?? ["badge--gray", status];
  return <span className={`badge ${cls}`}>{label}</span>;
}

/* ── Helpers ── */

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatTime(isoString) {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleTimeString("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
  });
}