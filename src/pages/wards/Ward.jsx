// src/pages/wards/Wards.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

const WARD_TYPES = ["general", "maternity", "paediatric", "icu", "surgical", "emergency", "other"];

const WARD_TYPE_LABELS = {
  general: "General", maternity: "Maternity", paediatric: "Paediatric",
  icu: "ICU", surgical: "Surgical", emergency: "Emergency", other: "Other",
};

const WARD_ICONS = {
  general: "🏥", maternity: "🤱", paediatric: "🧒",
  icu: "❤️‍🩹", surgical: "🔬", emergency: "🚨", other: "🛏️",
};

// ── Modals ────────────────────────────────────────────────────────────────────

function WardModal({ ward = null, onClose, onSaved }) {
  const { orgId } = useAuth();
  const editing = !!ward;

  const [name,     setName]     = useState(ward?.name     ?? "");
  const [type,     setType]     = useState(ward?.type     ?? "general");
  const [capacity, setCapacity] = useState(ward?.capacity ?? "");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  async function handleSave() {
    if (!name.trim()) { setError("Ward name is required."); return; }
    if (!capacity || isNaN(Number(capacity)) || Number(capacity) < 1) { setError("Enter a valid bed capacity."); return; }
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
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", borderRadius: 10, width: "100%", maxWidth: 460, boxShadow: "0 8px 32px rgba(0,0,0,.12)", maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid #e2e8f0" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, color: "#0f172a", margin: 0 }}>
            {editing ? "Edit ward" : "Add ward"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#94a3b8", lineHeight: 1 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: 24 }}>
          {error && (
            <div style={{ marginBottom: 16, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 13, color: "#b91c1c" }}>
              {error}
            </div>
          )}

          {/* Ward name */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#64748b", marginBottom: 6 }}>Ward name</label>
            <input
              style={{ width: "100%", padding: "9px 13px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13.5, color: "#0f172a", background: "#fff", outline: "none", boxSizing: "border-box" }}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Female Medical Ward"
              onFocus={e => e.target.style.borderColor = "#3b82f6"}
              onBlur={e => e.target.style.borderColor = "#e2e8f0"}
            />
          </div>

          {/* Type + Capacity */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#64748b", marginBottom: 6 }}>Ward type</label>
              <select
                style={{ width: "100%", padding: "9px 13px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13.5, color: "#0f172a", background: "#fff", outline: "none" }}
                value={type}
                onChange={e => setType(e.target.value)}
              >
                {WARD_TYPES.map(t => <option key={t} value={t}>{WARD_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#64748b", marginBottom: 6 }}>Bed capacity</label>
              <input
                type="number" min={1}
                style={{ width: "100%", padding: "9px 13px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13.5, color: "#0f172a", background: "#fff", outline: "none", boxSizing: "border-box" }}
                value={capacity}
                onChange={e => setCapacity(e.target.value)}
                placeholder="e.g. 20"
                onFocus={e => e.target.style.borderColor = "#3b82f6"}
                onBlur={e => e.target.style.borderColor = "#e2e8f0"}
              />
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: "pointer", background: "#fff", color: "#0f172a", border: "1px solid #e2e8f0" }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={loading}
              style={{ padding: "9px 18px", borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: "pointer", background: "var(--blue-600)", color: "#fff", border: "none", opacity: loading ? 0.5 : 1 }}>
              {loading ? "Saving…" : editing ? "Save changes" : "Add ward"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", borderRadius: 10, width: "100%", maxWidth: 400, boxShadow: "0 8px 32px rgba(0,0,0,.12)" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid #e2e8f0" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, color: "#0f172a", margin: 0 }}>Delete ward</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#94a3b8", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 24 }}>
          {error && <div style={{ marginBottom: 16, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 13, color: "#b91c1c" }}>{error}</div>}
          <p style={{ fontSize: 13, color: "#64748b", marginBottom: 24, lineHeight: 1.6 }}>
            Are you sure you want to delete <strong style={{ color: "#0f172a" }}>{ward.name}</strong>? This will also remove all beds in this ward and cannot be undone.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: "pointer", background: "#fff", color: "#0f172a", border: "1px solid #e2e8f0" }}>
              Cancel
            </button>
            <button onClick={handleDelete} disabled={loading}
              style={{ padding: "9px 18px", borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: "pointer", background: "#ef4444", color: "#fff", border: "none", opacity: loading ? 0.5 : 1 }}>
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

  const barColor = pct >= 90 ? "#ef4444" : pct >= 70 ? "#f59e0b" : "#10b981";

  const pill = (color, label, count) => (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 10px", borderRadius: 99,
      fontSize: 11.5, fontWeight: 600,
      background: color.bg, color: color.text,
    }}>
      {count} {label}
    </span>
  );

  return (
    <div
      onClick={onClick}
      style={{
        background: "#fff", borderRadius: 10,
        border: "1px solid #e2e8f0",
        boxShadow: "0 1px 3px rgba(0,0,0,.06),0 4px 12px rgba(0,0,0,.04)",
        padding: 20, cursor: "pointer",
        transition: "transform .15s, box-shadow .15s",
        display: "flex", flexDirection: "column", gap: 16,
        position: "relative",
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,.08)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,.06),0 4px 12px rgba(0,0,0,.04)"; }}
    >
      {/* Edit / Delete buttons */}
      <div
        style={{ position: "absolute", top: 12, right: 12, display: "flex", gap: 4 }}
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onEdit}
          style={{ width: 28, height: 28, borderRadius: 7, background: "none", border: "none", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}
          onMouseEnter={e => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.color = "#475569"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#94a3b8"; }}
          title="Edit"
        >✏️</button>
        <button onClick={onDelete}
          style={{ width: 28, height: 28, borderRadius: 7, background: "none", border: "none", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}
          onMouseEnter={e => { e.currentTarget.style.background = "#fef2f2"; e.currentTarget.style.color = "#ef4444"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#94a3b8"; }}
          title="Delete"
        >🗑️</button>
      </div>

      {/* Top row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, paddingRight: 60 }}>
        <div style={{ width: 40, height: 40, borderRadius: 9, background: "var(--blue-50)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
          {WARD_ICONS[ward.type] ?? "🛏️"}
        </div>
        <div>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, color: "#0f172a", lineHeight: 1.3 }}>{ward.name}</p>
          <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{WARD_TYPE_LABELS[ward.type] ?? ward.type}</p>
        </div>
      </div>

      {/* Occupancy bar */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Occupancy</span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "#475569" }}>{occupied}/{total} beds</span>
        </div>
        <div style={{ width: "100%", height: 6, borderRadius: 99, background: "#f1f5f9", overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 99, background: barColor, width: `${pct}%`, transition: "width .3s" }} />
        </div>
        <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{pct}% occupied</p>
      </div>

      {/* Bed status pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {pill({ bg: "#ecfdf5", text: "#065f46" }, "Available",   available)}
        {pill({ bg: "#fef2f2", text: "#991b1b" }, "Occupied",    occupied)}
        {pill({ bg: "#eff6ff", text: "#1d4ed8" }, "Reserved",    reserved)}
        {pill({ bg: "#fffbeb", text: "#b45309" }, "Maint.",       maintenance)}
      </div>

      {/* Link */}
      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--blue-600)", marginTop: "auto" }}>
        View bed map →
      </p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Wards() {
  const { orgId, isOwner, isAdmin } = useAuth();
  const navigate    = useNavigate();
  const canManage   = isOwner || isAdmin;

  const [wards,       setWards]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [showAdd,     setShowAdd]     = useState(false);
  const [editWard,    setEditWard]    = useState(null);
  const [deleteWard,  setDeleteWard]  = useState(null);

  async function fetchWards() {
    setLoading(true);
    const { data, error } = await supabase
      .from("wards")
      .select("*, beds(id, status)")
      .order("name");

    if (!error) {
      setWards((data ?? []).map(w => {
        const beds = w.beds ?? [];
        return {
          ...w,
          beds_available:   beds.filter(b => b.status === "available").length,
          beds_occupied:    beds.filter(b => b.status === "occupied").length,
          beds_reserved:    beds.filter(b => b.status === "reserved").length,
          beds_maintenance: beds.filter(b => b.status === "maintenance").length,
        };
      }));
    }
    setLoading(false);
  }

  useEffect(() => { if (orgId) fetchWards(); }, [orgId]);

  const filtered = wards.filter(w => !search || w.name.toLowerCase().includes(search.toLowerCase()));

  const totalBeds      = wards.reduce((s, w) => s + (w.capacity ?? 0), 0);
  const totalOccupied  = wards.reduce((s, w) => s + (w.beds_occupied ?? 0), 0);
  const totalAvailable = wards.reduce((s, w) => s + (w.beds_available ?? 0), 0);

  return (
    <>
      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Wards</h1>
          <p className="page-header__subtitle">Manage wards and monitor bed occupancy</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowAdd(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: "pointer", background: "var(--blue-600)", color: "#fff", border: "none" }}
          >
            + Add ward
          </button>
        )}
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 32 }}>
        {[
          { label: "Total wards",   value: wards.length,    icon: "🏥" },
          { label: "Total beds",    value: totalBeds,        icon: "🛏️" },
          { label: "Occupied",      value: totalOccupied,    icon: "🔴" },
          { label: "Available",     value: totalAvailable,   icon: "🟢" },
        ].map(s => (
          <div key={s.label} style={{
            background: "#fff", borderRadius: 10,
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0,0,0,.06),0 4px 12px rgba(0,0,0,.04)",
            padding: 20, display: "flex", flexDirection: "column", gap: 6,
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 9, background: "var(--blue-50)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, marginBottom: 4 }}>
              {s.icon}
            </div>
            <p style={{ fontSize: 12.5, fontWeight: 500, color: "#64748b" }}>{s.label}</p>
            <p style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, color: "#0f172a", lineHeight: 1, letterSpacing: "-0.5px" }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Search ── */}
      <div style={{ marginBottom: 24 }}>
        <input
          style={{ width: "100%", maxWidth: 300, padding: "9px 14px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13.5, color: "#0f172a", background: "#fff", outline: "none" }}
          placeholder="Search wards…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onFocus={e => e.target.style.borderColor = "#3b82f6"}
          onBlur={e => e.target.style.borderColor = "#e2e8f0"}
        />
      </div>

      {/* ── Ward grid ── */}
      {loading ? (
        <div className="empty-state">Loading wards…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p>No wards found.</p>
          {canManage && (
            <button onClick={() => setShowAdd(true)}
              style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: "pointer", background: "var(--blue-600)", color: "#fff", border: "none" }}>
              Add your first ward
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
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

      {/* ── Modals ── */}
      {showAdd    && <WardModal onClose={() => setShowAdd(false)}    onSaved={fetchWards} />}
      {editWard   && <WardModal ward={editWard} onClose={() => setEditWard(null)}   onSaved={fetchWards} />}
      {deleteWard && <DeleteModal ward={deleteWard} onClose={() => setDeleteWard(null)} onDeleted={fetchWards} />}
    </>
  );
}