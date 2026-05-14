// src/pages/dashboard/PharmacistDashboard.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

const TABS = ["Pending", "Dispensed Today", "Low Stock"];

export default function PharmacistDashboard() {
  const { orgId, profile } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("Pending");
  const [pending, setPending] = useState([]);
  const [dispensedToday, setDispensedToday] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [stats, setStats] = useState({
    pendingCount: 0,
    dispensedTodayCount: 0,
    lowStockCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [dispensing, setDispensing] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!orgId) return;
    fetchAll();
  }, [orgId]);

  async function fetchAll() {
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];

      const [
        { data: pendingData },
        { data: dispensedData },
        { data: lowStockData },
      ] = await Promise.all([
        // Pending prescriptions
        supabase
          .from("prescriptions")
          .select(`
            id, dosage, frequency, duration_days, status, prescribed_at,
            drugs(id, name, unit, stock_qty),
            visits(
              patient_id,
              patients(first_name, last_name, mrn)
            )
          `)
          .eq("org_id", orgId)
          .eq("status", "pending")
          .order("prescribed_at", { ascending: true }),

        // Dispensed today
        supabase
          .from("prescriptions")
          .select(`
            id, dosage, frequency, duration_days, status, prescribed_at,
            drugs(name, unit),
            visits(
              patient_id,
              patients(first_name, last_name, mrn)
            )
          `)
          .eq("org_id", orgId)
          .eq("status", "dispensed")
          .gte("prescribed_at", `${today}T00:00:00`)
          .lte("prescribed_at", `${today}T23:59:59`)
          .order("prescribed_at", { ascending: false }),

        // Low stock drugs
        supabase
          .from("drugs")
          .select("id, name, generic_name, stock_qty, reorder_level, unit")
          .eq("org_id", orgId)
          .filter("stock_qty", "lte", "reorder_level")
          .order("stock_qty", { ascending: true }),
      ]);

      setPending(pendingData ?? []);
      setDispensedToday(dispensedData ?? []);
      setLowStock(lowStockData ?? []);
      setStats({
        pendingCount: pendingData?.length ?? 0,
        dispensedTodayCount: dispensedData?.length ?? 0,
        lowStockCount: lowStockData?.length ?? 0,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDispense(prescriptionId, drugId, drug) {
    if (!window.confirm(`Dispense ${drug.name}? This will reduce stock by 1 unit.`)) return;

    try {
      setDispensing(prescriptionId);

      // Update prescription status
      const { error: presError } = await supabase
        .from("prescriptions")
        .update({ status: "dispensed" })
        .eq("id", prescriptionId)
        .eq("org_id", orgId);

      if (presError) throw presError;

      // Reduce stock
      const { error: stockError } = await supabase
        .from("drugs")
        .update({ stock_qty: Math.max(0, (drug.stock_qty ?? 1) - 1) })
        .eq("id", drugId)
        .eq("org_id", orgId);

      if (stockError) throw stockError;

      await fetchAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setDispensing(null);
    }
  }

  const greeting = getGreeting();

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-header__title">
            {greeting}, {profile?.first_name} 💊
          </h1>
          <p className="page-header__subtitle">
            Pharmacy dashboard — manage prescriptions and stock
          </p>
        </div>
        <button
          className="btn btn--primary"
          onClick={() => navigate("/pharmacy")}
        >
          Drug Inventory →
        </button>
      </div>

      {/* Stats */}
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <StatCard
          icon="📋"
          iconBg="#fef9c3"
          iconColor="#a16207"
          label="Pending Prescriptions"
          value={loading ? "—" : stats.pendingCount}
          urgent={stats.pendingCount > 0}
        />
        <StatCard
          icon="✅"
          iconBg="#dcfce7"
          iconColor="#15803d"
          label="Dispensed Today"
          value={loading ? "—" : stats.dispensedTodayCount}
        />
        <StatCard
          icon="⚠️"
          iconBg="#fee2e2"
          iconColor="#b91c1c"
          label="Low Stock Alerts"
          value={loading ? "—" : stats.lowStockCount}
          urgent={stats.lowStockCount > 0}
        />
      </div>

      {error && <div className="form-error">{error}</div>}

      {/* Tabs */}
      <div className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? "tab--active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
            {tab === "Pending" && stats.pendingCount > 0 && (
              <span className="tab__badge">{stats.pendingCount}</span>
            )}
            {tab === "Low Stock" && stats.lowStockCount > 0 && (
              <span className="tab__badge tab__badge--red">
                {stats.lowStockCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="card" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: "none" }}>
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : (
          <>
            {/* Pending tab */}
            {activeTab === "Pending" && (
              <>
                {pending.length === 0 ? (
                  <div className="empty-state">No pending prescriptions. 🎉</div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Patient</th>
                        <th>Drug</th>
                        <th>Dosage</th>
                        <th>Frequency</th>
                        <th>Duration</th>
                        <th>Stock</th>
                        <th>Prescribed</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pending.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <strong>
                              {p.visits?.patients?.first_name}{" "}
                              {p.visits?.patients?.last_name}
                            </strong>
                            <div style={{ fontSize: 11, color: "#94a3b8" }}>
                              {p.visits?.patients?.mrn}
                            </div>
                          </td>
                          <td>
                            <strong>{p.drugs?.name ?? "—"}</strong>
                            <div style={{ fontSize: 11, color: "#94a3b8" }}>
                              {p.drugs?.unit}
                            </div>
                          </td>
                          <td>{p.dosage ?? "—"}</td>
                          <td>{p.frequency ?? "—"}</td>
                          <td>
                            {p.duration_days ? `${p.duration_days} days` : "—"}
                          </td>
                          <td>
                            <StockBadge
                              qty={p.drugs?.stock_qty}
                              reorder={p.drugs?.reorder_level}
                            />
                          </td>
                          <td>{formatDateTime(p.prescribed_at)}</td>
                          <td>
                            <button
                              className="btn btn--primary"
                              style={{ fontSize: 12, padding: "5px 12px" }}
                              disabled={
                                dispensing === p.id ||
                                (p.drugs?.stock_qty ?? 0) === 0
                              }
                              onClick={() =>
                                handleDispense(p.id, p.drugs?.id, p.drugs)
                              }
                            >
                              {dispensing === p.id ? "…" : "Dispense"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}

            {/* Dispensed today tab */}
            {activeTab === "Dispensed Today" && (
              <>
                {dispensedToday.length === 0 ? (
                  <div className="empty-state">Nothing dispensed today yet.</div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Patient</th>
                        <th>Drug</th>
                        <th>Dosage</th>
                        <th>Frequency</th>
                        <th>Duration</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dispensedToday.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <strong>
                              {p.visits?.patients?.first_name}{" "}
                              {p.visits?.patients?.last_name}
                            </strong>
                            <div style={{ fontSize: 11, color: "#94a3b8" }}>
                              {p.visits?.patients?.mrn}
                            </div>
                          </td>
                          <td>{p.drugs?.name ?? "—"}</td>
                          <td>{p.dosage ?? "—"}</td>
                          <td>{p.frequency ?? "—"}</td>
                          <td>
                            {p.duration_days ? `${p.duration_days} days` : "—"}
                          </td>
                          <td>{formatDateTime(p.prescribed_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}

            {/* Low stock tab */}
            {activeTab === "Low Stock" && (
              <>
                {lowStock.length === 0 ? (
                  <div className="empty-state">All drugs are well stocked. ✅</div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Drug</th>
                        <th>Generic Name</th>
                        <th>Unit</th>
                        <th>Stock</th>
                        <th>Reorder Level</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lowStock.map((d) => (
                        <tr key={d.id}>
                          <td><strong>{d.name}</strong></td>
                          <td>{d.generic_name ?? "—"}</td>
                          <td>{d.unit ?? "—"}</td>
                          <td>
                            <StockBadge qty={d.stock_qty} reorder={d.reorder_level} />
                          </td>
                          <td>{d.reorder_level ?? "—"}</td>
                          <td>
                            <button
                              className="btn btn--secondary"
                              style={{ fontSize: 12, padding: "5px 12px" }}
                              onClick={() => navigate(`/pharmacy`)}
                            >
                              Restock →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Helper components ── */

function StatCard({ icon, iconBg, iconColor, label, value, urgent }) {
  return (
    <div className="stat-card" style={urgent ? { borderColor: "#fca5a5" } : undefined}>
      <div className="stat-card__icon" style={{ background: iconBg, color: iconColor }}>
        {icon}
      </div>
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value">{value}</div>
    </div>
  );
}

function StockBadge({ qty, reorder }) {
  if (qty === null || qty === undefined) return <span className="badge badge--gray">—</span>;
  if (qty === 0) return <span className="badge badge--red">Out of stock</span>;
  if (qty <= reorder) return <span className="badge badge--yellow">{qty} left</span>;
  return <span className="badge badge--green">{qty} left</span>;
}

/* ── Helpers ── */

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-NG", {
    day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}