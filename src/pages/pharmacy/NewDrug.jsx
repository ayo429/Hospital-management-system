// src/pages/pharmacy/NewDrug.jsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

const UNITS = ["tablet", "capsule", "syrup (ml)", "injection (ml)", "cream (g)", "drops", "sachet", "vial", "patch", "inhaler", "suppository", "other"];
const CATEGORIES = ["analgesic", "antibiotic", "antifungal", "antiviral", "antihypertensive", "antidiabetic", "antiparasitic", "vitamin/supplement", "vaccine", "other"];

export default function NewDrug() {
  const { orgId }  = useAuth();
  const navigate   = useNavigate();
  const { id }     = useParams(); // present when editing
  const isEditing  = !!id;

  const [form, setForm] = useState({
    name:          "",
    generic_name:  "",
    category:      "",
    unit:          "",
    unit_price:    "",
    selling_price: "",
    stock_qty:     "",
    reorder_level: "10",
    expires_at:    "",
    description:   "",
  });

  const [saving,  setSaving]  = useState(false);
  const [loading, setLoading] = useState(isEditing);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!isEditing || !orgId) return;
    (async () => {
      const { data } = await supabase.from("drugs").select("*").eq("id", id).eq("org_id", orgId).single();
      if (data) {
        setForm({
          name:          data.name          ?? "",
          generic_name:  data.generic_name  ?? "",
          category:      data.category      ?? "",
          unit:          data.unit          ?? "",
          unit_price:    data.unit_price    ?? "",
          selling_price: data.selling_price ?? "",
          stock_qty:     data.stock_qty     ?? "",
          reorder_level: data.reorder_level ?? "10",
          expires_at:    data.expires_at    ?? "",
          description:   data.description   ?? "",
        });
      }
      setLoading(false);
    })();
  }, [id, orgId]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim())           { setError("Drug name is required."); return; }
    if (!form.unit_price)            { setError("Unit price is required."); return; }
    if (!form.selling_price)         { setError("Selling price is required."); return; }

    setSaving(true);
    try {
      const payload = {
        org_id:        orgId,
        name:          form.name.trim(),
        generic_name:  form.generic_name.trim() || null,
        category:      form.category || null,
        unit:          form.unit || null,
        unit_price:    Number(form.unit_price),
        selling_price: Number(form.selling_price),
        stock_qty:     Number(form.stock_qty || 0),
        reorder_level: Number(form.reorder_level || 10),
        expires_at:    form.expires_at || null,
        description:   form.description.trim() || null,
      };

      const { error: err } = isEditing
        ? await supabase.from("drugs").update(payload).eq("id", id)
        : await supabase.from("drugs").insert(payload);

      if (err) throw err;
      navigate("/pharmacy");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-8 text-center text-slate-400">Loading…</div>;

  return (
    <div>
      <style>{`
        .btn-primary   { display:inline-flex;align-items:center;gap:6px;padding:9px 18px;border-radius:8px;font-size:13.5px;font-weight:600;cursor:pointer;border:none;background:var(--blue-600);color:#fff;transition:background .15s; }
        .btn-primary:hover { background:var(--blue-500); }
        .btn-primary:disabled { opacity:.45;cursor:not-allowed; }
        .btn-secondary { display:inline-flex;align-items:center;gap:6px;padding:9px 18px;border-radius:8px;font-size:13.5px;font-weight:600;cursor:pointer;background:#fff;color:var(--text-primary);border:1px solid var(--border);transition:background .15s; }
        .btn-secondary:hover { background:var(--bg-page); }
        .inp { width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-size:13.5px;color:var(--text-primary);background:#fff;outline:none;transition:border-color .15s,box-shadow .15s; }
        .inp:focus { border-color:var(--blue-400);box-shadow:0 0 0 3px rgba(59,130,246,.12); }
        .inp::placeholder { color:var(--text-muted); }
        .lbl { display:block;font-size:12.5px;font-weight:600;color:var(--text-secondary);margin-bottom:5px; }
      `}</style>

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-header__title">{isEditing ? "Edit Drug" : "Add Drug"}</h1>
          <p className="page-header__subtitle">{isEditing ? "Update drug details and pricing" : "Add a new drug to your pharmacy inventory"}</p>
        </div>
        <button className="btn btn--secondary" onClick={() => navigate("/pharmacy")}>← Back</button>
      </div>

      {error && <div className="form-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-5">

          {/* Basic info */}
          <div className="form-card">
            <div className="form-card__title">Drug Information</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="lbl">Drug name *</label>
                <input className="inp" name="name" value={form.name} onChange={handleChange} placeholder="e.g. Amoxicillin 500mg" />
              </div>
              <div>
                <label className="lbl">Generic name</label>
                <input className="inp" name="generic_name" value={form.generic_name} onChange={handleChange} placeholder="e.g. Amoxicillin" />
              </div>
              <div>
                <label className="lbl">Category</label>
                <select className="inp" name="category" value={form.category} onChange={handleChange}>
                  <option value="">Select category</option>
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="lbl">Unit / Form</label>
                <select className="inp" name="unit" value={form.unit} onChange={handleChange}>
                  <option value="">Select unit</option>
                  {UNITS.map(u => (
                    <option key={u} value={u}>{u.charAt(0).toUpperCase() + u.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="lbl">Description <span className="font-normal text-slate-400">(optional)</span></label>
                <textarea className="inp" name="description" value={form.description} onChange={handleChange} rows={2} placeholder="Any notes about this drug…" style={{ resize: "vertical" }} />
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="form-card">
            <div className="form-card__title">Pricing</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="lbl">Unit / Purchase price (₦) *</label>
                <input type="number" min={0} className="inp" name="unit_price" value={form.unit_price} onChange={handleChange} placeholder="0.00" />
                <p className="text-[11.5px] text-slate-400 mt-1">What you pay per unit when restocking</p>
              </div>
              <div>
                <label className="lbl">Selling price (₦) *</label>
                <input type="number" min={0} className="inp" name="selling_price" value={form.selling_price} onChange={handleChange} placeholder="0.00" />
                <p className="text-[11.5px] text-slate-400 mt-1">What you charge patients per unit</p>
              </div>
              {form.unit_price && form.selling_price && Number(form.selling_price) > 0 && (
                <div className="sm:col-span-2">
                  <div className="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[13px] text-emerald-700">
                    Margin: <strong>₦{(Number(form.selling_price) - Number(form.unit_price)).toLocaleString("en-NG", { minimumFractionDigits: 2 })}</strong> per unit
                    ({Math.round(((Number(form.selling_price) - Number(form.unit_price)) / Number(form.selling_price)) * 100)}%)
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Stock */}
          <div className="form-card">
            <div className="form-card__title">Stock Management</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="lbl">{isEditing ? "Current stock" : "Opening stock"}</label>
                <input type="number" min={0} className="inp" name="stock_qty" value={form.stock_qty} onChange={handleChange} placeholder="0" />
              </div>
              <div>
                <label className="lbl">Reorder level</label>
                <input type="number" min={0} className="inp" name="reorder_level" value={form.reorder_level} onChange={handleChange} placeholder="10" />
                <p className="text-[11.5px] text-slate-400 mt-1">Alert when stock falls below this</p>
              </div>
              <div>
                <label className="lbl">Expiry date</label>
                <input type="date" className="inp" name="expires_at" value={form.expires_at} onChange={handleChange} />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="form-actions">
            <button type="button" className="btn btn--secondary" onClick={() => navigate("/pharmacy")}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : isEditing ? "Save Changes" : "Add Drug"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
