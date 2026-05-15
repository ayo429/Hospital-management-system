import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

// ── Helpers ───────────────────────────────────────────────────────────────────

const WARD_TYPES = ["general", "maternity", "paediatric", "icu", "surgical", "emergency", "other"];

const WARD_TYPE_LABELS = {
  general:    "General",
  maternity:  "Maternity",
  paediatric: "Paediatric",
  icu:        "ICU",
  surgical:   "Surgical",
  emergency:  "Emergency",
  other:      "Other",
};

const WARD_ICONS = {
  general:    "🏥",
  maternity:  "🤱",
  paediatric: "🧒",
  icu:        "❤️‍🩹",
  surgical:   "🔬",
  emergency:  "🚨",
  other:      "🛏️",
};

// ── Add / Edit Ward Modal ─────────────────────────────────────────────────────

function WardModal({ ward = null, onClose, onSaved }) {
  const { orgId } = useAuth();
  const editing = !!ward;

  const [name,     setName]     = useState(ward?.name     ?? "");
  const [type,     setType]     = useState(ward?.type     ?? "general");
  const [capacity, setCapacity] = useState(ward?.capacity ?? "");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  async function handleSave() {
    if (!name.trim())     { setError("Ward name is required."); return; }
    if (!capacity || isNaN(Number(capacity)) || Number(capacity) < 1) {
      setError("Enter a valid bed capacity."); return;
    }
    setLoading(true); setError(null);

    const payload = { name: name.trim(), type, capacity: Number(capacity), org_id: orgId };

    const { error: err } = editing
      ? await supabase.from("wards").update(payload).eq("id", ward.id)
      : await supabase.from("wards").insert(payload);

    if (err) { setError(err.message); setLoading(false); }
    else     { onSaved?.(); onClose(); }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[10px] w-full max-w-115 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
          <h2 style={{ fontFamily: "var(--font-display)" }} className="text-[15px] font-semibold text-slate-900">
            {editing ? "Edit ward" : "Add ward"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none bg-transparent border-none cursor-pointer">×</button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-700">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Name */}
            <div className="flex flex-col gap-1.5 col-span-2">
              <label className="text-[12.5px] font-semibold text-slate-500">Ward name</label>
              <input
                className="px-3 py-2.25 border border-slate-200 rounded-lg text-[13.5px] text-slate-900 bg-white outline-none placeholder-slate-400 focus:border-blue-400 focus:ring-[3px] focus:ring-blue-500/15 transition"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Female Medical Ward"
              />
            </div>

            {/* Type */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-semibold text-slate-500">Ward type</label>
              <select
                className="px-3 py-2.25 border border-slate-200 rounded-lg text-[13.5px] text-slate-900 bg-white outline-none focus:border-blue-400 focus:ring-[3px] focus:ring-blue-500/15 transition"
                value={type}
                onChange={e => setType(e.target.value)}
              >
                {WARD_TYPES.map(t => (
                  <option key={t} value={t}>{WARD_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>

            {/* Capacity */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-semibold text-slate-500">Bed capacity</label>
              <input
                type="number"
                min={1}
                className="px-3 py-2.25 border border-slate-200 rounded-lg text-[13.5px] text-slate-900 bg-white outline-none placeholder-slate-400 focus:border-blue-400 focus:ring-[3px] focus:ring-blue-500/15 transition"
                value={capacity}
                onChange={e => setCapacity(e.target.value)}
                placeholder="e.g. 20"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={loading} className="btn-primary">
              {loading ? "Saving…" : editing ? "Save changes" : "Add ward"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Delete confirm ────────────────────────────────────────────────────────────

function DeleteModal({ ward, onClose, onDeleted }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  async function handleDelete() {
    setLoading(true);
    const { error: err } = await supabase.from("wards").delete().eq("id", ward.id);
    if (err) { setError(err.message); setLoading(false); }
    else     { onDeleted?.(); onClose(); }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[10px] w-full max-w-100 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
          <h2 style={{ fontFamily: "var(--font-display)" }} className="text-[15px] font-semibold text-slate-900">Delete ward</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none bg-transparent border-none cursor-pointer">×</button>
        </div>
        <div className="px-6 py-5">
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-700">{error}</div>
          )}
          <p className="text-[13px] text-slate-500 mb-6">
            Are you sure you want to delete <span className="font-semibold text-slate-700">{ward.name}</span>?
            This will also remove all beds in this ward. This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4.5 py-2.25 rounded-lg text-[13.5px] font-semibold bg-red-500 hover:opacity-90 text-white transition disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed border-none"
            >
              {loading ? "Deleting…" : "Delete ward"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Ward card ─────────────────────────────────────────────────────────────────

function WardCard({ ward, onEdit, onDelete, onClick }) {
  const occupied    = ward.beds_occupied    ?? 0;
  const available   = ward.beds_available   ?? 0;
  const reserved    = ward.beds_reserved    ?? 0;
  const maintenance = ward.beds_maintenance ?? 0;
  const total       = ward.capacity         ?? (occupied + available + reserved + maintenance);
  const pct         = total > 0 ? Math.round((occupied / total) * 100) : 0;

  const barColor =
    pct >= 90 ? "bg-red-500" :
    pct >= 70 ? "bg-amber-400" :
    "bg-emerald-500";

  return (
    <div
      className="bg-white rounded-[10px] border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,.06),0_4px_12px_rgba(0,0,0,.04)] p-5 flex flex-col gap-4 hover:-translate-y-px hover:shadow-[0_4px_16px_rgba(0,0,0,.08)] transition-all cursor-pointer group"
      onClick={onClick}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[9px] flex items-center justify-center text-xl shrink-0" style={{ background: "var(--blue-50)" }}>
            {WARD_ICONS[ward.type] ?? "🛏️"}
          </div>
          <div>
            <p style={{ fontFamily: "var(--font-display)" }} className="text-[14px] font-semibold text-slate-900 leading-tight">{ward.name}</p>
            <p className="text-[12px] text-slate-400 mt-0.5">{WARD_TYPE_LABELS[ward.type] ?? ward.type}</p>
          </div>
        </div>

        {/* Edit / delete — show on hover */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer bg-transparent border-none text-[13px]"
            title="Edit"
          >✏️</button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer bg-transparent border-none text-[13px]"
            title="Delete"
          >🗑️</button>
        </div>
      </div>

      {/* Occupancy bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11.5px] font-semibold text-slate-400 uppercase tracking-wide">Occupancy</span>
          <span className="text-[12.5px] font-semibold text-slate-700">{occupied}/{total} beds</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[11px] text-slate-400 mt-1">{pct}% occupied</p>
      </div>

      {/* Bed status pills */}
      <div className="flex flex-wrap gap-2">
        <Pill color="emerald" label="Available" count={available} />
        <Pill color="red"     label="Occupied"  count={occupied}  />
        <Pill color="blue"    label="Reserved"  count={reserved}  />
        <Pill color="amber"   label="Maint."    count={maintenance} />
      </div>

      {/* View bed map link */}
      <p className="text-[12px] font-semibold text-blue-600 group-hover:underline mt-auto">
        View bed map →
      </p>
    </div>
  );
}

function Pill({ color, label, count }) {
  const styles = {
    emerald: "bg-emerald-50 text-emerald-700",
    red:     "bg-red-50 text-red-600",
    blue:    "bg-blue-50 text-blue-700",
    amber:   "bg-amber-50 text-amber-700",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11.5px] font-semibold ${styles[color]}`}>
      {count} {label}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Wards() {
  const { orgId, isOwner, isAdmin } = useAuth();
  const navigate = useNavigate();
  const canManage = isOwner || isAdmin;

  const [wards,       setWards]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [showAdd,     setShowAdd]     = useState(false);
  const [editWard,    setEditWard]    = useState(null);
  const [deleteWard,  setDeleteWard]  = useState(null);

  async function fetchWards() {
    setLoading(true);
    // Fetch wards and join bed counts by status
    const { data: wardsData, error } = await supabase
      .from("wards")
      .select("*, beds(id, status)")
      .order("name");

    if (!error) {
      const enriched = (wardsData ?? []).map(w => {
        const beds = w.beds ?? [];
        return {
          ...w,
          beds_available:   beds.filter(b => b.status === "available").length,
          beds_occupied:    beds.filter(b => b.status === "occupied").length,
          beds_reserved:    beds.filter(b => b.status === "reserved").length,
          beds_maintenance: beds.filter(b => b.status === "maintenance").length,
        };
      });
      setWards(enriched);
    }
    setLoading(false);
  }

  useEffect(() => { if (orgId) fetchWards(); }, [orgId]);

  const filtered = wards.filter(w =>
    !search || w.name.toLowerCase().includes(search.toLowerCase())
  );

  // ── Summary totals ──
  const totalBeds      = wards.reduce((s, w) => s + (w.capacity ?? 0), 0);
  const totalOccupied  = wards.reduce((s, w) => s + (w.beds_occupied ?? 0), 0);
  const totalAvailable = wards.reduce((s, w) => s + (w.beds_available ?? 0), 0);

  return (
    <>
      <style>{`
        .btn-primary  { display:inline-flex;align-items:center;gap:6px;padding:9px 18px;border-radius:8px;font-size:13.5px;font-weight:600;cursor:pointer;border:none;background:var(--blue-600);color:#fff;transition:background .15s,opacity .15s;white-space:nowrap; }
        .btn-primary:hover { background:var(--blue-500); }
        .btn-primary:disabled { opacity:.45;cursor:not-allowed; }
        .btn-secondary { display:inline-flex;align-items:center;gap:6px;padding:9px 18px;border-radius:8px;font-size:13.5px;font-weight:600;cursor:pointer;background:#fff;color:var(--text-primary);border:1px solid var(--border);transition:background .15s;white-space:nowrap; }
        .btn-secondary:hover { background:var(--bg-page); }
      `}</style>

      <div className="p-8">

        {/* ── Page header ── */}
        <div className="flex items-start justify-between mb-7">
          <div>
            <h1 style={{ fontFamily: "var(--font-display)" }} className="text-[22px] font-bold text-slate-900 tracking-tight">
              Wards
            </h1>
            <p className="text-[14px] text-slate-500 mt-1">Manage wards and monitor bed occupancy</p>
          </div>
          {canManage && (
            <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add ward</button>
          )}
        </div>

        {/* ── Summary strip ── */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4 mb-7">
          {[
            { label: "Total wards",     value: wards.length,    icon: "🏥" },
            { label: "Total beds",      value: totalBeds,        icon: "🛏️" },
            { label: "Occupied",        value: totalOccupied,    icon: "🔴" },
            { label: "Available",       value: totalAvailable,   icon: "🟢" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-[10px] border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,.06),0_4px_12px_rgba(0,0,0,.04)] p-5 flex flex-col gap-2 hover:-translate-y-px hover:shadow-[0_4px_16px_rgba(0,0,0,.08)] transition-all">
              <div className="w-10 h-10 rounded-[9px] flex items-center justify-center text-lg mb-1" style={{ background: "var(--blue-50)" }}>{s.icon}</div>
              <p className="text-[12.5px] font-medium text-slate-500">{s.label}</p>
              <p style={{ fontFamily: "var(--font-display)" }} className="text-[26px] font-bold text-slate-900 leading-none tracking-tight">{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── Search ── */}
        <div className="flex gap-3 mb-5">
          <input
            className="flex-1 min-w-50 max-w-75 px-3 py-2.25 border border-slate-200 rounded-lg text-[13.5px] text-slate-900 bg-white outline-none placeholder-slate-400 focus:border-blue-400 focus:ring-[3px] focus:ring-blue-500/15 transition"
            placeholder="Search wards…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* ── Ward grid ── */}
        {loading ? (
          <div className="py-16 text-center text-[13.5px] text-slate-400">Loading wards…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-[13.5px] text-slate-400">
            <p>No wards found.</p>
            {canManage && (
              <button className="btn-primary mt-3" onClick={() => setShowAdd(true)}>Add your first ward</button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
            {filtered.map(ward => (
              <WardCard
                key={ward.id}
                ward={ward}
                onEdit={() => setEditWard(ward)}
                onDelete={() => setDeleteWard(ward)}
                onClick={() => navigate(`/wards/${ward.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showAdd && (
        <WardModal onClose={() => setShowAdd(false)} onSaved={fetchWards} />
      )}
      {editWard && (
        <WardModal ward={editWard} onClose={() => setEditWard(null)} onSaved={fetchWards} />
      )}
      {deleteWard && (
        <DeleteModal ward={deleteWard} onClose={() => setDeleteWard(null)} onDeleted={fetchWards} />
      )}
    </>
  );
}