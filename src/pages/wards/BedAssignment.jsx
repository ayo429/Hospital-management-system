// src/components/BedAssignment.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

/**
 * BedAssignment
 *
 * Props:
 *   visitId    — visit UUID (required in mode="existing")
 *   mode       — "existing" (VisitDetail) | "new" (NewVisit, controlled)
 *   value      — { ward_id, bed_id } — controlled value for "new" mode
 *   onChange   — (val: { ward_id, bed_id } | null) => void — for "new" mode
 *   onAssigned — () => void — called after DB write in "existing" mode
 *   disabled   — locks UI (discharged visit / insufficient role)
 */
export default function BedAssignment({
  visitId,
  mode = "existing",
  value,
  onChange,
  onAssigned,
  disabled = false,
}) {
  const { orgId } = useAuth();

  const [wards,        setWards]        = useState([]);
  const [beds,         setBeds]         = useState([]);
  const [selectedWard, setSelectedWard] = useState(value?.ward_id ?? "");
  const [selectedBed,  setSelectedBed]  = useState(value?.bed_id  ?? "");
  const [currentBed,   setCurrentBed]   = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState(null);
  const [success,      setSuccess]      = useState(null);

  useEffect(() => {
    if (!orgId) return;
    fetchWards();
    if (mode === "existing" && visitId) fetchCurrentBed();
  }, [orgId, visitId]);

  useEffect(() => {
    if (!selectedWard) { setBeds([]); return; }
    fetchBeds(selectedWard);
  }, [selectedWard]);

  useEffect(() => {
    if (mode === "new") {
      setSelectedWard(value?.ward_id ?? "");
      setSelectedBed(value?.bed_id   ?? "");
    }
  }, [value]);

  async function fetchWards() {
    const { data } = await supabase
      .from("wards")
      .select("id, name, type")
      .order("name");
    setWards(data ?? []);
  }

  async function fetchBeds(wardId) {
    setLoading(true);
    const { data } = await supabase
      .from("beds")
      .select("id, bed_number, status")
      .eq("ward_id", wardId)
      .order("bed_number");
    setBeds(data ?? []);
    setLoading(false);
  }

  async function fetchCurrentBed() {
    const { data } = await supabase
      .from("visits")
      .select("bed_id, ward_id, beds!visits_bed_id_fkey(id, bed_number, status, ward_id, wards!beds_ward_id_fkey(name)), wards!visits_ward_id_fkey(id, name)")
      .eq("id", visitId)
      .single();

    if (data?.bed_id) {
      setCurrentBed(data.beds ?? null);
      setSelectedWard(data.ward_id ?? "");
    }
  }

  async function handleAssign() {
    if (!selectedBed) return;
    setSaving(true); setError(null); setSuccess(null);
    try {
      if (currentBed?.id) {
        await supabase.from("beds").update({ status: "available" }).eq("id", currentBed.id);
      }
      const { error: bedErr } = await supabase
        .from("beds").update({ status: "occupied" }).eq("id", selectedBed);
      if (bedErr) throw bedErr;

      const { error: visitErr } = await supabase
        .from("visits").update({ bed_id: selectedBed, ward_id: selectedWard }).eq("id", visitId);
      if (visitErr) throw visitErr;

      setSuccess("Bed assigned successfully.");
      await fetchCurrentBed();
      await fetchBeds(selectedWard);
      onAssigned?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRelease() {
    if (!currentBed?.id) return;
    setSaving(true); setError(null); setSuccess(null);
    try {
      await supabase.from("beds").update({ status: "available" }).eq("id", currentBed.id);
      await supabase.from("visits").update({ bed_id: null, ward_id: null }).eq("id", visitId);
      setCurrentBed(null);
      setSelectedBed("");
      setBeds([]);
      setSelectedWard("");
      setSuccess("Bed released.");
      onAssigned?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleWardChange(wardId) {
    setSelectedWard(wardId);
    setSelectedBed("");
    if (mode === "new") onChange?.(wardId ? { ward_id: wardId, bed_id: "" } : null);
  }

  function handleBedSelect(bedId) {
    setSelectedBed(bedId);
    if (mode === "new") onChange?.({ ward_id: selectedWard, bed_id: bedId });
  }

  const assignableBeds = beds.filter(
    (b) => b.status === "available" || b.id === currentBed?.id
  );
  const hasChange = selectedBed && selectedBed !== currentBed?.id;

  return (
    <div>
      {/* ── Current bed banner ── */}
      {mode === "existing" && currentBed && (
        <div className="flex items-center justify-between px-4 py-3 mb-4 rounded-lg bg-red-50 border border-red-200">
          <div className="flex items-center gap-3">
            <span className="text-lg">🛏️</span>
            <div>
              <p className="text-[13.5px] font-semibold text-slate-800">
                Bed {currentBed.bed_number}
                <span className="ml-2 text-[11.5px] font-normal text-slate-500">
                  · {currentBed.wards?.name ?? ""}
                </span>
              </p>
              <p className="text-[12px] text-red-600 font-medium">Currently assigned</p>
            </div>
          </div>
          {!disabled && (
            <button
              onClick={handleRelease}
              disabled={saving}
              className="text-[12.5px] font-semibold text-red-500 hover:text-red-700 bg-transparent border-none cursor-pointer disabled:opacity-40"
            >
              {saving ? "Releasing…" : "Release bed"}
            </button>
          )}
        </div>
      )}

      {/* ── No bed assigned ── */}
      {mode === "existing" && !currentBed && (
        <div className="flex items-center gap-2 px-4 py-3 mb-4 rounded-lg bg-slate-50 border border-slate-200">
          <span className="text-slate-400 text-lg">🛏️</span>
          <p className="text-[13px] text-slate-500">No bed assigned yet</p>
        </div>
      )}

      {!disabled && (
        <>
          {/* ── Ward picker ── */}
          <div className="flex flex-col gap-1.5 mb-4">
            <label className="form-label">Ward</label>
            <select
              className="input"
              value={selectedWard}
              onChange={e => handleWardChange(e.target.value)}
              disabled={saving}
            >
              <option value="">Select ward…</option>
              {wards.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          {/* ── Bed grid ── */}
          {selectedWard && (
            <div className="flex flex-col gap-1.5 mb-4">
              <label className="form-label">
                Available beds
                {loading && (
                  <span className="ml-2 text-[11px] text-slate-400 font-normal">Loading…</span>
                )}
              </label>

              {!loading && assignableBeds.length === 0 && (
                <p className="text-[13px] text-slate-400 py-3 text-center bg-slate-50 rounded-lg border border-slate-200">
                  No available beds in this ward
                </p>
              )}

              {!loading && assignableBeds.length > 0 && (
                <div
                  className="grid gap-2"
                  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))" }}
                >
                  {assignableBeds.map(bed => {
                    const isSelected = selectedBed === bed.id;
                    const isCurrent  = currentBed?.id === bed.id;

                    return (
                      <button
                        key={bed.id}
                        type="button"
                        onClick={() => handleBedSelect(isSelected ? "" : bed.id)}
                        disabled={saving}
                        className={[
                          "flex flex-col items-center gap-1 p-2.5 rounded-[10px] border-2 text-center",
                          "transition cursor-pointer text-[12px] font-semibold",
                          "disabled:opacity-40 disabled:cursor-not-allowed",
                          isSelected
                            ? "bg-blue-600 border-blue-600 text-white shadow-md"
                            : isCurrent
                            ? "bg-red-50 border-red-300 text-red-700"
                            : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-100",
                        ].join(" ")}
                      >
                        <span className="text-base">🛏️</span>
                        <span className="leading-tight">Bed {bed.bed_number}</span>
                        {isCurrent && !isSelected && (
                          <span className="text-[10px] font-normal opacity-70">current</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Feedback ── */}
          {error   && <p className="text-[13px] text-red-600 mb-3">{error}</p>}
          {success && <p className="text-[13px] text-emerald-600 mb-3">{success}</p>}

          {/* ── Assign button (existing mode only) ── */}
          {mode === "existing" && (
            <div className="flex justify-end">
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleAssign}
                disabled={saving || !hasChange}
              >
                {saving ? "Assigning…" : currentBed ? "Reassign bed" : "Assign bed"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}