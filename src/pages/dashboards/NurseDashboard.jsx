// src/pages/dashboard/NurseDashboard.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

const TABS = ["Vitals", "Notes"];

export default function NurseDashboard() {
  const { orgId, profile } = useAuth();
  const navigate = useNavigate();

  const [visits, setVisits] = useState([]);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [activeTab, setActiveTab] = useState("Vitals");
  const [vitals, setVitals] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingVitals, setSavingVitals] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [error, setError] = useState(null);

  const [vitalsForm, setVitalsForm] = useState({
    temperature: "",
    blood_pressure_systolic: "",
    blood_pressure_diastolic: "",
    pulse: "",
    spo2: "",
    weight: "",
    notes: "",
  });

  const [noteText, setNoteText] = useState("");

  useEffect(() => {
    if (!orgId) return;
    fetchVisits();
  }, [orgId]);

  useEffect(() => {
    if (!selectedVisit) return;
    fetchVisitDetails(selectedVisit.id);
  }, [selectedVisit]);

  async function fetchVisits() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("visits")
        .select(`
          id, type, status, chief_complaint, admitted_at,
          patients(id, first_name, last_name, mrn, dob, gender),
          profiles(first_name, last_name)
        `)
        .eq("org_id", orgId)
        .eq("status", "active")
        .order("admitted_at", { ascending: true });

      if (error) throw error;
      setVisits(data ?? []);
      if (data?.length > 0 && !selectedVisit) {
        setSelectedVisit(data[0]);
      }
    } catch (err) {
      console.error("fetchVisits error:", err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchVisitDetails(visitId) {
    const [{ data: v }, { data: n }] = await Promise.all([
      supabase
        .from("vitals")
        .select("*, profiles(first_name, last_name)")
        .eq("visit_id", visitId)
        .order("recorded_at", { ascending: false }),
      supabase
        .from("nursing_notes")
        .select("*, profiles(first_name, last_name)")
        .eq("visit_id", visitId)
        .order("created_at", { ascending: false }),
    ]);
    setVitals(v ?? []);
    setNotes(n ?? []);
  }

  async function handleSaveVitals(e) {
    e.preventDefault();
    setError(null);
    if (!selectedVisit) return;

    try {
      setSavingVitals(true);
      const { error } = await supabase.from("vitals").insert({
        visit_id: selectedVisit.id,
        org_id: orgId,
        recorded_by: profile.id,
        temperature: vitalsForm.temperature || null,
        blood_pressure_systolic: vitalsForm.blood_pressure_systolic || null,
        blood_pressure_diastolic: vitalsForm.blood_pressure_diastolic || null,
        pulse: vitalsForm.pulse || null,
        spo2: vitalsForm.spo2 || null,
        weight: vitalsForm.weight || null,
        notes: vitalsForm.notes || null,
      });

      if (error) throw error;

      setVitalsForm({
        temperature: "",
        blood_pressure_systolic: "",
        blood_pressure_diastolic: "",
        pulse: "",
        spo2: "",
        weight: "",
        notes: "",
      });
      await fetchVisitDetails(selectedVisit.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingVitals(false);
    }
  }

  async function handleSaveNote(e) {
    e.preventDefault();
    setError(null);
    if (!selectedVisit || !noteText.trim()) return;

    try {
      setSavingNote(true);
      const { error } = await supabase.from("nursing_notes").insert({
        visit_id: selectedVisit.id,
        org_id: orgId,
        nurse_id: profile.id,
        note: noteText.trim(),
      });

      if (error) throw error;
      setNoteText("");
      await fetchVisitDetails(selectedVisit.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingNote(false);
    }
  }

  const greeting = getGreeting();

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-header__title">
            {greeting}, {profile?.first_name} 👩‍⚕️
          </h1>
          <p className="page-header__subtitle">
            {visits.length} active visit{visits.length !== 1 ? "s" : ""} in the ward
          </p>
        </div>
        <button
          className="btn btn--primary"
          onClick={() => navigate("/visits/new")}
        >
          + New Visit
        </button>
      </div>

      <div className="nurse-layout">
        {/* Left — visit queue */}
        <div className="nurse-queue">
          <div className="nurse-queue__header">Active Visits</div>
          {loading ? (
            <div className="empty-state">Loading…</div>
          ) : visits.length === 0 ? (
            <div className="empty-state">No active visits.</div>
          ) : (
            visits.map((v) => (
              <button
                key={v.id}
                className={`nurse-queue__item ${selectedVisit?.id === v.id ? "nurse-queue__item--active" : ""}`}
                onClick={() => {
                  setSelectedVisit(v);
                  setActiveTab("Vitals");
                }}
              >
                <div className="nurse-queue__name">
                  {v.patients?.first_name} {v.patients?.last_name}
                </div>
                <div className="nurse-queue__meta">
                  <span className="badge badge--gray" style={{ fontSize: 10 }}>
                    {v.patients?.mrn}
                  </span>
                  <span className="badge badge--blue" style={{ fontSize: 10 }}>
                    {v.type}
                  </span>
                </div>
                <div className="nurse-queue__complaint">
                  {v.chief_complaint ?? "—"}
                </div>
                <div className="nurse-queue__time">
                  {timeAgo(v.admitted_at)}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Right — main panel */}
        <div className="nurse-panel">
          {!selectedVisit ? (
            <div className="empty-state">Select a patient from the queue.</div>
          ) : (
            <>
              {/* Patient summary */}
              <div className="nurse-patient-card">
                <div>
                  <div className="nurse-patient-card__name">
                    {selectedVisit.patients?.first_name}{" "}
                    {selectedVisit.patients?.last_name}
                  </div>
                  <div className="nurse-patient-card__meta">
                    {selectedVisit.patients?.mrn && (
                      <span className="badge badge--gray">
                        {selectedVisit.patients.mrn}
                      </span>
                    )}
                    {selectedVisit.patients?.dob && (
                      <span style={{ marginLeft: 8, fontSize: 13, color: "#64748b" }}>
                        {calculateAge(selectedVisit.patients.dob)} yrs
                      </span>
                    )}
                    {selectedVisit.patients?.gender && (
                      <span style={{ marginLeft: 6, fontSize: 13, color: "#64748b", textTransform: "capitalize" }}>
                        · {selectedVisit.patients.gender}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                    <strong>Complaint:</strong> {selectedVisit.chief_complaint ?? "—"}
                  </div>
                  {selectedVisit.profiles && (
                    <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
                      <strong>Doctor:</strong> Dr. {selectedVisit.profiles.first_name}{" "}
                      {selectedVisit.profiles.last_name}
                    </div>
                  )}
                </div>
                <button
                  className="btn btn--secondary"
                  onClick={() => navigate(`/visits/${selectedVisit.id}`)}
                >
                  Full Record →
                </button>
              </div>

              {error && <div className="form-error">{error}</div>}

              {/* Tabs */}
              <div className="tabs" style={{ marginTop: 20 }}>
                {TABS.map((tab) => (
                  <button
                    key={tab}
                    className={`tab ${activeTab === tab ? "tab--active" : ""}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Vitals tab */}
              {activeTab === "Vitals" && (
                <div className="card" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: "none" }}>
                  {/* Record vitals form */}
                  <div style={{ padding: "20px", borderBottom: "1px solid var(--border)" }}>
                    <div className="form-card__title" style={{ marginBottom: 16 }}>
                      Record Vitals
                    </div>
                    <form onSubmit={handleSaveVitals}>
                      <div className="form-grid">
                        <div className="form-field">
                          <label className="form-label">Temperature (°C)</label>
                          <input
                            className="input"
                            type="number"
                            step="0.1"
                            placeholder="e.g. 37.5"
                            value={vitalsForm.temperature}
                            onChange={(e) => setVitalsForm((f) => ({ ...f, temperature: e.target.value }))}
                          />
                        </div>
                        <div className="form-field">
                          <label className="form-label">Blood Pressure (mmHg)</label>
                          <div style={{ display: "flex", gap: 8 }}>
                            <input
                              className="input"
                              type="number"
                              placeholder="Systolic"
                              value={vitalsForm.blood_pressure_systolic}
                              onChange={(e) => setVitalsForm((f) => ({ ...f, blood_pressure_systolic: e.target.value }))}
                            />
                            <input
                              className="input"
                              type="number"
                              placeholder="Diastolic"
                              value={vitalsForm.blood_pressure_diastolic}
                              onChange={(e) => setVitalsForm((f) => ({ ...f, blood_pressure_diastolic: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="form-field">
                          <label className="form-label">Pulse (bpm)</label>
                          <input
                            className="input"
                            type="number"
                            placeholder="e.g. 72"
                            value={vitalsForm.pulse}
                            onChange={(e) => setVitalsForm((f) => ({ ...f, pulse: e.target.value }))}
                          />
                        </div>
                        <div className="form-field">
                          <label className="form-label">SpO2 (%)</label>
                          <input
                            className="input"
                            type="number"
                            placeholder="e.g. 98"
                            value={vitalsForm.spo2}
                            onChange={(e) => setVitalsForm((f) => ({ ...f, spo2: e.target.value }))}
                          />
                        </div>
                        <div className="form-field">
                          <label className="form-label">Weight (kg)</label>
                          <input
                            className="input"
                            type="number"
                            step="0.1"
                            placeholder="e.g. 70.5"
                            value={vitalsForm.weight}
                            onChange={(e) => setVitalsForm((f) => ({ ...f, weight: e.target.value }))}
                          />
                        </div>
                        <div className="form-field">
                          <label className="form-label">Notes</label>
                          <input
                            className="input"
                            placeholder="Any observations…"
                            value={vitalsForm.notes}
                            onChange={(e) => setVitalsForm((f) => ({ ...f, notes: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
                        <button
                          type="submit"
                          className="btn btn--primary"
                          disabled={savingVitals}
                        >
                          {savingVitals ? "Saving…" : "Save Vitals"}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Vitals history */}
                  {vitals.length === 0 ? (
                    <div className="empty-state">No vitals recorded yet.</div>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Temp</th>
                          <th>BP</th>
                          <th>Pulse</th>
                          <th>SpO2</th>
                          <th>Weight</th>
                          <th>By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vitals.map((v) => (
                          <tr key={v.id}>
                            <td>{formatTime(v.recorded_at)}</td>
                            <td>{v.temperature ? `${v.temperature}°C` : "—"}</td>
                            <td>
                              {v.blood_pressure_systolic && v.blood_pressure_diastolic
                                ? `${v.blood_pressure_systolic}/${v.blood_pressure_diastolic}`
                                : "—"}
                            </td>
                            <td>{v.pulse ? `${v.pulse} bpm` : "—"}</td>
                            <td>{v.spo2 ? `${v.spo2}%` : "—"}</td>
                            <td>{v.weight ? `${v.weight} kg` : "—"}</td>
                            <td>
                              {v.profiles
                                ? `${v.profiles.first_name} ${v.profiles.last_name}`
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Notes tab */}
              {activeTab === "Notes" && (
                <div className="card" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: "none" }}>
                  {/* Add note */}
                  <div style={{ padding: "20px", borderBottom: "1px solid var(--border)" }}>
                    <div className="form-card__title" style={{ marginBottom: 16 }}>
                      Add Nursing Note
                    </div>
                    <form onSubmit={handleSaveNote}>
                      <textarea
                        className="input input--textarea"
                        placeholder="Enter nursing note…"
                        rows={3}
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                      />
                      <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                        <button
                          type="submit"
                          className="btn btn--primary"
                          disabled={savingNote || !noteText.trim()}
                        >
                          {savingNote ? "Saving…" : "Save Note"}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Notes history */}
                  {notes.length === 0 ? (
                    <div className="empty-state">No nursing notes yet.</div>
                  ) : (
                    <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                      {notes.map((n) => (
                        <div key={n.id} className="note-item">
                          <div className="note-item__header">
                            <span className="note-item__author">
                              {n.profiles
                                ? `${n.profiles.first_name} ${n.profiles.last_name}`
                                : "Nurse"}
                            </span>
                            <span className="note-item__time">
                              {formatTime(n.created_at)}
                            </span>
                          </div>
                          <div className="note-item__text">{n.note}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ── */

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function calculateAge(dob) {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function timeAgo(iso) {
  if (!iso) return "—";
  const diff = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (diff < 1) return "Just now";
  if (diff < 60) return `${diff}m ago`;
  const hrs = Math.floor(diff / 60);
  return `${hrs}h ${diff % 60}m ago`;
}

function formatTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}