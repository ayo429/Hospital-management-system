// src/pages/pharmacy/Drugs.jsx
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatNaira(amount) {
  return `₦${Number(amount ?? 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
}

function StockBadge({ qty, reorder }) {
  if (qty === 0)        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-600">Out of stock</span>;
  if (qty <= reorder)   return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700">Low stock</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700">In stock</span>;
}

// ── Dispense Modal ────────────────────────────────────────────────────────────
function DispenseModal({ prescription, onClose, onDispensed }) {
  const [dispensing, setDispensing] = useState(false);
  const [error, setError]           = useState(null);
  const [qty, setQty]               = useState(prescription.quantity ?? 1);

  async function handleDispense() {
    setDispensing(true);
    setError(null);
    try {
      // 1. Reduce stock
      const { error: stockErr } = await supabase.rpc("dispense_drug", {
        p_drug_id:  prescription.drug_id,
        p_quantity: Number(qty),
      }).single();

      // Fallback if RPC doesn't exist — do it manually
      if (stockErr) {
        const { data: drug } = await supabase
          .from("drugs")
          .select("stock_qty")
          .eq("id", prescription.drug_id)
          .single();

        if ((drug?.stock_qty ?? 0) < qty) throw new Error("Insufficient stock.");

        const { error: updateErr } = await supabase
          .from("drugs")
          .update({ stock_qty: drug.stock_qty - Number(qty) })
          .eq("id", prescription.drug_id);
        if (updateErr) throw updateErr;
      }

      // 2. Mark prescription as dispensed
      const { error: presErr } = await supabase
        .from("prescriptions")
        .update({ status: "dispensed" })
        .eq("id", prescription.id);
      if (presErr) throw presErr;

      onDispensed?.();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setDispensing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div className="bg-white rounded-[10px] w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
          <h2 style={{ fontFamily: "var(--font-display)" }} className="text-[15px] font-semibold text-slate-900">Dispense Prescription</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none bg-transparent border-none cursor-pointer">×</button>
        </div>
        <div className="px-6 py-5">
          {error && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-700">{error}</div>}
          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-[13px] font-semibold text-slate-800">{prescription.drug?.name}</p>
              <p className="text-[12px] text-slate-500 mt-0.5">{prescription.dosage} · {prescription.frequency} · {prescription.duration_days} days</p>
              <p className="text-[12px] text-slate-500 mt-0.5">
                Patient: <span className="font-medium">{prescription.visit?.patient?.first_name} {prescription.visit?.patient?.last_name}</span>
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-semibold text-slate-500">Quantity to dispense</label>
              <input
                type="number"
                min={1}
                className="px-3 py-2 border border-slate-200 rounded-lg text-[13.5px] outline-none focus:border-blue-400 transition"
                value={qty}
                onChange={e => setQty(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button onClick={handleDispense} disabled={dispensing} className="btn-primary">
              {dispensing ? "Dispensing…" : "Dispense"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Purchase Order Modal ──────────────────────────────────────────────────────
function PurchaseOrderModal({ drug, onClose, onSaved }) {
  const { orgId } = useAuth();
  const [form, setForm] = useState({
    supplier_name: "",
    quantity:      "",
    unit_cost:     "",
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  async function handleSave() {
    if (!form.quantity || Number(form.quantity) < 1) { setError("Enter a valid quantity."); return; }
    if (!form.unit_cost || Number(form.unit_cost) < 0) { setError("Enter a valid unit cost."); return; }
    setSaving(true); setError(null);
    const { error: err } = await supabase.from("purchase_orders").insert({
      org_id:        orgId,
      drug_id:       drug.id,
      supplier_name: form.supplier_name.trim() || null,
      quantity:      Number(form.quantity),
      unit_cost:     Number(form.unit_cost),
      status:        "pending",
    });
    if (err) { setError(err.message); setSaving(false); }
    else     { onSaved?.(); onClose(); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div className="bg-white rounded-[10px] w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
          <h2 style={{ fontFamily: "var(--font-display)" }} className="text-[15px] font-semibold text-slate-900">Restock — {drug.name}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none bg-transparent border-none cursor-pointer">×</button>
        </div>
        <div className="px-6 py-5">
          {error && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-700">{error}</div>}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-semibold text-slate-500">Supplier name <span className="font-normal text-slate-400">(optional)</span></label>
              <input className="inp" placeholder="e.g. Emzor Pharma" value={form.supplier_name} onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[12.5px] font-semibold text-slate-500">Quantity</label>
                <input type="number" min={1} className="inp" placeholder="e.g. 100" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[12.5px] font-semibold text-slate-500">Unit cost (₦)</label>
                <input type="number" min={0} className="inp" placeholder="0.00" value={form.unit_cost} onChange={e => setForm(f => ({ ...f, unit_cost: e.target.value }))} />
              </div>
            </div>
            {form.quantity && form.unit_cost && (
              <div className="px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-[13px] text-blue-700">
                Total cost: <strong>{formatNaira(Number(form.quantity) * Number(form.unit_cost))}</strong>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? "Saving…" : "Place Order"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Receive Stock Modal ───────────────────────────────────────────────────────
function ReceiveStockModal({ order, onClose, onReceived }) {
  const [receiving, setReceiving] = useState(false);
  const [error, setError]         = useState(null);

  async function handleReceive() {
    setReceiving(true); setError(null);
    try {
      // 1. Add stock to drug
      const { data: drug } = await supabase.from("drugs").select("stock_qty").eq("id", order.drug_id).single();
      const { error: drugErr } = await supabase.from("drugs")
        .update({ stock_qty: (drug?.stock_qty ?? 0) + order.quantity })
        .eq("id", order.drug_id);
      if (drugErr) throw drugErr;

      // 2. Mark order as received
      const { error: orderErr } = await supabase.from("purchase_orders")
        .update({ status: "received", received_at: new Date().toISOString() })
        .eq("id", order.id);
      if (orderErr) throw orderErr;

      onReceived?.();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setReceiving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div className="bg-white rounded-[10px] w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
          <h2 style={{ fontFamily: "var(--font-display)" }} className="text-[15px] font-semibold text-slate-900">Receive Stock</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none bg-transparent border-none cursor-pointer">×</button>
        </div>
        <div className="px-6 py-5">
          {error && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-700">{error}</div>}
          <p className="text-[13.5px] text-slate-600 mb-2">
            Confirm receipt of <strong>{order.quantity} units</strong> of <strong>{order.drug?.name}</strong>
            {order.supplier_name ? ` from ${order.supplier_name}` : ""}?
          </p>
          <p className="text-[12.5px] text-slate-400">This will add {order.quantity} units to the drug's stock.</p>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button onClick={handleReceive} disabled={receiving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13.5px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white border-none cursor-pointer transition disabled:opacity-50">
              {receiving ? "Receiving…" : "✓ Mark Received"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Drugs() {
  const { orgId, isOwner, isAdmin, isPharmacist } = useAuth();
  const navigate   = useNavigate();
  const canManage  = isOwner || isAdmin || isPharmacist;

  const [tab,            setTab]            = useState("inventory"); // inventory | prescriptions | orders
  const [drugs,          setDrugs]          = useState([]);
  const [prescriptions,  setPrescriptions]  = useState([]);
  const [orders,         setOrders]         = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [search,         setSearch]         = useState("");
  const [stockFilter,    setStockFilter]    = useState("all");
  const [activeDrug,     setActiveDrug]     = useState(null);     // for purchase order modal
  const [activeRx,       setActiveRx]       = useState(null);     // for dispense modal
  const [activeOrder,    setActiveOrder]    = useState(null);     // for receive modal

 const fetchAll = useCallback(async () => {
  setLoading(true);
  const [{ data: d }, { data: rx }, { data: po }] = await Promise.all([
    supabase.from("drugs").select("*").eq("org_id", orgId).order("name"),
    supabase.from("prescriptions")
      .select("*, drug:drugs(id, name, stock_qty, unit), visit:visits(id, patient:patients(id, first_name, last_name))")
      .eq("org_id", orgId)
      .eq("status", "pending")
      .order("prescribed_at", { ascending: false }),
    supabase.from("purchase_orders")
      .select("*, drug:drugs(id, name)")
      .eq("org_id", orgId)
      .order("ordered_at", { ascending: false }),
  ]);
  setDrugs(d ?? []);
  setPrescriptions(rx ?? []);
  setOrders(po ?? []);
  setLoading(false);
}, [orgId]);

useEffect(() => { if (orgId) fetchAll(); }, [orgId, fetchAll]);

  // Filtered drugs
  const filteredDrugs = drugs.filter(d => {
    const matchSearch = !search || d.name.toLowerCase().includes(search.toLowerCase()) || (d.generic_name ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStock  =
      stockFilter === "all"      ? true :
      stockFilter === "out"      ? d.stock_qty === 0 :
      stockFilter === "low"      ? d.stock_qty > 0 && d.stock_qty <= d.reorder_level :
      stockFilter === "ok"       ? d.stock_qty > d.reorder_level : true;
    return matchSearch && matchStock;
  });

  const lowStockCount = drugs.filter(d => d.stock_qty <= d.reorder_level).length;
  const pendingRxCount = prescriptions.length;
  const pendingOrdersCount = orders.filter(o => o.status === "pending").length;

  return (
    <>
      <style>{`
        .btn-primary   { display:inline-flex;align-items:center;gap:6px;padding:9px 18px;border-radius:8px;font-size:13.5px;font-weight:600;cursor:pointer;border:none;background:var(--blue-600);color:#fff;transition:background .15s;white-space:nowrap; }
        .btn-primary:hover { background:var(--blue-500); }
        .btn-primary:disabled { opacity:.45;cursor:not-allowed; }
        .btn-secondary { display:inline-flex;align-items:center;gap:6px;padding:9px 18px;border-radius:8px;font-size:13.5px;font-weight:600;cursor:pointer;background:#fff;color:var(--text-primary);border:1px solid var(--border);transition:background .15s;white-space:nowrap; }
        .btn-secondary:hover { background:var(--bg-page); }
        .inp { width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13.5px;color:var(--text-primary);background:#fff;outline:none;transition:border-color .15s; }
        .inp:focus { border-color:var(--blue-400);box-shadow:0 0 0 3px rgba(59,130,246,.12); }
      `}</style>

      <div className="p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-7">
          <div>
            <h1 style={{ fontFamily: "var(--font-display)" }} className="text-[22px] font-bold text-slate-900 tracking-tight">Pharmacy</h1>
            <p className="text-[14px] text-slate-500 mt-1">Drug inventory, prescriptions and restocking</p>
          </div>
          {canManage && (
            <button className="btn-primary" onClick={() => navigate("/pharmacy/new")}>+ Add Drug</button>
          )}
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
          {[
            { label: "Total Drugs",      value: drugs.length,        icon: "💊" },
            { label: "Low / Out of Stock", value: lowStockCount,     icon: "⚠️", warn: lowStockCount > 0 },
            { label: "Pending Prescriptions", value: pendingRxCount, icon: "📋", warn: pendingRxCount > 0 },
            { label: "Pending Orders",   value: pendingOrdersCount,  icon: "📦", warn: pendingOrdersCount > 0 },
          ].map(s => (
            <div key={s.label} className={`bg-white rounded-[10px] border shadow-[0_1px_3px_rgba(0,0,0,.06)] p-5 flex flex-col gap-1 ${s.warn ? "border-amber-200" : "border-slate-200"}`}>
              <div className={`w-9 h-9 rounded-[8px] flex items-center justify-center text-lg mb-1 ${s.warn ? "bg-amber-50" : "bg-[var(--blue-50)]"}`}>{s.icon}</div>
              <p className="text-[12px] font-medium text-slate-500">{s.label}</p>
              <p style={{ fontFamily: "var(--font-display)" }} className={`text-[22px] font-bold leading-none ${s.warn && s.value > 0 ? "text-amber-600" : "text-slate-900"}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-slate-200">
          {[
            { key: "inventory",     label: "Inventory",     count: drugs.length },
            { key: "prescriptions", label: "Prescriptions", count: pendingRxCount },
            { key: "orders",        label: "Purchase Orders", count: orders.length },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-[13.5px] font-semibold border-b-2 transition -mb-px cursor-pointer bg-transparent ${
                tab === t.key ? "border-[var(--blue-600)] text-[var(--blue-600)]" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.label}
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${tab === t.key ? "bg-[var(--blue-100)] text-[var(--blue-700)]" : "bg-slate-100 text-slate-500"}`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* ── Inventory tab ── */}
        {tab === "inventory" && (
          <>
            <div className="flex flex-wrap gap-3 mb-5">
              <input
                className="flex-1 min-w-[200px] max-w-[300px] px-3 py-2 border border-slate-200 rounded-lg text-[13.5px] bg-white outline-none placeholder-slate-400 focus:border-blue-400 transition"
                placeholder="Search drugs…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <div className="flex gap-2 flex-wrap">
                {[
                  { key: "all", label: "All" },
                  { key: "ok",  label: "In Stock" },
                  { key: "low", label: "Low Stock" },
                  { key: "out", label: "Out of Stock" },
                ].map(f => (
                  <button key={f.key} onClick={() => setStockFilter(f.key)}
                    className={`px-3 py-2 rounded-lg border text-[12.5px] font-semibold transition cursor-pointer ${stockFilter === f.key ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="py-16 text-center text-slate-400 text-[13.5px]">Loading drugs…</div>
            ) : filteredDrugs.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-[13.5px]">
                <p>No drugs found.</p>
                {canManage && <button className="btn-primary mt-3" onClick={() => navigate("/pharmacy/new")}>Add first drug</button>}
              </div>
            ) : (
              <div className="bg-white rounded-[10px] border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,.06)] overflow-hidden">
                <table className="w-full text-[13.5px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      {["Drug Name", "Generic Name", "Unit", "Stock", "Reorder Level", "Unit Price", "Selling Price", "Expiry", ""].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDrugs.map((drug, i) => {
                      const isExpired  = drug.expires_at && new Date(drug.expires_at) < new Date();
                      const expiringSoon = drug.expires_at && !isExpired && new Date(drug.expires_at) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                      return (
                        <tr key={drug.id} className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 transition ${i % 2 === 0 ? "" : "bg-slate-50/40"}`}>
                          <td className="px-4 py-3 font-semibold text-slate-800">{drug.name}</td>
                          <td className="px-4 py-3 text-slate-500">{drug.generic_name ?? "—"}</td>
                          <td className="px-4 py-3 text-slate-500">{drug.unit ?? "—"}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-800">{drug.stock_qty}</span>
                              <StockBadge qty={drug.stock_qty} reorder={drug.reorder_level} />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-500">{drug.reorder_level}</td>
                          <td className="px-4 py-3 text-slate-600">{formatNaira(drug.unit_price)}</td>
                          <td className="px-4 py-3 text-slate-600">{formatNaira(drug.selling_price)}</td>
                          <td className="px-4 py-3">
                            {drug.expires_at ? (
                              <span className={`text-[12px] font-medium ${isExpired ? "text-red-600" : expiringSoon ? "text-amber-600" : "text-slate-500"}`}>
                                {isExpired ? "⚠ Expired" : expiringSoon ? "⚠ " : ""}{new Date(drug.expires_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                              </span>
                            ) : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              {canManage && (
                                <>
                                  <button onClick={() => navigate(`/pharmacy/${drug.id}/edit`)}
                                    className="text-[12px] font-semibold text-[var(--blue-600)] hover:underline bg-transparent border-none cursor-pointer">
                                    Edit
                                  </button>
                                  <button onClick={() => setActiveDrug(drug)}
                                    className="text-[12px] font-semibold text-emerald-600 hover:underline bg-transparent border-none cursor-pointer">
                                    Restock
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── Prescriptions tab ── */}
        {tab === "prescriptions" && (
          <>
            {loading ? (
              <div className="py-16 text-center text-slate-400 text-[13.5px]">Loading prescriptions…</div>
            ) : prescriptions.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-[13.5px]">No pending prescriptions.</div>
            ) : (
              <div className="bg-white rounded-[10px] border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,.06)] overflow-hidden">
                <table className="w-full text-[13.5px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      {["Patient", "Drug", "Dosage", "Frequency", "Duration", "Stock", ""].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {prescriptions.map((rx, i) => (
                      <tr key={rx.id} className={`border-b border-slate-100 last:border-0 ${i % 2 === 0 ? "" : "bg-slate-50/40"}`}>
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {rx.visit?.patient?.first_name} {rx.visit?.patient?.last_name}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{rx.drug?.name ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-500">{rx.dosage ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-500">{rx.frequency ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-500">{rx.duration_days ? `${rx.duration_days} days` : "—"}</td>
                        <td className="px-4 py-3">
                          <StockBadge qty={rx.drug?.stock_qty ?? 0} reorder={0} />
                        </td>
                        <td className="px-4 py-3">
                          {canManage && (
                            <button
                              onClick={() => setActiveRx(rx)}
                              disabled={(rx.drug?.stock_qty ?? 0) === 0}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold bg-[var(--blue-600)] text-white border-none cursor-pointer hover:bg-[var(--blue-500)] transition disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Dispense
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── Purchase orders tab ── */}
        {tab === "orders" && (
          <>
            {loading ? (
              <div className="py-16 text-center text-slate-400 text-[13.5px]">Loading orders…</div>
            ) : orders.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-[13.5px]">No purchase orders yet.</div>
            ) : (
              <div className="bg-white rounded-[10px] border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,.06)] overflow-hidden">
                <table className="w-full text-[13.5px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      {["Drug", "Supplier", "Qty", "Unit Cost", "Total Cost", "Status", "Ordered", ""].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order, i) => (
                      <tr key={order.id} className={`border-b border-slate-100 last:border-0 ${i % 2 === 0 ? "" : "bg-slate-50/40"}`}>
                        <td className="px-4 py-3 font-semibold text-slate-800">{order.drug?.name ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-500">{order.supplier_name ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-700">{order.quantity}</td>
                        <td className="px-4 py-3 text-slate-600">{formatNaira(order.unit_cost)}</td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{formatNaira(order.total_cost)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold ${
                            order.status === "received" ? "bg-emerald-100 text-emerald-700" :
                            order.status === "pending"  ? "bg-amber-100 text-amber-700" :
                            "bg-slate-100 text-slate-500"
                          }`}>
                            {order.status === "received" ? "✓ " : ""}{order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-[12px]">
                          {order.ordered_at ? new Date(order.ordered_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" }) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {canManage && order.status === "pending" && (
                            <button
                              onClick={() => setActiveOrder(order)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold bg-emerald-600 text-white border-none cursor-pointer hover:bg-emerald-500 transition"
                            >
                              Receive
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {activeDrug  && <PurchaseOrderModal drug={activeDrug}   onClose={() => setActiveDrug(null)}  onSaved={fetchAll} />}
      {activeRx    && <DispenseModal      prescription={activeRx} onClose={() => setActiveRx(null)} onDispensed={fetchAll} />}
      {activeOrder && <ReceiveStockModal  order={activeOrder} onClose={() => setActiveOrder(null)} onReceived={fetchAll} />}
    </>
  );
}
