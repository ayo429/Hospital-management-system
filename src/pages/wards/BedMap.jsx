import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

// ── Constants ────────────────────────────────────────────────────────────────

const STATUSES = ["available", "occupied", "reserved", "maintenance"];

const STATUS_META = {
  available:   { label: "Available",   bg: "bg-emerald-50",  border: "border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700" },
  occupied:    { label: "Occupied",    bg: "bg-red-50",      border: "border-red-200",     text: "text-red-700",     dot: "bg-red-500",     badge: "bg-red-100 text-red-600" },
  reserved:    { label: "Reserved",    bg: "bg-blue-50",     border: "border-blue-200",    text: "text-blue-700",    dot: "bg-blue-500",    badge: "bg-blue-100 text-blue-700" },
  maintenance: { label: "Maintenance", bg: "bg-amber-50",    border: "border-amber-200",   text: "text-amber-700",   dot: "bg-amber-400",   badge: "bg-amber-100 text-amber-700" },
};

// ── Add Bed Modal ─────────────────────────────────────────────────────────────

function AddBedModal({ wardId, onClose, onSaved }) {
  const { orgId } = useAuth();
  const [label,   setLabel]   = useState("");
  const [notes,   setNotes]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  async function handleSave() {
    if (!label.trim()) { setError("Bed label is required."); return; }
    setLoading(true); setError(null);
    const { error: err } = await supabase.from("beds").insert({
      ward_id: wardId,
      label: label.trim(),
      notes: notes.trim() || null,
      status: "available",
    });
    if (err) { setError(err.message); setLoading(false); }
    else     { onSaved?.(); onClose(); }
  }

  return (
    <ModalShell title="Add bed" onClose={onClose}>
      {error && <ErrorBanner msg={error} />}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[12.5px] font-semibold text-slate-500">Bed label</label>
          <input
            className="input-base"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="e.g. Bed 1A, Bed 12, Cot 3"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[12.5px] font-semibold text-slate-500">Notes <span className="font-normal text-slate-400">(optional)</span></label>
          <input
            className="input-base"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Near window, oxygen point"
          />
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={handleSave} disabled={loading} className="btn-primary">
          {loading ? "Adding…" : "Add bed"}
        </button>
      </div>
    </ModalShell>
  );
}

