// src/pages/billing/InvoiceDetail.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

const STATUS_META = {
  unpaid:    { label: "Unpaid",    bg: "#fffbeb", border: "#fde68a", text: "#b45309", dot: "#f59e0b"  },
  paid:      { label: "Paid",      bg: "#ecfdf5", border: "#a7f3d0", text: "#065f46", dot: "#10b981"  },
  draft:     { label: "Draft",     bg: "#f8fafc", border: "#e2e8f0", text: "#64748b", dot: "#94a3b8"  },
  cancelled: { label: "Cancelled", bg: "#fef2f2", border: "#fecaca", text: "#991b1b", dot: "#ef4444"  },
  partial:   { label: "Partial",   bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8", dot: "#3b82f6"  },
};

const PAYMENT_ICONS  = { cash: "💵", hmo: "🏛", card: "💳", transfer: "🏦" };
const CATEGORY_ICONS = { consultation: "🩺", procedure: "🔬", lab: "🧪", medication: "💊", bed: "🛏", other: "📋" };

function formatNaira(amount) {
  return `₦${Number(amount ?? 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
}

function StatusBadge({ status }) {
  const m = STATUS_META[status] ?? STATUS_META.unpaid;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 12px", borderRadius: 99,
      fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
      background: m.bg, color: m.text, border: `1px solid ${m.border}`,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: m.dot, flexShrink: 0 }} />
      {m.label}
    </span>
  );
}

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { orgId, isOwner, isAdmin, isAccountant, isNurse, isPharmacist } = useAuth();
  const canManage = isOwner || isAdmin || isAccountant || isNurse || isPharmacist;

  const [invoice,           setInvoice]           = useState(null);
  const [items,             setItems]             = useState([]);
  const [loading,           setLoading]           = useState(true);
  const [marking,           setMarking]           = useState(false);
  const [cancelling,        setCancelling]        = useState(false);
  const [error,             setError]             = useState(null);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);

  async function fetchInvoice() {
    setLoading(true);
    const [{ data: inv }, { data: lineItems }] = await Promise.all([
      supabase
        .from("invoices")
        .select(`
          id, invoice_number, status, payment_method,
          total_amount, amount_paid, hmo_amount, issued_at, paid_at,
          patient:patients(id, first_name, last_name, mrn, phone),
          visit:visits(id, type, chief_complaint, admitted_at)
        `)
        .eq("id", id).eq("org_id", orgId).single(),
      supabase.from("invoice_items").select("*").eq("invoice_id", id).order("category"),
    ]);
    setInvoice(inv ?? null);
    setItems(lineItems ?? []);
    setLoading(false);
  }

  useEffect(() => { if (id && orgId) fetchInvoice(); }, [id, orgId]);

  async function handleMarkPaid() {
    setMarking(true); setError(null);
    try {
      const { error: err } = await supabase.from("invoices").update({
        status: "paid", amount_paid: invoice.total_amount, paid_at: new Date().toISOString(),
      }).eq("id", id);
      if (err) throw err;
      await fetchInvoice();
    } catch (e) { setError(e.message); }
    finally { setMarking(false); }
  }

  async function handleCancel() {
    setCancelling(true); setError(null);
    try {
      const { error: err } = await supabase.from("invoices").update({ status: "cancelled" }).eq("id", id);
      if (err) throw err;
      setShowConfirmCancel(false);
      await fetchInvoice();
    } catch (e) { setError(e.message); }
    finally { setCancelling(false); }
  }

  if (loading) return <div className="empty-state">Loading invoice…</div>;
  if (!invoice) return (
    <div className="empty-state">
      <p>Invoice not found.</p>
      <button className="btn btn--secondary" style={{ marginTop: 12 }} onClick={() => navigate("/billing")}>← Back to Billing</button>
    </div>
  );

  const balance = Number(invoice.total_amount) - Number(invoice.amount_paid);

  const btn = {
    base: {
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
      padding: "10px 20px", borderRadius: 8, fontSize: 13.5, fontWeight: 600,
      cursor: "pointer", border: "none", whiteSpace: "nowrap",
      transition: "background .15s, opacity .15s",
    },
  };

  return (
    <>
      <style>{`
        .id-btn { display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px 20px;border-radius:8px;font-size:13.5px;font-weight:600;cursor:pointer;white-space:nowrap;transition:background .15s,opacity .15s;border:none; }
        .id-btn:disabled { opacity:.45;cursor:not-allowed; }
        .id-btn-green    { background:#059669;color:#fff; }
        .id-btn-green:hover:not(:disabled)    { background:#047857; }
        .id-btn-primary  { background:var(--blue-600);color:#fff; }
        .id-btn-primary:hover:not(:disabled)  { background:var(--blue-500); }
        .id-btn-secondary { background:#fff;color:#0f172a;border:1px solid #e2e8f0; }
        .id-btn-secondary:hover:not(:disabled) { background:#f8fafc; }
        .id-btn-danger   { background:#fff;color:#ef4444;border:1px solid #fecaca; }
        .id-btn-danger:hover:not(:disabled)   { background:#fef2f2; }

        .id-card {
          background:#fff;border-radius:10px;
          border:1px solid #e2e8f0;
          box-shadow:0 1px 3px rgba(0,0,0,.06),0 4px 12px rgba(0,0,0,.04);
          overflow:hidden;margin-bottom:0;
        }
        .id-card-header {
          padding:14px 20px;border-bottom:1px solid #e2e8f0;
          font-family:var(--font-display);font-size:13.5px;font-weight:600;color:#0f172a;
        }
        .id-card-body { padding:20px; }

        .id-table { width:100%;border-collapse:collapse;font-size:13.5px; }
        .id-table th {
          text-align:left;padding:10px 16px;
          font-size:11px;font-weight:600;color:#94a3b8;
          text-transform:uppercase;letter-spacing:.5px;
          background:#f8fafc;border-bottom:1px solid #e2e8f0;
          white-space:nowrap;
        }
        .id-table th.right { text-align:right; }
        .id-table td { padding:12px 16px;border-bottom:1px solid #f1f5f9;color:#1e293b; }
        .id-table tr:last-child td { border-bottom:none; }

        .id-info-row { display:flex;flex-direction:column;gap:4px;margin-bottom:16px; }
        .id-info-row:last-child { margin-bottom:0; }
        .id-info-label { font-size:11.5px;color:#94a3b8;font-weight:500; }
        .id-info-value { font-size:13.5px;color:#1e293b;font-weight:600; }
      `}</style>

      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <button
            onClick={() => navigate("/billing")}
            style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 600, color: "#94a3b8", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 8 }}
            onMouseEnter={e => e.currentTarget.style.color = "#475569"}
            onMouseLeave={e => e.currentTarget.style.color = "#94a3b8"}
          >
            ← Back to Billing
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 className="page-header__title">{invoice.invoice_number ?? "Invoice"}</h1>
            <StatusBadge status={invoice.status} />
          </div>
          <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>
            Issued {invoice.issued_at ? new Date(invoice.issued_at).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" }) : ""}
            {invoice.paid_at ? ` · Paid ${new Date(invoice.paid_at).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}` : ""}
          </p>
        </div>

        {/* ── Action buttons ── */}
        {canManage && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {invoice.status === "unpaid" && (
              <button className="id-btn id-btn-green" onClick={handleMarkPaid} disabled={marking}>
                {marking ? "Marking…" : "✓ Mark as Paid"}
              </button>
            )}
            {invoice.status === "draft" && (
              <button className="id-btn id-btn-primary" onClick={handleMarkPaid} disabled={marking}>
                {marking ? "Issuing…" : "Issue Invoice"}
              </button>
            )}
            {(invoice.status === "unpaid" || invoice.status === "draft") && (
              !showConfirmCancel ? (
                <button className="id-btn id-btn-danger" onClick={() => setShowConfirmCancel(true)}>
                  Cancel Invoice
                </button>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 8, border: "1px solid #fecaca", background: "#fef2f2" }}>
                  <span style={{ fontSize: 12.5, color: "#b91c1c", fontWeight: 500 }}>Sure?</span>
                  <button onClick={handleCancel} disabled={cancelling}
                    style={{ fontSize: 12.5, fontWeight: 700, color: "#b91c1c", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    {cancelling ? "Cancelling…" : "Yes, cancel"}
                  </button>
                  <button onClick={() => setShowConfirmCancel(false)}
                    style={{ fontSize: 12.5, color: "#94a3b8", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    No
                  </button>
                </div>
              )
            )}
            <button className="id-btn id-btn-secondary" onClick={() => navigate(`/visits/${invoice.visit?.id}`)}>
              View Visit
            </button>
          </div>
        )}
      </div>

      {error && <div className="form-error">{error}</div>}

      {/* ── Body ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, alignItems: "start" }}>

        {/* Left */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Patient + visit */}
          <div className="id-card">
            <div className="id-card-header">Patient &amp; Visit</div>
            <div className="id-card-body">
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                  background: "var(--blue-100)", color: "var(--blue-700)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 15, fontWeight: 700,
                }}>
                  {invoice.patient?.first_name?.[0]}{invoice.patient?.last_name?.[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                    {invoice.patient?.first_name} {invoice.patient?.last_name}
                  </p>
                  <p style={{ fontSize: 12.5, color: "#94a3b8", marginTop: 2 }}>MRN: {invoice.patient?.mrn}</p>
                  {invoice.patient?.phone && <p style={{ fontSize: 12.5, color: "#94a3b8" }}>{invoice.patient.phone}</p>}
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #f1f5f9", fontSize: 12.5, color: "#64748b", textTransform: "capitalize" }}>
                    {invoice.visit?.type} visit · {invoice.visit?.chief_complaint}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="id-card">
            <div className="id-card-header">Line Items</div>
            {items.length === 0 ? (
              <div className="empty-state">No line items.</div>
            ) : (
              <>
                <div style={{ overflowX: "auto" }}>
                  <table className="id-table">
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th>Category</th>
                        <th className="right">Unit Price</th>
                        <th className="right">Qty</th>
                        <th className="right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(item => (
                        <tr key={item.id}>
                          <td style={{ fontWeight: 500 }}>{item.description}</td>
                          <td>
                            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#64748b", textTransform: "capitalize", whiteSpace: "nowrap" }}>
                              {CATEGORY_ICONS[item.category] ?? "📋"} {item.category}
                            </span>
                          </td>
                          <td style={{ textAlign: "right", color: "#64748b" }}>{formatNaira(item.unit_price)}</td>
                          <td style={{ textAlign: "right", color: "#64748b" }}>{item.quantity}</td>
                          <td style={{ textAlign: "right", fontWeight: 600 }}>{formatNaira(item.total ?? (item.unit_price * item.quantity))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div style={{ padding: "16px 20px", borderTop: "1px solid #e2e8f0", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", width: 220, fontSize: 13.5, color: "#64748b" }}>
                    <span>Subtotal</span>
                    <span style={{ fontWeight: 600, color: "#334155" }}>{formatNaira(invoice.total_amount)}</span>
                  </div>
                  {Number(invoice.hmo_amount) > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", width: 220, fontSize: 13.5, color: "#64748b" }}>
                      <span>HMO covers</span>
                      <span style={{ fontWeight: 600, color: "#059669" }}>−{formatNaira(invoice.hmo_amount)}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", width: 220, fontSize: 15, fontWeight: 700, color: "#0f172a", paddingTop: 10, marginTop: 4, borderTop: "2px solid #e2e8f0" }}>
                    <span>Total</span>
                    <span>{formatNaira(invoice.total_amount)}</span>
                  </div>
                  {Number(invoice.amount_paid) > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", width: 220, fontSize: 13, color: "#059669" }}>
                      <span>Amount Paid</span>
                      <span style={{ fontWeight: 600 }}>{formatNaira(invoice.amount_paid)}</span>
                    </div>
                  )}
                  {balance > 0 && invoice.status !== "paid" && (
                    <div style={{ display: "flex", justifyContent: "space-between", width: 220, fontSize: 13, color: "#dc2626", fontWeight: 600 }}>
                      <span>Balance Due</span>
                      <span>{formatNaira(balance)}</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Payment summary */}
          <div className="id-card">
            <div className="id-card-header">Payment Summary</div>
            <div className="id-card-body">
              <div className="id-info-row">
                <span className="id-info-label">Status</span>
                <span><StatusBadge status={invoice.status} /></span>
              </div>
              <div className="id-info-row">
                <span className="id-info-label">Payment Method</span>
                <span className="id-info-value" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {PAYMENT_ICONS[invoice.payment_method] ?? "—"}
                  <span style={{ textTransform: "capitalize" }}>{invoice.payment_method ?? "Not set"}</span>
                </span>
              </div>
              <div className="id-info-row">
                <span className="id-info-label">Total Amount</span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.5px" }}>
                  {formatNaira(invoice.total_amount)}
                </span>
              </div>
              {Number(invoice.hmo_amount) > 0 && (
                <div className="id-info-row">
                  <span className="id-info-label">HMO Covers</span>
                  <span className="id-info-value" style={{ color: "#059669" }}>{formatNaira(invoice.hmo_amount)}</span>
                </div>
              )}
              {invoice.status === "paid" ? (
                <div style={{ padding: "10px 14px", borderRadius: 8, background: "#ecfdf5", border: "1px solid #a7f3d0", fontSize: 13, color: "#065f46", fontWeight: 600, textAlign: "center", marginTop: 4 }}>
                  ✓ Fully Paid
                </div>
              ) : balance > 0 ? (
                <div style={{ padding: "10px 14px", borderRadius: 8, background: "#fffbeb", border: "1px solid #fde68a", fontSize: 13, color: "#b45309", fontWeight: 600, textAlign: "center", marginTop: 4 }}>
                  {formatNaira(balance)} outstanding
                </div>
              ) : null}
            </div>
          </div>

          {/* Quick actions */}
          {canManage && invoice.status === "unpaid" && (
            <div className="id-card">
              <div className="id-card-header">Quick Actions</div>
              <div className="id-card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button className="id-btn id-btn-green" style={{ width: "100%" }} onClick={handleMarkPaid} disabled={marking}>
                  {marking ? "Processing…" : "✓ Mark as Paid"}
                </button>
                <button className="id-btn id-btn-secondary" style={{ width: "100%" }}
                  onClick={() => navigate(`/billing/new?visit=${invoice.visit?.id}`)}>
                  Create New Invoice
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}