import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

// ─── icons ────────────────────────────────────────────────────────────────────
const BedIcon = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path d="M2 9V19M22 9V19M2 14H22M2 9C2 9 4 7 12 7C20 7 22 9 22 9" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M6 7V5C6 4.448 6.448 4 7 4H17C17.552 4 18 4.448 18 5V7" strokeLinecap="round"/>
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd"/>
  </svg>
);

const WardIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <path d="M3 9H21M3 15H21M9 3V21M15 3V21" strokeLinecap="round"/>
  </svg>
);

// ─── status config ────────────────────────────────────────────────────────────
const BED_STATUS = {
  available:   { label: "Available",    bg: "bg-emerald-50",  border: "border-emerald-300", text: "text-emerald-700", dot: "bg-emerald-400" },
  occupied:    { label: "Occupied",     bg: "bg-red-50",      border: "border-red-300",     text: "text-red-700",    dot: "bg-red-400"     },
  reserved:    { label: "Reserved",     bg: "bg-amber-50",    border: "border-amber-300",   text: "text-amber-700",  dot: "bg-amber-400"   },
  maintenance: { label: "Maintenance",  bg: "bg-slate-100",   border: "border-slate-300",   text: "text-slate-500",  dot: "bg-slate-400"   },
};

// ─── BedCell ──────────────────────────────────────────────────────────────────
function BedCell({ bed, isSelected, isCurrentBed, onSelect }) {
  const cfg = BED_STATUS[bed.status] ?? BED_STATUS.available;
  const isAvailable = bed.status === "available";
  const clickable = isAvailable || isCurrentBed;

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => clickable && onSelect(bed)}
      className={[
        "relative flex flex-col items-center justify-center rounded-xl border-2 p-3 transition-all duration-150 select-none",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-500)]",
        clickable ? "cursor-pointer hover:scale-[1.03] hover:shadow-md" : "cursor-not-allowed opacity-60",
        isSelected || isCurrentBed
          ? "border-[var(--blue-500)] bg-[var(--blue-50)] shadow-md ring-2 ring-[var(--blue-200)]"
          : `${cfg.bg} ${cfg.border}`,
      ].join(" ")}
      title={`Bed ${bed.bed_number}${bed.bed_label ? ` — ${bed.bed_label}` : ""} · ${cfg.label}`}
    >
      {isCurrentBed && (
        <span className="absolute -top-2 -right-2 bg-[var(--blue-600)] text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-tight">
          Current
        </span>
      )}
      {isSelected && !isCurrentBed && (
        <span className="absolute -top-2 -right-2 bg-emerald-500 text-white rounded-full p-0.5">
          <CheckIcon />
        </span>
      )}
      <BedIcon className={`w-6 h-6 mb-1 ${isSelected || isCurrentBed ? "text-[var(--blue-600)]" : cfg.text}`} />
      <span className={`text-xs font-bold leading-none ${isSelected || isCurrentBed ? "text-[var(--blue-700)]" : cfg.text}`}>
        {bed.bed_number}
      </span>
      {bed.bed_label && (
        <span className="text-[10px] text-[var(--text-muted)] mt-0.5 truncate w-full text-center">
          {bed.bed_label}
        </span>
      )}
      <span className={`mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium ${isSelected || isCurrentBed ? "text-[var(--blue-600)]" : cfg.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${isSelected || isCurrentBed ? "bg-[var(--blue-500)]" : cfg.dot}`}/>
        {isCurrentBed ? "Assigned" : isSelected ? "Selected" : cfg.label}
      </span>
    </button>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-[var(--text-secondary)]">
      {Object.entries(BED_STATUS).map(([key, cfg]) => (
        <span key={key} className="flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`}/>
          {cfg.label}
        </span>
      ))}
    </div>
  );
}

