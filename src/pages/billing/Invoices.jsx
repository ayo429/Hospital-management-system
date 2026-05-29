// src/pages/billing/Invoices.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

const STATUS_META = {
  unpaid:    { label: "Unpaid",    bg: "#fffbeb", border: "#fde68a", text: "#b45309", dot: "#f59e0b"  },
  paid:      { label: "Paid",      bg: "#ecfdf5", border: "#a7f3d0", text: "#065f46", dot: "#10b981"  },
  draft:     { label: "Draft",     bg: "#f8fafc", border: "#e2e8f0", text: "#64748b", dot: "#94a3b8"  },
  cancelled: { label: "Cancelled", bg: "#fef2f2", border: "#fecaca", text: "#991b1b", dot: "#ef4444"  },
  partial:   { label: "Partial",   bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8", dot: "#3b82f6"  },
};

const PAYMENT_ICONS = { cash: "💵", hmo: "🏛", card: "💳", transfer: "🏦" };

function formatNaira(amount) {
  return `₦${Number(amount ?? 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
}

function StatusBadge({ status }) {
  const m = STATUS_META[status] ?? STATUS_META.unpaid;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "3px 10px", borderRadius: 99,
      fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap",
      background: m.bg, color: m.text, border: `1px solid ${m.border}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.dot, flexShrink: 0 }} />
      {m.label}
    </span>
  );
}

const FILTER_STATUSES = ["all", "unpaid", "paid", "partial", "draft", "cancelled"];

