// src/pages/wards/BedMap.jsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

const STATUSES = ["available", "occupied", "reserved", "maintenance"];

const STATUS_META = {
  available:   { label: "Available",   bg: "#ecfdf5", border: "#a7f3d0", text: "#065f46", dot: "#10b981" },
  occupied:    { label: "Occupied",    bg: "#fef2f2", border: "#fecaca", text: "#991b1b", dot: "#ef4444" },
  reserved:    { label: "Reserved",    bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8", dot: "#3b82f6" },
  maintenance: { label: "Maintenance", bg: "#fffbeb", border: "#fde68a", text: "#b45309", dot: "#f59e0b" },
};

// ── Shared modal shell ────────────────────────────────────────────────────────

function ModalShell({ title, onClose, children }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", borderRadius: 10, width: "100%", maxWidth: 440, boxShadow: "0 8px 32px rgba(0,0,0,.12)", maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid #e2e8f0" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, color: "#0f172a", margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#94a3b8", lineHeight: 1, padding: 0 }}>×</button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}

function ErrorBanner({ msg }) {
  return (
    <div style={{ marginBottom: 16, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 13, color: "#b91c1c" }}>
      {msg}
    </div>
  );
}

function ModalInput({ label, optional, ...props }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#64748b", marginBottom: 6 }}>
        {label} {optional && <span style={{ fontWeight: 400, color: "#94a3b8" }}>(optional)</span>}
      </label>
      <input
        {...props}
        style={{
          width: "100%", padding: "9px 13px",
          border: "1px solid #e2e8f0", borderRadius: 8,
          fontSize: 13.5, color: "#0f172a", background: "#fff",
          outline: "none", boxSizing: "border-box",
        }}
        onFocus={e => { e.target.style.borderColor = "#3b82f6"; e.target.style.boxShadow = "0 0 0 3px rgba(59,130,246,.12)"; }}
        onBlur={e => { e.target.style.borderColor = "#e2e8f0"; e.target.style.boxShadow = "none"; }}
      />
    </div>
  );
}

// ── Add Bed Modal ─────────────────────────────────────────────────────────────

function AddBedModal({ wardId, onClose, onSaved }) {
  const [label,   setLabel]   = useState("");
  const [notes,   setNotes]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  async function handleSave() {
    if (!label.trim()) { setError("Bed label is required."); return; }
    setLoading(true); setError(null);
    const { error: err } = await supabase.from("beds").insert({
      ward_id:    wardId,
      bed_number: label.trim(),
      label:      label.trim(),
      notes:      notes.trim() || null,
      status:     "available",
    });
    if (err) { setError(err.message); setLoading(false); }
    else     { onSaved?.(); onClose(); }
  }

  return (
    <ModalShell title="Add bed" onClose={onClose}>
      {error && <ErrorBanner msg={error} />}
      <ModalInput label="Bed label" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Bed 1A, Bed 12, Cot 3" />
      <ModalInput label="Notes" optional value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Near window, oxygen point" />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
        <button onClick={onClose}
          style={{ padding: "9px 18px", borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: "pointer", background: "#fff", color: "#0f172a", border: "1px solid #e2e8f0" }}>
          Cancel
        </button>
        <button onClick={handleSave} disabled={loading}
          style={{ padding: "9px 18px", borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: "pointer", background: "var(--blue-600)", color: "#fff", border: "none", opacity: loading ? 0.5 : 1 }}>
          {loading ? "Adding…" : "Add bed"}
        </button>
      </div>
    </ModalShell>
  );
}

// ── Bed Detail Modal ──────────────────────────────────────────────────────────

function BedModal({ bed, onClose, onSaved, onDeleted }) {
  const [status,  setStatus]  = useState(bed.status ?? "available");
  const [notes,   setNotes]   = useState(bed.notes  ?? "");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [confirm, setConfirm] = useState(false);

  const patientName = bed.visit?.patient
    ? `${bed.visit.patient.first_name ?? ""} ${bed.visit.patient.last_name ?? ""}`.trim()
    : null;

  async function handleSave() {
    setLoading(true); setError(null);
    const { error: err } = await supabase.from("beds")
      .update({ status, notes: notes.trim() || null }).eq("id", bed.id);
    if (err) { setError(err.message); setLoading(false); }
    else     { onSaved?.(); onClose(); }
  }

  async function handleDelete() {
    setLoading(true);
    const { error: err } = await supabase.from("beds").delete().eq("id", bed.id);
    if (err) { setError(err.message); setLoading(false); }
    else     { onDeleted?.(); onClose(); }
  }

  return (
    <ModalShell title={`Bed ${bed.label ?? bed.bed_number}`} onClose={onClose}>
      {error && <ErrorBanner msg={error} />}

      {/* Patient banner */}
      {patientName && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", marginBottom: 20 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#b91c1c", flexShrink: 0 }}>
            {patientName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{patientName}</p>
            <p style={{ fontSize: 11.5, color: "#64748b" }}>Currently admitted</p>
          </div>
        </div>
      )}

      {/* Status picker */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#64748b", marginBottom: 8 }}>Status</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {STATUSES.map(s => {
            const m = STATUS_META[s];
            const active = status === s;
            return (
              <button key={s} onClick={() => setStatus(s)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 14px", borderRadius: 8, cursor: "pointer",
                  fontSize: 13, fontWeight: 600, transition: "all .15s",
                  background: active ? m.bg : "#f8fafc",
                  border: `2px solid ${active ? m.border : "#e2e8f0"}`,
                  color: active ? m.text : "#64748b",
                }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: active ? m.dot : "#cbd5e1", flexShrink: 0 }} />
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notes */}
      <ModalInput label="Notes" optional value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes about this bed" />

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
        {!confirm ? (
          <button onClick={() => setConfirm(true)}
            style={{ fontSize: 12.5, fontWeight: 600, color: "#ef4444", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            Delete bed
          </button>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12.5, color: "#64748b" }}>Sure?</span>
            <button onClick={handleDelete} disabled={loading}
              style={{ fontSize: 12.5, fontWeight: 700, color: "#b91c1c", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              Yes, delete
            </button>
            <button onClick={() => setConfirm(false)}
              style={{ fontSize: 12.5, color: "#94a3b8", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              Cancel
            </button>
          </div>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose}
            style={{ padding: "9px 18px", borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: "pointer", background: "#fff", color: "#0f172a", border: "1px solid #e2e8f0" }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={loading}
            style={{ padding: "9px 18px", borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: "pointer", background: "var(--blue-600)", color: "#fff", border: "none", opacity: loading ? 0.5 : 1 }}>
            {loading ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ── Bed tile ──────────────────────────────────────────────────────────────────

function BedTile({ bed, onClick }) {
  const meta = STATUS_META[bed.status] ?? STATUS_META.available;
  const patientName = bed.visit?.patient
    ? `${bed.visit.patient.first_name ?? ""} ${bed.visit.patient.last_name ?? ""}`.trim()
    : null;

  // support both label and bed_number columns
  const displayLabel = bed.label ?? bed.bed_number ?? "—";

  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", flexDirection: "column", gap: 8,
        padding: 14, borderRadius: 10, textAlign: "left",
        background: meta.bg, border: `2px solid ${meta.border}`,
        cursor: "pointer", transition: "transform .15s, box-shadow .15s",
        width: "100%",
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,.08)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 20 }}>🛏️</span>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: meta.dot, flexShrink: 0 }} />
      </div>

      <p style={{ fontFamily: "var(--font-display)", fontSize: 13.5, fontWeight: 700, color: meta.text, lineHeight: 1.2 }}>
        {displayLabel}
      </p>

      <span style={{
        display: "inline-flex", alignItems: "center",
        padding: "2px 8px", borderRadius: 99,
        fontSize: 10.5, fontWeight: 600,
        background: meta.bg, color: meta.text,
        border: `1px solid ${meta.border}`,
      }}>
        {meta.label}
      </span>

      {patientName && (
        <p style={{ fontSize: 11, color: "#475569", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
          {patientName}
        </p>
      )}
      {!patientName && bed.notes && (
        <p style={{ fontSize: 11, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
          {bed.notes}
        </p>
      )}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BedMap() {
  const { id: wardId } = useParams();
  const navigate = useNavigate();
  const { orgId, isOwner, isAdmin } = useAuth();
  const canManage = isOwner || isAdmin;

  const [ward,         setWard]         = useState(null);
  const [beds,         setBeds]         = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [showAddBed,   setShowAddBed]   = useState(false);
  const [activeBed,    setActiveBed]    = useState(null);

  async function fetchWardAndBeds() {
    setLoading(true);
    const [{ data: wardData }, { data: bedData }] = await Promise.all([
      supabase.from("wards").select("*").eq("id", wardId).single(),
      // keep original select — only columns that exist in the table
      supabase
        .from("beds")
        .select("id, ward_id, bed_number, label, notes, status, visit_id")
        .eq("ward_id", wardId)
        .order("bed_number"),
    ]);
    setWard(wardData ?? null);
    setBeds(bedData  ?? []);
    setLoading(false);
  }

  useEffect(() => { if (wardId) fetchWardAndBeds(); }, [wardId]);

  const filtered = filterStatus === "all" ? beds : beds.filter(b => b.status === filterStatus);

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = beds.filter(b => b.status === s).length;
    return acc;
  }, {});

  const filterItems = [
    { key: "all", label: "All beds", count: beds.length, dot: null },
    ...STATUSES.map(s => ({ key: s, label: STATUS_META[s].label, count: counts[s], dot: STATUS_META[s].dot, meta: STATUS_META[s] })),
  ];

  return (
    <>
      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <button
            onClick={() => navigate("/wards")}
            style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 600, color: "#94a3b8", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 8 }}
            onMouseEnter={e => e.currentTarget.style.color = "#475569"}
            onMouseLeave={e => e.currentTarget.style.color = "#94a3b8"}
          >
            ← Back to Wards
          </button>
          <h1 className="page-header__title">
            {loading ? "Loading…" : (ward?.name ?? "Bed Map")}
          </h1>
          {ward && (
            <p className="page-header__subtitle">
              {ward.capacity ?? beds.length} beds · {ward.type ? ward.type.charAt(0).toUpperCase() + ward.type.slice(1) : ""} ward
            </p>
          )}
        </div>
        {canManage && (
          <button
            onClick={() => setShowAddBed(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: "pointer", background: "var(--blue-600)", color: "#fff", border: "none" }}
          >
            + Add bed
          </button>
        )}
      </div>

      {/* ── Status filter pills ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 28 }}>
        {filterItems.map(item => {
          const active = filterStatus === item.key;
          const m = item.meta ?? null;
          return (
            <button
              key={item.key}
              onClick={() => setFilterStatus(item.key)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "8px 16px", borderRadius: 8, cursor: "pointer",
                fontSize: 13, fontWeight: 600, transition: "all .15s",
                background: active ? (m ? m.bg : "#0f172a") : "#fff",
                border: `1px solid ${active ? (m ? m.border : "#0f172a") : "#e2e8f0"}`,
                color: active ? (m ? m.text : "#fff") : "#64748b",
              }}
            >
              {item.dot && (
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: active ? item.dot : "#cbd5e1", flexShrink: 0 }} />
              )}
              {item.label}
              <span style={{
                fontSize: 11, fontWeight: 700,
                padding: "1px 6px", borderRadius: 99,
                background: "rgba(0,0,0,0.08)",
                color: "inherit",
              }}>
                {item.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Bed grid ── */}
      {loading ? (
        <div className="empty-state">Loading beds…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p>No beds found{filterStatus !== "all" ? ` with status "${STATUS_META[filterStatus]?.label}"` : ""}.</p>
          {canManage && beds.length === 0 && (
            <button
              onClick={() => setShowAddBed(true)}
              style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: "pointer", background: "var(--blue-600)", color: "#fff", border: "none" }}
            >
              Add first bed
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 12 }}>
          {filtered.map(bed => (
            <BedTile key={bed.id} bed={bed} onClick={() => setActiveBed(bed)} />
          ))}
        </div>
      )}

      {/* ── Legend ── */}
      {!loading && beds.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginTop: 32, paddingTop: 20, borderTop: "1px solid #e2e8f0" }}>
          {STATUSES.map(s => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: STATUS_META[s].dot }} />
              <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>{STATUS_META[s].label}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Modals ── */}
      {showAddBed && (
        <AddBedModal wardId={wardId} onClose={() => setShowAddBed(false)} onSaved={fetchWardAndBeds} />
      )}
      {activeBed && (
        <BedModal
          bed={activeBed}
          onClose={() => setActiveBed(null)}
          onSaved={fetchWardAndBeds}
          onDeleted={fetchWardAndBeds}
        />
      )}
    </>
  );
}