// ─── Shared grid UI ───────────────────────────────────────────────────────────
function WardBedPicker({ orgId, selectedBed, onBedSelect, currentBed = null, readOnly = false }) {
  const [wards, setWards]               = useState([]);
  const [selectedWardId, setSelectedWardId] = useState(currentBed?.ward_id ?? "");
  const [beds, setBeds]                 = useState([]);
  const [loadingWards, setLoadingWards] = useState(true);
  const [loadingBeds, setLoadingBeds]   = useState(false);

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      setLoadingWards(true);
      const { data } = await supabase
        .from("wards")
        .select("id, name, ward_type, capacity")
        .eq("org_id", orgId)
        .order("name");
      setWards(data ?? []);
      setLoadingWards(false);
    })();
  }, [orgId]);

  const loadBeds = useCallback(async (wardId) => {
    if (!wardId) { setBeds([]); return; }
    setLoadingBeds(true);
    const { data } = await supabase
      .from("beds")
      .select("*")
      .eq("ward_id", wardId)
      .order("bed_number");
    setBeds(data ?? []);
    setLoadingBeds(false);
  }, []);

  useEffect(() => { loadBeds(selectedWardId); }, [selectedWardId, loadBeds]);

  // also expose wardId upward when a bed is selected
  function handleSelect(bed) {
    if (currentBed?.id === bed.id) return;
    const toggled = selectedBed?.id === bed.id ? null : bed;
    onBedSelect(toggled ? { ...toggled, ward_id: selectedWardId } : null);
  }

  const selectedWard = wards.find(w => w.id === selectedWardId);
  const availableCount = beds.filter(b => b.status === "available").length;

  return (
    <div className="space-y-4">
      {/* Ward pills */}
      <div>
        <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
          Select Ward
        </label>
        {loadingWards ? (
          <div className="h-11 rounded-xl bg-[var(--bg-page)] animate-pulse border border-[var(--border)]"/>
        ) : wards.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] py-2">No wards found. Add wards in the Wards module.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {wards.map(ward => (
              <button
                key={ward.id}
                type="button"
                disabled={readOnly}
                onClick={() => { setSelectedWardId(ward.id); onBedSelect(null); }}
                className={[
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all",
                  readOnly ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:shadow-sm",
                  selectedWardId === ward.id
                    ? "border-[var(--blue-500)] bg-[var(--blue-600)] text-white shadow-md"
                    : "border-[var(--border)] bg-white text-[var(--text-primary)] hover:border-[var(--blue-300)] hover:bg-[var(--blue-50)]"
                ].join(" ")}
              >
                <WardIcon />
                {ward.name}
                {ward.ward_type && (
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-md font-medium ${
                    selectedWardId === ward.id ? "bg-white/20 text-white" : "bg-[var(--bg-page)] text-[var(--text-muted)]"
                  }`}>
                    {ward.ward_type}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bed grid */}
      {selectedWardId && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                {selectedWard?.name ?? "Ward"} — Bed Map
              </h3>
              {!loadingBeds && (
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {availableCount} of {beds.length} beds available
                </p>
              )}
            </div>
            <Legend />
          </div>

          {loadingBeds ? (
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="h-20 rounded-xl bg-[var(--bg-page)] animate-pulse border border-[var(--border)]"/>
              ))}
            </div>
          ) : beds.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 rounded-2xl border-2 border-dashed border-[var(--border)] gap-2">
              <BedIcon className="w-8 h-8 text-[var(--text-muted)]" />
              <p className="text-sm text-[var(--text-muted)]">No beds configured for this ward.</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3">
              {beds.map(bed => (
                <BedCell
                  key={bed.id}
                  bed={bed}
                  isSelected={selectedBed?.id === bed.id}
                  isCurrentBed={currentBed?.id === bed.id}
                  onSelect={readOnly ? () => {} : handleSelect}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
/**
 * BedAssignment — two modes:
 *
 * MODE "new"  (controlled picker for NewVisit)
 *   Props: mode="new", value, onChange, orgId?
 *   value = { bed_id, ward_id } | null
 *   onChange(value) — called on every selection change
 *   Does NOT write to DB; NewVisit handles that in its submit handler.
 *
 * MODE "edit"  (reads + writes DB for VisitDetail)
 *   Props: mode="edit" (default), visit, orgId, isInpatient, readOnly, onBedChange
 *   Handles its own save / release logic with toasts.
 */
export default function BedAssignment(props) {
  const { orgId: ctxOrgId } = useAuth();

  // ── NEW mode ────────────────────────────────────────────────────────────────
  if (props.mode === "new") {
    const { value, onChange, orgId } = props;
    const resolvedOrgId = orgId ?? ctxOrgId;

    const selectedBed = value ? { id: value.bed_id, ward_id: value.ward_id } : null;

    function handleSelect(bed) {
      onChange(bed ? { bed_id: bed.id, ward_id: bed.ward_id } : null);
    }

    return (
      <WardBedPicker
        orgId={resolvedOrgId}
        selectedBed={selectedBed}
        onBedSelect={handleSelect}
        currentBed={null}
        readOnly={false}
      />
    );
  }

  // ── EDIT mode (default) ──────────────────────────────────────────────────────
  const { visit, orgId, isInpatient, readOnly = false, onBedChange } = props;
  const resolvedOrgId = orgId ?? ctxOrgId;

  return (
    <EditMode
      visit={visit}
      orgId={resolvedOrgId}
      isInpatient={isInpatient}
      readOnly={readOnly}
      onBedChange={onBedChange}
    />
  );
}

// ─── Edit mode (extracted so hooks aren't called conditionally) ───────────────
function EditMode({ visit, orgId, isInpatient, readOnly, onBedChange }) {
  const [currentBed, setCurrentBed] = useState(null);
  const [selectedBed, setSelectedBed] = useState(null);
  const [saving, setSaving]           = useState(false);
  const [releasing, setReleasing]     = useState(false);
  const [toast, setToast]             = useState(null);
  const [reloadKey, setReloadKey]     = useState(0); // bump to force WardBedPicker to re-fetch beds

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Load current bed assignment for this visit
  useEffect(() => {
    if (!visit?.id) return;
    (async () => {
      const { data } = await supabase
        .from("beds")
        .select("*, wards(id, name)")
        .eq("visit_id", visit.id)
        .maybeSingle();
      if (data) setCurrentBed(data);
    })();
  }, [visit?.id]);

  async function handleAssign() {
    if (!selectedBed) return;
    setSaving(true);
    try {
      const { error: bedErr } = await supabase
        .from("beds")
        .update({ status: "occupied", visit_id: visit.id })
        .eq("id", selectedBed.id);
      if (bedErr) throw bedErr;

      if (currentBed && currentBed.id !== selectedBed.id) {
        await supabase
          .from("beds")
          .update({ status: "available", visit_id: null })
          .eq("id", currentBed.id);
      }

      setCurrentBed({ ...selectedBed, status: "occupied", visit_id: visit.id });
      setSelectedBed(null);
      setReloadKey(k => k + 1);
      setToast({ type: "success", msg: `Bed ${selectedBed.bed_number} assigned successfully.` });
      onBedChange?.();
    } catch (e) {
      setToast({ type: "error", msg: e.message ?? "Failed to assign bed." });
    } finally {
      setSaving(false);
    }
  }

  async function handleRelease() {
    if (!currentBed) return;
    setReleasing(true);
    try {
      const { error } = await supabase
        .from("beds")
        .update({ status: "available", visit_id: null })
        .eq("id", currentBed.id);
      if (error) throw error;

      setCurrentBed(null);
      setSelectedBed(null);
      setReloadKey(k => k + 1);
      setToast({ type: "success", msg: "Bed released successfully." });
      onBedChange?.();
    } catch (e) {
      setToast({ type: "error", msg: e.message ?? "Failed to release bed." });
    } finally {
      setReleasing(false);
    }
  }

  if (!isInpatient) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-[var(--bg-page)] border border-[var(--border)] flex items-center justify-center">
          <BedIcon className="w-7 h-7 text-[var(--text-muted)]" />
        </div>
        <p className="text-sm font-medium text-[var(--text-secondary)]">Bed assignment is only available for inpatient visits.</p>
      </div>
    );
  }

  const hasChange = selectedBed && selectedBed.id !== currentBed?.id;

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={[
          "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium border",
          toast.type === "success"
            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
            : "bg-red-50 border-red-200 text-red-800"
        ].join(" ")}>
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${toast.type === "success" ? "bg-emerald-500" : "bg-red-500"}`}/>
          {toast.msg}
        </div>
      )}

      {/* Current assignment banner */}
      {currentBed && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border-2 border-[var(--blue-200)] bg-[var(--blue-50)] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--blue-600)] flex items-center justify-center flex-shrink-0">
              <BedIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--blue-500)] uppercase tracking-wider mb-0.5">Currently Assigned</p>
              <p className="text-sm font-bold text-[var(--blue-900)]">
                Bed {currentBed.bed_number}
                {currentBed.bed_label ? ` · ${currentBed.bed_label}` : ""}
                {currentBed.wards?.name ? ` — ${currentBed.wards.name}` : ""}
              </p>
            </div>
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={handleRelease}
              disabled={releasing}
              className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold text-red-600 bg-white border-2 border-red-200 hover:bg-red-50 hover:border-red-300 transition-all disabled:opacity-50"
            >
              {releasing ? "Releasing…" : "Release Bed"}
            </button>
          )}
        </div>
      )}

      {/* Shared picker */}
      <WardBedPicker
        key={reloadKey}
        orgId={orgId}
        selectedBed={selectedBed}
        onBedSelect={readOnly ? () => {} : setSelectedBed}
        currentBed={currentBed}
        readOnly={readOnly}
      />

      {/* Confirm bar */}
      {!readOnly && hasChange && (
        <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-[var(--bg-page)] border border-[var(--border)]">
          <div className="text-sm text-[var(--text-secondary)]">
            {currentBed
              ? <>Reassigning from <strong className="text-[var(--text-primary)]">Bed {currentBed.bed_number}</strong> to <strong className="text-[var(--text-primary)]">Bed {selectedBed.bed_number}</strong></>
              : <>Assigning <strong className="text-[var(--text-primary)]">Bed {selectedBed.bed_number}</strong></>
            }
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setSelectedBed(null)}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-[var(--text-secondary)] bg-white border border-[var(--border)] hover:bg-[var(--bg-page)] transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAssign}
              disabled={saving}
              className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-[var(--blue-600)] hover:bg-[var(--blue-700)] disabled:opacity-60 transition-all shadow-sm hover:shadow-md"
            >
              {saving ? "Saving…" : currentBed ? "Reassign Bed" : "Assign Bed"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
