// src/pages/visits/VisitDetail.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

const TABS = ["Overview", "Vitals", "Nursing Notes", "Prescriptions", "Lab Orders"];

export default function VisitDetail() {
  const { id } = useParams();
  const { orgId, profile, isDoctor, isNurse, isOwner, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [visit, setVisit] = useState(null);
  const [vitals, setVitals] = useState([]);
  const [notes, setNotes] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [labOrders, setLabOrders] = useState([]);
  const [activeTab, setActiveTab] = useState("Overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Vitals form
  const [vitalsForm, setVitalsForm] = useState({
    temperature: "", blood_pressure_systolic: "", blood_pressure_diastolic: "",
    pulse: "", spo2: "", weight: "", notes: "",
  });
  const [savingVitals, setSavingVitals] = useState(false);

  // Note form
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Diagnosis form
  const [diagnosis, setDiagnosis] = useState("");
  const [savingDiagnosis, setSavingDiagnosis] = useState(false);

  // Discharge
  const [dischargingVisit, setDischargingVisit] = useState(false);

  useEffect(() => {
    if (!orgId || !id) return;
    fetchAll();
  }, [orgId, id]);

  async function fetchAll() {
    setLoading(true);
    try {
      const [
        { data: v, error: vErr },
        { data: vitalsData },
        { data: notesData },
        { data: presData },
        { data: labData },
      ] = await Promise.all([
        supabase
          .from("visits")
          .select(`
            *,
            patients(id, first_name, last_name, mrn, dob, gender, phone, blood_group, hmo_plans(name)),
            profiles:attending_doctor_id(first_name, last_name),
            wards(name),
            beds(bed_number)
          `)
          .eq("id", id)
          .eq("org_id", orgId)
          .single(),
        supabase
          .from("vitals")
          .select("*, profiles(first_name, last_name)")
          .eq("visit_id", id)
          .order("recorded_at", { ascending: false }),
        supabase
          .from("nursing_notes")
          .select("*, profiles(first_name, last_name)")
          .eq("visit_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("prescriptions")
          .select("*, drugs(name, unit)")
          .eq("visit_id", id)
          .order("prescribed_at", { ascending: false }),
        supabase
          .from("lab_orders")
          .select("*")
          .eq("visit_id", id)
          .order("ordered_at", { ascending: false }),
      ]);

      if (vErr) throw vErr;
      setVisit(v);
      setDiagnosis(v?.diagnosis ?? "");
      setVitals(vitalsData ?? []);
      setNotes(notesData ?? []);
      setPrescriptions(presData ?? []);
      setLabOrders(labData ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveVitals(e) {
    e.preventDefault();
    try {
      setSavingVitals(true);
      const { error } = await supabase.from("vitals").insert({
        visit_id: id,
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
        temperature: "", blood_pressure_systolic: "", blood_pressure_diastolic: "",
        pulse: "", spo2: "", weight: "", notes: "",
      });
      await fetchAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingVitals(false);
    }
  }

  async function handleSaveNote(e) {
    e.preventDefault();
    if (!noteText.trim()) return;
    try {
      setSavingNote(true);
      const { error } = await supabase.from("nursing_notes").insert({
        visit_id: id,
        org_id: orgId,
        nurse_id: profile.id,
        note: noteText.trim(),
      });
      if (error) throw error;
      setNoteText("");
      await fetchAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingNote(false);
    }
  }

  async function handleSaveDiagnosis(e) {
    e.preventDefault();
    try {
      setSavingDiagnosis(true);
      const { error } = await supabase
        .from("visits")
        .update({ diagnosis })
        .eq("id", id)
        .eq("org_id", orgId);
      if (error) throw error;
      await fetchAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingDiagnosis(false);
    }
  }

  async function handleDischarge() {
    if (!window.confirm("Discharge this patient?")) return;
    try {
      setDischargingVisit(true);
      const { error } = await supabase
        .from("visits")
        .update({
          status: "discharged",
          discharged_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("org_id", orgId);
      if (error) throw error;
      await fetchAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setDischargingVisit(false);
    }
  }

  if (loading) return <div className="empty-state">Loading visit…</div>;
  if (error) return <div className="form-error">{error}</div>;
  if (!visit) return <div className="empty-state">Visit not found.</div>;

  const patient = visit.patients;
  const age = patient?.dob ? calculateAge(patient.dob) : null;
  const isActive = visit.status === "active";

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-header__title">
            {patient?.first_name} {patient?.last_name}
          </h1>
          <p className="page-header__subtitle">
            <span className="badge badge--gray">{patient?.mrn}</span>
            <span style={{ marginLeft: 8 }}>
              Visit · {visit.type}
            </span>
            <span style={{ marginLeft: 8 }}>
              · Admitted {formatDate(visit.admitted_at)}
            </span>
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="btn btn--secondary"
            onClick={() => navigate(-1)}
          >
            ← Back
          </button>
          <Link
            to={`/patients/${patient?.id}`}
            className="btn btn--secondary"
          >
            Patient Record
          </Link>
          {isActive && (isOwner || isAdmin || isDoctor) && (
            <button
              className="btn btn--danger"
              disabled={dischargingVisit}
              onClick={handleDischarge}
            >
              {dischargingVisit ? "Discharging…" : "Discharge"}
            </button>
          )}
        </div>
      </div>

      {/* Status banner if discharged */}
      {!isActive && (
        <div className="visit-discharged-banner">
          ✅ Patient discharged on {formatDate(visit.discharged_at)}
        </div>
      )}

      {error && <div className="form-error">{error}</div>}

      {/* Patient summary strip */}
      <div className="visit-summary-strip">
        <SummaryItem label="Age" value={age ? `${age} yrs` : "—"} />
        <SummaryItem label="Gender" value={patient?.gender} capitalize />
        <SummaryItem label="Blood Group" value={patient?.blood_group} />
        <SummaryItem label="Phone" value={patient?.phone} />
        <SummaryItem label="HMO" value={patient?.hmo_plans?.name ?? "None"} />
        <SummaryItem
          label="Doctor"
          value={
            visit.profiles
              ? `Dr. ${visit.profiles.first_name} ${visit.profiles.last_name}`
              : "Not assigned"
          }
        />
        <SummaryItem label="Ward" value={visit.wards?.name ?? "—"} />
        <SummaryItem label="Bed" value={visit.beds?.bed_number ?? "—"} />
        <SummaryItem
          label="Status"
          value={
            <span
              className="badge"
              style={{
                background: isActive ? "#dcfce7" : "#fee2e2",
                color: isActive ? "#15803d" : "#b91c1c",
              }}
            >
              {visit.status}
            </span>
          }
        />
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginTop: 24 }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? "tab--active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
            {tab === "Vitals" && vitals.length > 0 && (
              <span className="tab__badge">{vitals.length}</span>
            )}
            {tab === "Prescriptions" && prescriptions.length > 0 && (
              <span className="tab__badge">{prescriptions.length}</span>
            )}
            {tab === "Lab Orders" && labOrders.length > 0 && (
              <span className="tab__badge">{labOrders.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="card" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: "none" }}>

        {/* Overview */}
        {activeTab === "Overview" && (
          <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
              <div className="form-card__title" style={{ marginBottom: 8 }}>Chief Complaint</div>
              <p style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.6 }}>
                {visit.chief_complaint ?? "—"}
              </p>
            </div>

            {visit.notes && (
              <div>
                <div className="form-card__title" style={{ marginBottom: 8 }}>Admission Notes</div>
                <p style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.6 }}>
                  {visit.notes}
                </p>
              </div>
            )}

            {/* Diagnosis — doctors and owners only */}
            {(isDoctor || isOwner || isAdmin) && (
              <div>
                <div className="form-card__title" style={{ marginBottom: 12 }}>Diagnosis</div>
                <form onSubmit={handleSaveDiagnosis}>
                  <textarea
                    className="input input--textarea"
                    rows={4}
                    placeholder={isActive ? "Enter diagnosis…" : "No diagnosis recorded."}
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    disabled={!isActive}
                  />
                  {isActive && (
                    <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                      <button
                        type="submit"
                        className="btn btn--primary"
                        disabled={savingDiagnosis}
                      >
                        {savingDiagnosis ? "Saving…" : "Save Diagnosis"}
                      </button>
                    </div>
                  )}
                </form>
              </div>
            )}
          </div>
        )}

        {/* Vitals */}
        {activeTab === "Vitals" && (
          <div>
            {/* Record vitals — nurses, doctors, owners */}
            {isActive && (isNurse || isDoctor || isOwner || isAdmin) && (
              <div style={{ padding: 24, borderBottom: "1px solid var(--border)" }}>
                <div className="form-card__title" style={{ marginBottom: 16 }}>Record Vitals</div>
                <form onSubmit={handleSaveVitals}>
                  <div className="form-grid">
                    <div className="form-field">
                      <label className="form-label">Temperature (°C)</label>
                      <input className="input" type="number" step="0.1" placeholder="e.g. 37.5"
                        value={vitalsForm.temperature}
                        onChange={(e) => setVitalsForm((f) => ({ ...f, temperature: e.target.value }))} />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Blood Pressure (mmHg)</label>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input className="input" type="number" placeholder="Systolic"
                          value={vitalsForm.blood_pressure_systolic}
                          onChange={(e) => setVitalsForm((f) => ({ ...f, blood_pressure_systolic: e.target.value }))} />
                        <input className="input" type="number" placeholder="Diastolic"
                          value={vitalsForm.blood_pressure_diastolic}
                          onChange={(e) => setVitalsForm((f) => ({ ...f, blood_pressure_diastolic: e.target.value }))} />
                      </div>
                    </div>
                    <div className="form-field">
                      <label className="form-label">Pulse (bpm)</label>
                      <input className="input" type="number" placeholder="e.g. 72"
                        value={vitalsForm.pulse}
                        onChange={(e) => setVitalsForm((f) => ({ ...f, pulse: e.target.value }))} />
                    </div>
                    <div className="form-field">
                      <label className="form-label">SpO2 (%)</label>
                      <input className="input" type="number" placeholder="e.g. 98"
                        value={vitalsForm.spo2}
                        onChange={(e) => setVitalsForm((f) => ({ ...f, spo2: e.target.value }))} />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Weight (kg)</label>
                      <input className="input" type="number" step="0.1" placeholder="e.g. 70.5"
                        value={vitalsForm.weight}
                        onChange={(e) => setVitalsForm((f) => ({ ...f, weight: e.target.value }))} />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Notes</label>
                      <input className="input" placeholder="Any observations…"
                        value={vitalsForm.notes}
                        onChange={(e) => setVitalsForm((f) => ({ ...f, notes: e.target.value }))} />
                    </div>
                  </div>
                  <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
                    <button type="submit" className="btn btn--primary" disabled={savingVitals}>
                      {savingVitals ? "Saving…" : "Save Vitals"}
                    </button>
                  </div>
                </form>
              </div>
            )}

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
                    <th>Notes</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {vitals.map((v) => (
                    <tr key={v.id}>
                      <td>{formatDateTime(v.recorded_at)}</td>
                      <td>{v.temperature ? `${v.temperature}°C` : "—"}</td>
                      <td>
                        {v.blood_pressure_systolic && v.blood_pressure_diastolic
                          ? `${v.blood_pressure_systolic}/${v.blood_pressure_diastolic}`
                          : "—"}
                      </td>
                      <td>{v.pulse ? `${v.pulse} bpm` : "—"}</td>
                      <td>{v.spo2 ? `${v.spo2}%` : "—"}</td>
                      <td>{v.weight ? `${v.weight} kg` : "—"}</td>
                      <td>{v.notes ?? "—"}</td>
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

        {/* Nursing Notes */}
        {activeTab === "Nursing Notes" && (
          <div>
            {isActive && (isNurse || isDoctor || isOwner || isAdmin) && (
              <div style={{ padding: 24, borderBottom: "1px solid var(--border)" }}>
                <div className="form-card__title" style={{ marginBottom: 12 }}>Add Note</div>
                <form onSubmit={handleSaveNote}>
                  <textarea
                    className="input input--textarea"
                    rows={3}
                    placeholder="Enter nursing note…"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                  />
                  <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
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
            )}
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
                          : "Staff"}
                      </span>
                      <span className="note-item__time">{formatDateTime(n.created_at)}</span>
                    </div>
                    <div className="note-item__text">{n.note}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Prescriptions */}
        {activeTab === "Prescriptions" && (
          <div>
            {isActive && (isDoctor || isOwner || isAdmin) && (
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
                <button
                  className="btn btn--primary"
                  onClick={() => navigate(`/pharmacy/prescriptions/new?visit=${id}`)}
                >
                  + New Prescription
                </button>
              </div>
            )}
            {prescriptions.length === 0 ? (
              <div className="empty-state">No prescriptions yet.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Drug</th>
                    <th>Dosage</th>
                    <th>Frequency</th>
                    <th>Duration</th>
                    <th>Status</th>
                    <th>Prescribed</th>
                  </tr>
                </thead>
                <tbody>
                  {prescriptions.map((p) => (
                    <tr key={p.id}>
                      <td>{p.drugs?.name ?? "—"}</td>
                      <td>{p.dosage ?? "—"}</td>
                      <td>{p.frequency ?? "—"}</td>
                      <td>{p.duration_days ? `${p.duration_days} days` : "—"}</td>
                      <td>
                        <PrescriptionBadge status={p.status} />
                      </td>
                      <td>{formatDateTime(p.prescribed_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Lab Orders */}
        {activeTab === "Lab Orders" && (
          <div>
            {isActive && (isDoctor || isOwner || isAdmin) && (
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
                <button
                  className="btn btn--primary"
                  onClick={() => navigate(`/laboratory/orders/new?visit=${id}`)}
                >
                  + New Lab Order
                </button>
              </div>
            )}
            {labOrders.length === 0 ? (
              <div className="empty-state">No lab orders yet.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Test</th>
                    <th>Status</th>
                    <th>Ordered</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {labOrders.map((l) => (
                    <tr key={l.id}>
                      <td>{l.test_name ?? "—"}</td>
                      <td>
                        <LabStatusBadge status={l.status} />
                      </td>
                      <td>{formatDateTime(l.ordered_at)}</td>
                      <td>{l.result ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Helper components ── */

function SummaryItem({ label, value, capitalize }) {
  return (
    <div className="visit-summary-item">
      <span className="visit-summary-item__label">{label}</span>
      <span
        className="visit-summary-item__value"
        style={capitalize ? { textTransform: "capitalize" } : undefined}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}

function PrescriptionBadge({ status }) {
  const map = {
    pending:   ["badge--yellow", "Pending"],
    dispensed: ["badge--green",  "Dispensed"],
    cancelled: ["badge--red",    "Cancelled"],
  };
  const [cls, label] = map[status] ?? ["badge--gray", status ?? "—"];
  return <span className={`badge ${cls}`}>{label}</span>;
}

function LabStatusBadge({ status }) {
  const map = {
    pending:   ["badge--yellow", "Pending"],
    completed: ["badge--green",  "Completed"],
    cancelled: ["badge--red",    "Cancelled"],
  };
  const [cls, label] = map[status] ?? ["badge--gray", status ?? "—"];
  return <span className={`badge ${cls}`}>{label}</span>;
}

/* ── Helpers ── */

function calculateAge(dob) {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-NG", {
    day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}