export default function Invoices() {
  const { orgId } = useAuth();
  const navigate  = useNavigate();

  const [invoices,     setInvoices]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  async function fetchInvoices() {
    setLoading(true);
    const { data } = await supabase
      .from("invoices")
      .select(`
        id, invoice_number, status, payment_method,
        total_amount, amount_paid, hmo_amount, issued_at, paid_at,
        patient:patients(id, first_name, last_name, mrn),
        visit:visits(id, type)
      `)
      .eq("org_id", orgId)
      .order("issued_at", { ascending: false });
    setInvoices(data ?? []);
    setLoading(false);
  }

  useEffect(() => { if (orgId) fetchInvoices(); }, [orgId]);

  const filtered = invoices.filter(inv => {
    const matchStatus = statusFilter === "all" || inv.status === statusFilter;
    const name = `${inv.patient?.first_name ?? ""} ${inv.patient?.last_name ?? ""}`.toLowerCase();
    const num  = (inv.invoice_number ?? "").toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase()) || num.includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const totalRevenue = invoices.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.total_amount), 0);
  const totalUnpaid  = invoices.filter(i => i.status === "unpaid").reduce((s, i) => s + Number(i.total_amount), 0);
  const paidCount    = invoices.filter(i => i.status === "paid").length;

  return (
    <>
      <style>{`
        .inv-btn-primary {
          display:inline-flex;align-items:center;gap:6px;
          padding:9px 18px;border-radius:8px;font-size:13.5px;font-weight:600;
          cursor:pointer;border:none;background:var(--blue-600);color:#fff;
          transition:background .15s;white-space:nowrap;
        }
        .inv-btn-primary:hover { background:var(--blue-500); }

        .inv-stat-card {
          background:#fff;
          border-radius:10px;
          border:1px solid #e2e8f0;
          box-shadow:0 1px 3px rgba(0,0,0,.06),0 4px 12px rgba(0,0,0,.04);
          padding:20px;
          display:flex;flex-direction:column;gap:6px;
          transition:transform .15s,box-shadow .15s;
        }
        .inv-stat-card:hover {
          transform:translateY(-1px);
          box-shadow:0 4px 16px rgba(0,0,0,.08);
        }

        .inv-filter-btn {
          padding:8px 16px;
          border-radius:8px;
          border:1px solid #e2e8f0;
          background:#fff;
          font-size:13px;
          font-weight:600;
          cursor:pointer;
          transition:background .15s,border-color .15s,color .15s;
          white-space:nowrap;
          color:#64748b;
        }
        .inv-filter-btn:hover { background:#f8fafc; }
        .inv-filter-btn.active {
          background:#0f172a;
          border-color:#0f172a;
          color:#fff;
        }

        .inv-table { width:100%;border-collapse:collapse;font-size:13.5px; }
        .inv-table th {
          text-align:left;padding:10px 16px;
          font-size:11px;font-weight:600;color:#94a3b8;
          text-transform:uppercase;letter-spacing:.5px;
          background:#f8fafc;border-bottom:1px solid #e2e8f0;
          white-space:nowrap;
        }
        .inv-table th.right { text-align:right; }
        .inv-table td {
          padding:13px 16px;
          border-bottom:1px solid #f1f5f9;
          color:#0f172a;
          white-space:nowrap;
        }
        .inv-table tr:last-child td { border-bottom:none; }
        .inv-table tr:hover td { background:#f8fafc; }
        .inv-table tr { cursor:pointer; }
      `}</style>

      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Billing</h1>
          <p className="page-header__subtitle">Manage invoices and track payments</p>
        </div>
        <button className="inv-btn-primary" onClick={() => navigate("/billing/new")}>
          + New Invoice
        </button>
      </div>

      {/* ── Stat cards ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 16,
        marginBottom: 32,
      }}>
        {[
          { label: "Total Invoices", value: invoices.length,           icon: "🧾", sub: null },
          { label: "Paid",           value: paidCount,                 icon: "✅", sub: null },
          { label: "Total Revenue",  value: formatNaira(totalRevenue), icon: "💰", sub: "from paid invoices" },
          { label: "Outstanding",    value: formatNaira(totalUnpaid),  icon: "⏳", sub: "awaiting payment"   },
        ].map(s => (
          <div key={s.label} className="inv-stat-card">
            <div style={{
              width: 40, height: 40, borderRadius: 9,
              background: "var(--blue-50)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, marginBottom: 4,
            }}>
              {s.icon}
            </div>
            <p style={{ fontSize: 12.5, fontWeight: 500, color: "#64748b" }}>{s.label}</p>
            <p style={{
              fontFamily: "var(--font-display)",
              fontSize: 26, fontWeight: 700,
              color: "#0f172a", lineHeight: 1,
              letterSpacing: "-0.5px",
            }}>
              {s.value}
            </p>
            {s.sub && <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Search ── */}
      <div style={{ marginBottom: 16 }}>
        <input
          style={{
            width: "100%", maxWidth: 340,
            padding: "9px 14px",
            border: "1px solid #e2e8f0", borderRadius: 8,
            fontSize: 13.5, color: "#0f172a", background: "#fff",
            outline: "none",
          }}
          placeholder="Search patient or invoice #…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onFocus={e => e.target.style.borderColor = "#3b82f6"}
          onBlur={e => e.target.style.borderColor = "#e2e8f0"}
        />
      </div>

      {/* ── Status filter buttons ── */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 8,
        marginBottom: 24,
      }}>
        {FILTER_STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`inv-filter-btn${statusFilter === s ? " active" : ""}`}
          >
            {s === "all" ? "All" : STATUS_META[s]?.label}
          </button>
        ))}
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="empty-state">Loading invoices…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p>No invoices found.</p>
          <button className="inv-btn-primary" style={{ marginTop: 12 }} onClick={() => navigate("/billing/new")}>
            Create first invoice
          </button>
        </div>
      ) : (
        <div style={{
          background: "#fff",
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0,0,0,.06),0 4px 12px rgba(0,0,0,.04)",
          overflow: "hidden",
        }}>
          <table className="inv-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Patient</th>
                <th>Visit Type</th>
                <th>Payment</th>
                <th className="right">Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => (
                <tr key={inv.id} onClick={() => navigate(`/billing/${inv.id}`)}>
                  <td style={{ fontFamily: "monospace", fontWeight: 600, color: "#334155" }}>
                    {inv.invoice_number ?? "—"}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: "#1e293b" }}>
                      {inv.patient?.first_name} {inv.patient?.last_name}
                    </div>
                    <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 2 }}>{inv.patient?.mrn}</div>
                  </td>
                  <td style={{ textTransform: "capitalize", color: "#475569" }}>
                    {inv.visit?.type ?? "—"}
                  </td>
                  <td>
                    {inv.payment_method ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#475569" }}>
                        <span>{PAYMENT_ICONS[inv.payment_method] ?? "💳"}</span>
                        <span style={{ textTransform: "capitalize" }}>{inv.payment_method}</span>
                      </span>
                    ) : "—"}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 600, color: "#1e293b" }}>
                    {formatNaira(inv.total_amount)}
                  </td>
                  <td><StatusBadge status={inv.status} /></td>
                  <td style={{ color: "#94a3b8", fontSize: 12 }}>
                    {inv.issued_at
                      ? new Date(inv.issued_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}