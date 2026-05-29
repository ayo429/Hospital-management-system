// src/pages/billing/NewInvoice.jsx
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

const CATEGORIES = ["consultation", "procedure", "lab", "medication", "bed", "other"];

const PAYMENT_METHODS = [
  { value: "cash",     label: "Cash",          icon: "💵" },
  { value: "card",     label: "Card",          icon: "💳" },
  { value: "transfer", label: "Bank Transfer", icon: "🏦" },
  { value: "hmo",      label: "HMO/Insurance", icon: "🏛" },
];

function formatNaira(amount) {
  return `₦${Number(amount ?? 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
}

function genTempId() {
  return `tmp_${Math.random().toString(36).slice(2, 9)}`;
}

export default function NewInvoice() {
  const { orgId } = useAuth();
  const navigate  = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedVisitId = searchParams.get("visit");

  const [visitSearch,      setVisitSearch]      = useState("");
  const [visitResults,     setVisitResults]     = useState([]);
  const [selectedVisit,    setSelectedVisit]    = useState(null);
  const [paymentMethod,    setPaymentMethod]    = useState("cash");
  const [hmoAmount,        setHmoAmount]        = useState("");
  const [items,            setItems]            = useState([]);
  const [saving,           setSaving]           = useState(false);
  const [error,            setError]            = useState(null);
  const [loadingVisit,     setLoadingVisit]     = useState(false);
  const [loadingAutoItems, setLoadingAutoItems] = useState(false);

  useEffect(() => {
    if (!preselectedVisitId || !orgId) return;
    loadVisit(preselectedVisitId);
  }, [preselectedVisitId, orgId]);

  async function loadVisit(visitId) {
    setLoadingVisit(true);
    const { data } = await supabase
      .from("visits")
      .select("id, type, chief_complaint, admitted_at, patient:patients(id, first_name, last_name, mrn)")
      .eq("id", visitId).eq("org_id", orgId).single();
    if (data) { setSelectedVisit(data); autoPopulateItems(visitId); }
    setLoadingVisit(false);
  }

  async function autoPopulateItems(visitId) {
    setLoadingAutoItems(true);
    const autoItems = [];

    const { data: prescriptions } = await supabase
      .from("prescriptions")
      .select("id, drug:drugs(name, selling_price), quantity, dosage")
      .eq("visit_id", visitId);

    (prescriptions ?? []).forEach(p => {
      autoItems.push({
        _id: genTempId(), description: p.drug?.name ?? "Medication",
        category: "medication", unit_price: Number(p.drug?.selling_price ?? 0),
        quantity: p.quantity ?? 1, source: "prescription",
      });
    });

    const { data: labOrders } = await supabase
      .from("lab_orders").select("id, test_name, price").eq("visit_id", visitId);

    (labOrders ?? []).forEach(l => {
      autoItems.push({
        _id: genTempId(), description: l.test_name ?? "Lab Test",
        category: "lab", unit_price: Number(l.price ?? 0),
        quantity: 1, source: "lab",
      });
    });

    autoItems.unshift({
      _id: genTempId(), description: "Consultation Fee",
      category: "consultation", unit_price: 0, quantity: 1, source: "manual",
    });

    setItems(autoItems);
    setLoadingAutoItems(false);
  }

  useEffect(() => {
    if (!orgId || preselectedVisitId) return;
    if (!visitSearch.trim()) { setVisitResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("visits")
        .select("id, type, admitted_at, patient:patients(id, first_name, last_name, mrn)")
        .eq("org_id", orgId).eq("status", "active")
        .order("admitted_at", { ascending: false }).limit(8);
      const q = visitSearch.toLowerCase();
      setVisitResults((data ?? []).filter(v =>
        `${v.patient?.first_name} ${v.patient?.last_name}`.toLowerCase().includes(q) ||
        (v.patient?.mrn ?? "").toLowerCase().includes(q)
      ));
    }, 300);
    return () => clearTimeout(t);
  }, [visitSearch, orgId]);

  function addItem() {
    setItems(prev => [...prev, { _id: genTempId(), description: "", category: "other", unit_price: 0, quantity: 1, source: "manual" }]);
  }
  function updateItem(id, field, value) {
    setItems(prev => prev.map(item => item._id === id ? { ...item, [field]: value } : item));
  }
  function removeItem(id) {
    setItems(prev => prev.filter(item => item._id !== id));
  }

  const subtotal    = items.reduce((s, i) => s + Number(i.unit_price) * Number(i.quantity), 0);
  const hmoAmt      = paymentMethod === "hmo" ? Number(hmoAmount || 0) : 0;
  const totalAmount = subtotal;

  async function handleSubmit(status = "unpaid") {
    setError(null);
    if (!selectedVisit)                         { setError("Please select a visit."); return; }
    if (items.length === 0)                     { setError("Add at least one line item."); return; }
    if (items.some(i => !i.description.trim())) { setError("All items need a description."); return; }

    setSaving(true);
    try {
      const { data: invNum } = await supabase.rpc("generate_invoice_number");

      const { data: inv, error: invErr } = await supabase
        .from("invoices")
        .insert({
          org_id: orgId, visit_id: selectedVisit.id,
          patient_id: selectedVisit.patient.id,
          invoice_number: invNum, payment_method: paymentMethod,
          hmo_amount: hmoAmt, total_amount: totalAmount,
          amount_paid: status === "paid" ? totalAmount : 0,
          status, issued_at: new Date().toISOString(),
          paid_at: status === "paid" ? new Date().toISOString() : null,
        })
        .select("id").single();

      if (invErr) throw invErr;

      const { error: itemsErr } = await supabase.from("invoice_items").insert(
        items.map(i => ({
          invoice_id: inv.id, description: i.description.trim(),
          category: i.category, unit_price: Number(i.unit_price), quantity: Number(i.quantity),
        }))
      );
      if (itemsErr) throw itemsErr;

      navigate(`/billing/${inv.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const inp = {
    width: "100%", padding: "8px 12px",
    border: "1px solid #e2e8f0", borderRadius: 8,
    fontSize: 13.5, color: "#0f172a", background: "#fff",
    outline: "none", boxSizing: "border-box",
  };

  const card = {
    background: "#fff", borderRadius: 10,
    border: "1px solid #e2e8f0",
    boxShadow: "0 1px 3px rgba(0,0,0,.06),0 4px 12px rgba(0,0,0,.04)",
    padding: 24, marginBottom: 20,
  };

  const cardTitle = {
    fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600,
    color: "#0f172a", marginBottom: 20,
    paddingBottom: 12, borderBottom: "1px solid #e2e8f0",
  };

  return (
    <>
      <style>{`
        .ni-btn {
          display:inline-flex;align-items:center;justify-content:center;gap:6px;
          padding:10px 20px;border-radius:8px;font-size:13.5px;font-weight:600;
          cursor:pointer;transition:background .15s,opacity .15s;
          white-space:nowrap;border:none;
        }
        .ni-btn:disabled { opacity:.45;cursor:not-allowed; }
        .ni-btn-primary   { background:var(--blue-600);color:#fff; }
        .ni-btn-primary:hover:not(:disabled)   { background:var(--blue-500); }
        .ni-btn-secondary { background:#fff;color:#0f172a;border:1px solid #e2e8f0; }
        .ni-btn-secondary:hover:not(:disabled) { background:#f8fafc; }
        .ni-btn-green     { background:#059669;color:#fff; }
        .ni-btn-green:hover:not(:disabled)     { background:#047857; }

        .ni-inp {
          width:100%;padding:9px 12px;
          border:1px solid #e2e8f0;border-radius:8px;
          font-size:13.5px;color:#0f172a;background:#fff;
          outline:none;box-sizing:border-box;
          transition:border-color .15s,box-shadow .15s;
          font-family:var(--font-body);
        }
        .ni-inp:focus { border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.12); }
        .ni-inp::placeholder { color:#94a3b8; }

        .pay-method-btn {
          display:inline-flex;align-items:center;gap:10px;
          padding:12px 20px;border-radius:10px;border:2px solid #e2e8f0;
          background:#fff;font-size:14px;font-weight:600;
          color:#475569;cursor:pointer;
          transition:border-color .15s,background .15s,color .15s;
        }
        .pay-method-btn:hover { border-color:#93c5fd;background:#eff6ff; }
        .pay-method-btn.active {
          border-color:var(--blue-600);background:var(--blue-600);color:#fff;
          box-shadow:0 2px 8px rgba(29,78,216,.25);
        }
        .pay-method-btn .pm-icon { font-size:18px;line-height:1; }

        .item-row {
          display:grid;
          grid-template-columns:1fr 130px 100px 70px 100px 32px;
          gap:10px;align-items:center;
          padding:10px 12px;border-radius:10px;border:1px solid #e2e8f0;
          background:#fff;
        }
        .item-row.from-prescription { border-color:#d8b4fe;background:#faf5ff; }
        .item-row.from-lab           { border-color:#bfdbfe;background:#eff6ff; }

        .item-col-headers {
          display:grid;
          grid-template-columns:1fr 130px 100px 70px 100px 32px;
          gap:10px;padding:0 12px 6px;
          font-size:11px;font-weight:600;color:#94a3b8;
          text-transform:uppercase;letter-spacing:.5px;
        }

        .remove-btn {
          width:28px;height:28px;border-radius:7px;
          display:flex;align-items:center;justify-content:center;
          background:transparent;border:none;cursor:pointer;
          font-size:18px;color:#cbd5e1;
          transition:color .15s,background .15s;
        }
        .remove-btn:hover { color:#ef4444;background:#fef2f2; }
      `}</style>

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-header__title">New Invoice</h1>
          <p className="page-header__subtitle">Create an invoice for a patient visit</p>
        </div>
        <button className="ni-btn ni-btn-secondary" onClick={() => navigate("/billing")}>← Back</button>
      </div>

      {error && <div className="form-error">{error}</div>}

      {/* ── Visit selection ── */}
      <div style={card}>
        <div style={cardTitle}>Patient Visit</div>
        {selectedVisit ? (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 18px", borderRadius: 10,
            border: "2px solid #bfdbfe", background: "#eff6ff",
          }}>
            <div>
              <p style={{ fontWeight: 600, fontSize: 14, color: "#1e293b" }}>
                {selectedVisit.patient?.first_name} {selectedVisit.patient?.last_name}
                <span style={{
                  marginLeft: 8, fontSize: 12, fontWeight: 400, color: "#64748b",
                  background: "#fff", padding: "2px 8px", borderRadius: 99, border: "1px solid #e2e8f0",
                }}>
                  {selectedVisit.patient?.mrn}
                </span>
              </p>
              <p style={{ fontSize: 13, color: "#64748b", marginTop: 4, textTransform: "capitalize" }}>
                {selectedVisit.type} visit ·{" "}
                {selectedVisit.admitted_at
                  ? new Date(selectedVisit.admitted_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })
                  : ""}
              </p>
            </div>
            {!preselectedVisitId && (
              <button className="ni-btn ni-btn-secondary" style={{ padding: "6px 14px", fontSize: 12 }}
                onClick={() => { setSelectedVisit(null); setItems([]); setVisitSearch(""); }}>
                Change
              </button>
            )}
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            <input
              className="ni-inp"
              placeholder="Search by patient name or MRN…"
              value={visitSearch}
              onChange={e => setVisitSearch(e.target.value)}
            />
            {visitResults.length > 0 && (
              <div style={{
                position: "absolute", zIndex: 10, width: "100%", marginTop: 4,
                background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
                boxShadow: "0 4px 16px rgba(0,0,0,.08)", overflow: "hidden",
              }}>
                {visitResults.map(v => (
                  <button key={v.id} type="button"
                    style={{
                      width: "100%", textAlign: "left", padding: "12px 16px",
                      background: "none", border: "none", borderBottom: "1px solid #f1f5f9",
                      cursor: "pointer", transition: "background .15s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                    onMouseLeave={e => e.currentTarget.style.background = "none"}
                    onClick={() => { setSelectedVisit(v); setVisitResults([]); setVisitSearch(""); autoPopulateItems(v.id); }}
                  >
                    <p style={{ fontWeight: 600, fontSize: 13.5, color: "#1e293b" }}>
                      {v.patient?.first_name} {v.patient?.last_name}
                      <span style={{ marginLeft: 8, fontSize: 11.5, fontWeight: 400, color: "#94a3b8" }}>{v.patient?.mrn}</span>
                    </p>
                    <p style={{ fontSize: 12, color: "#94a3b8", textTransform: "capitalize", marginTop: 2 }}>
                      {v.type} · {v.admitted_at ? new Date(v.admitted_at).toLocaleDateString() : ""}
                    </p>
                  </button>
                ))}
              </div>
            )}
            {loadingVisit && <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 8 }}>Loading visit…</p>}
          </div>
        )}
      </div>

      {/* ── Payment method ── */}
      <div style={card}>
        <div style={cardTitle}>Payment Method</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {PAYMENT_METHODS.map(pm => (
            <button
              key={pm.value}
              type="button"
              onClick={() => setPaymentMethod(pm.value)}
              className={`pay-method-btn${paymentMethod === pm.value ? " active" : ""}`}
            >
              <span className="pm-icon">{pm.icon}</span>
              {pm.label}
            </button>
          ))}
        </div>

        {paymentMethod === "hmo" && (
          <div style={{ marginTop: 20, maxWidth: 280 }}>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>
              HMO covers (₦)
            </label>
            <input
              className="ni-inp"
              type="number" min={0} placeholder="0.00"
              value={hmoAmount}
              onChange={e => setHmoAmount(e.target.value)}
            />
            <p style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 6 }}>Patient pays the remaining balance</p>
          </div>
        )}
      </div>

      {/* ── Line items ── */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, paddingBottom: 12, borderBottom: "1px solid #e2e8f0" }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, color: "#0f172a" }}>Line Items</span>
          <button type="button" className="ni-btn ni-btn-secondary" style={{ padding: "6px 14px", fontSize: 12.5 }} onClick={addItem}>
            + Add Item
          </button>
        </div>

        {loadingAutoItems ? (
          <div style={{ padding: "32px 0", textAlign: "center", fontSize: 13, color: "#94a3b8" }}>
            Auto-populating from visit…
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: "32px 0", textAlign: "center", fontSize: 13, color: "#94a3b8" }}>
            <p>No items yet.</p>
            <button type="button" className="ni-btn ni-btn-primary" style={{ marginTop: 12, padding: "7px 16px", fontSize: 13 }} onClick={addItem}>
              Add first item
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="item-col-headers">
              <span>Description</span>
              <span>Category</span>
              <span>Price (₦)</span>
              <span>Qty</span>
              <span style={{ textAlign: "right" }}>Total</span>
              <span />
            </div>

            {items.map(item => (
              <div
                key={item._id}
                className={`item-row${item.source === "prescription" ? " from-prescription" : item.source === "lab" ? " from-lab" : ""}`}
              >
                <input
                  className="ni-inp" style={{ fontSize: 13 }}
                  value={item.description}
                  onChange={e => updateItem(item._id, "description", e.target.value)}
                  placeholder="Item description"
                />
                <select
                  className="ni-inp" style={{ fontSize: 13 }}
                  value={item.category}
                  onChange={e => updateItem(item._id, "category", e.target.value)}
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
                <input
                  className="ni-inp" style={{ fontSize: 13 }}
                  type="number" min={0}
                  value={item.unit_price}
                  onChange={e => updateItem(item._id, "unit_price", e.target.value)}
                />
                <input
                  className="ni-inp" style={{ fontSize: 13 }}
                  type="number" min={1}
                  value={item.quantity}
                  onChange={e => updateItem(item._id, "quantity", e.target.value)}
                />
                <div style={{ textAlign: "right", fontWeight: 600, fontSize: 13.5, color: "#1e293b", whiteSpace: "nowrap" }}>
                  {formatNaira(Number(item.unit_price) * Number(item.quantity))}
                </div>
                <button type="button" className="remove-btn" onClick={() => removeItem(item._id)}>×</button>
              </div>
            ))}

            {items.some(i => i.source !== "manual") && (
              <div style={{ display: "flex", gap: 16, marginTop: 4, fontSize: 11.5, color: "#94a3b8" }}>
                {items.some(i => i.source === "prescription") && (
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#c084fc", display: "inline-block" }} />
                    From prescription
                  </span>
                )}
                {items.some(i => i.source === "lab") && (
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#60a5fa", display: "inline-block" }} />
                    From lab order
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Totals */}
        {items.length > 0 && (
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #e2e8f0", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", width: 240, fontSize: 13.5, color: "#64748b" }}>
              <span>Subtotal</span>
              <span style={{ fontWeight: 600, color: "#334155" }}>{formatNaira(subtotal)}</span>
            </div>
            {paymentMethod === "hmo" && hmoAmt > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", width: 240, fontSize: 13.5, color: "#64748b" }}>
                <span>HMO covers</span>
                <span style={{ fontWeight: 600, color: "#059669" }}>−{formatNaira(hmoAmt)}</span>
              </div>
            )}
            <div style={{
              display: "flex", justifyContent: "space-between", width: 240,
              fontSize: 15, fontWeight: 700, color: "#0f172a",
              paddingTop: 10, marginTop: 4, borderTop: "2px solid #e2e8f0",
            }}>
              <span>Total</span>
              <span>{formatNaira(totalAmount)}</span>
            </div>
            {paymentMethod === "hmo" && hmoAmt > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", width: 240, fontSize: 13, color: "#64748b" }}>
                <span>Patient pays</span>
                <span style={{ fontWeight: 600 }}>{formatNaira(Math.max(0, totalAmount - hmoAmt))}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Actions ── */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginBottom: 40 }}>
        <button type="button" className="ni-btn ni-btn-secondary" onClick={() => navigate("/billing")}>Cancel</button>
        <button type="button" className="ni-btn ni-btn-secondary" disabled={saving} onClick={() => handleSubmit("draft")}>
          Save as Draft
        </button>
        <button type="button" className="ni-btn ni-btn-primary" disabled={saving} onClick={() => handleSubmit("unpaid")}>
          {saving ? "Saving…" : "Issue Invoice"}
        </button>
        <button type="button" className="ni-btn ni-btn-green" disabled={saving} onClick={() => handleSubmit("paid")}>
          {saving ? "Saving…" : "Issue & Mark Paid"}
        </button>
      </div>
    </>
  );
}