// ── Bed Detail / Edit Modal ───────────────────────────────────────────────────

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
      .update({ status, notes: notes.trim() || null })
      .eq("id", bed.id);
    if (err) { setError(err.message); setLoading(false); }
    else     { onSaved?.(); onClose(); }
  }

  async function handleDelete() {
    setLoading(true);
    const { error: err } = await supabase.from("beds").delete().eq("id", bed.id);
    if (err) { setError(err.message); setLoading(false); }
    else     { onDeleted?.(); onClose(); }
  }

  const meta = STATUS_META[status] ?? STATUS_META.available;

  return (
    <ModalShell title={`Bed ${bed.label}`} onClose={onClose}>
      {error && <ErrorBanner msg={error} />}

      {/* Patient info if occupied */}
      {patientName && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-sm font-bold text-red-700 shrink-0">
            {patientName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-[13px] font-semibold text-slate-800">{patientName}</p>
            <p className="text-[11.5px] text-slate-500">Currently admitted</p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {/* Status */}
        <div className="flex flex-col gap-2">
          <label className="text-[12.5px] font-semibold text-slate-500">Status</label>
          <div className="grid grid-cols-2 gap-2">
            {STATUSES.map(s => {
              const m = STATUS_META[s];
              const active = status === s;
              return (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-[13px] font-semibold transition cursor-pointer ${
                    active
                      ? `${m.bg} ${m.border} ${m.text}`
                      : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${active ? m.dot : "bg-slate-300"}`} />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[12.5px] font-semibold text-slate-500">Notes</label>
          <input
            className="input-base"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Optional notes about this bed"
          />
        </div>
      </div>

      <div className="flex items-center justify-between mt-6">
        {/* Delete */}
        {!confirm ? (
          <button
            onClick={() => setConfirm(true)}
            className="text-[12.5px] font-semibold text-red-500 hover:text-red-700 bg-transparent border-none cursor-pointer"
          >
            Delete bed
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] text-slate-500">Sure?</span>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="text-[12.5px] font-semibold text-red-600 bg-transparent border-none cursor-pointer"
            >
              Yes, delete
            </button>
            <button
              onClick={() => setConfirm(false)}
              className="text-[12.5px] text-slate-400 bg-transparent border-none cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={loading} className="btn-primary">
            {loading ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function ModalShell({ title, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[10px] w-full max-w-110 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
          <h2 style={{ fontFamily: "var(--font-display)" }} className="text-[15px] font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none bg-transparent border-none cursor-pointer">×</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function ErrorBanner({ msg }) {
  return <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-700">{msg}</div>;
}

// ── Bed tile ──────────────────────────────────────────────────────────────────

function BedTile({ bed, onClick }) {
  const meta = STATUS_META[bed.status] ?? STATUS_META.available;

  const patientName = bed.visit?.patient
    ? `${bed.visit.patient.first_name ?? ""} ${bed.visit.patient.last_name ?? ""}`.trim()
    : null;

  return (
    <button
      onClick={onClick}
      className={`group flex flex-col gap-1.5 p-3 rounded-[10px] border-2 text-left transition cursor-pointer hover:-translate-y-0.5 hover:shadow-md ${meta.bg} ${meta.border}`}
    >
      {/* Bed icon + label */}
      <div className="flex items-center justify-between">
        <span className="text-lg">🛏️</span>
        <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
      </div>

      <p style={{ fontFamily: "var(--font-display)" }} className={`text-[13px] font-bold leading-tight ${meta.text}`}>
        {bed.label}
      </p>

      {/* Status badge */}
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold ${meta.badge}`}>
        {meta.label}
      </span>

      {/* Patient name if occupied */}
      {patientName && (
        <p className="text-[11px] text-slate-600 font-medium truncate mt-0.5">{patientName}</p>
      )}

      {/* Notes */}
      {bed.notes && !patientName && (
        <p className="text-[11px] text-slate-400 truncate mt-0.5">{bed.notes}</p>
      )}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BedMap() {
  const { id: wardId } = useParams();
  const navigate       = useNavigate();
  const { orgId, isOwner, isAdmin } = useAuth();
  const canManage = isOwner || isAdmin;

  const [ward,       setWard]       = useState(null);
  const [beds,       setBeds]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [showAddBed, setShowAddBed] = useState(false);
  const [activeBed,  setActiveBed]  = useState(null);

  async function fetchWardAndBeds() {
    setLoading(true);

    const [{ data: wardData }, { data: bedData }] = await Promise.all([
      supabase.from("wards").select("*").eq("id", wardId).single(),
      supabase.from("beds")
        .select("*, visit:visits(id, patient:patients(id, first_name, last_name))")
        .eq("ward_id", wardId)
        .order("label"),
    ]);

    setWard(wardData ?? null);
    setBeds(bedData  ?? []);
    setLoading(false);
  }

  useEffect(() => { if (wardId) fetchWardAndBeds(); }, [wardId]);

  const filtered = filterStatus === "all"
    ? beds
    : beds.filter(b => b.status === filterStatus);

  // ── Counts ──
  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = beds.filter(b => b.status === s).length;
    return acc;
  }, {});

  return (
    <>
      <style>{`
        .btn-primary  { display:inline-flex;align-items:center;gap:6px;padding:9px 18px;border-radius:8px;font-size:13.5px;font-weight:600;cursor:pointer;border:none;background:var(--blue-600);color:#fff;transition:background .15s;white-space:nowrap; }
        .btn-primary:hover { background:var(--blue-500); }
        .btn-primary:disabled { opacity:.45;cursor:not-allowed; }
        .btn-secondary { display:inline-flex;align-items:center;gap:6px;padding:9px 18px;border-radius:8px;font-size:13.5px;font-weight:600;cursor:pointer;background:#fff;color:var(--text-primary);border:1px solid var(--border);transition:background .15s;white-space:nowrap; }
        .btn-secondary:hover { background:var(--bg-page); }
        .input-base { padding:9px 13px;border:1px solid var(--border);border-radius:8px;font-size:13.5px;color:var(--text-primary);background:#fff;outline:none;transition:border-color .15s,box-shadow .15s;width:100%; }
        .input-base:focus { border-color:var(--blue-400);box-shadow:0 0 0 3px rgba(59,130,246,.15); }
        .input-base::placeholder { color:var(--text-muted); }
      `}</style>

      <div className="p-8">

        {/* ── Back + header ── */}
        <div className="flex items-start justify-between mb-7">
          <div>
            <button
              onClick={() => navigate("/wards")}
              className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 hover:text-slate-700 mb-2 bg-transparent border-none cursor-pointer p-0"
            >
              ← Back to Wards
            </button>
            <h1 style={{ fontFamily: "var(--font-display)" }} className="text-[22px] font-bold text-slate-900 tracking-tight">
              {loading ? "Loading…" : (ward?.name ?? "Bed Map")}
            </h1>
            {ward && (
              <p className="text-[14px] text-slate-500 mt-1">
                {ward.capacity ?? beds.length} beds · {ward.type ? ward.type.charAt(0).toUpperCase() + ward.type.slice(1) : ""} ward
              </p>
            )}
          </div>
          {canManage && (
            <button className="btn-primary" onClick={() => setShowAddBed(true)}>+ Add bed</button>
          )}
        </div>

        {/* ── Status summary strip ── */}
        <div className="flex flex-wrap gap-3 mb-6">
          {[{ key: "all", label: "All beds", count: beds.length }, ...STATUSES.map(s => ({ key: s, label: STATUS_META[s].label, count: counts[s] }))].map(item => {
            const meta  = item.key === "all" ? null : STATUS_META[item.key];
            const active = filterStatus === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setFilterStatus(item.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-[13px] font-semibold transition cursor-pointer ${
                  active
                    ? meta
                      ? `${meta.bg} ${meta.border} ${meta.text}`
                      : "bg-slate-900 border-slate-900 text-white"
                    : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                {meta && <span className={`w-2 h-2 rounded-full ${active ? meta.dot : "bg-slate-300"}`} />}
                {item.label}
                <span className={`ml-0.5 text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
                  active && !meta ? "bg-white/20 text-white" :
                  active && meta  ? `${meta.badge}` :
                  "bg-slate-100 text-slate-500"
                }`}>
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Bed grid ── */}
        {loading ? (
          <div className="py-16 text-center text-[13.5px] text-slate-400">Loading beds…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-[13.5px] text-slate-400">
            <p>No beds found{filterStatus !== "all" ? ` with status "${STATUS_META[filterStatus]?.label}"` : ""}.</p>
            {canManage && beds.length === 0 && (
              <button className="btn-primary mt-3" onClick={() => setShowAddBed(true)}>Add first bed</button>
            )}
          </div>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }}>
            {filtered.map(bed => (
              <BedTile
                key={bed.id}
                bed={bed}
                onClick={() => setActiveBed(bed)}
              />
            ))}
          </div>
        )}

        {/* ── Legend ── */}
        {!loading && beds.length > 0 && (
          <div className="flex flex-wrap gap-4 mt-8 pt-6 border-t border-slate-200">
            {STATUSES.map(s => {
              const m = STATUS_META[s];
              return (
                <div key={s} className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${m.dot}`} />
                  <span className="text-[12px] text-slate-500 font-medium">{m.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

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