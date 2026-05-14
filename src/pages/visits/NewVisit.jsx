// src/pages/NewVisit.jsx
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

export default function NewVisit() {
  const { orgId, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedPatientId = searchParams.get("patient");

  const [form, setForm] = useState({
    patient_id: preselectedPatientId ?? "",
    visit_type_id: "",
    chief_complaint: "",
    notes: "",
    attending_doctor_id: "",
  });

  const [patients, setPatients] = useState([]);
  const [visitTypes, setVisitTypes] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [patientSearch, setPatientSearch] = useState("");
  const [preselectedPatient, setPreselectedPatient] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Fetch visit types and doctors on mount
  useEffect(() => {
    if (!orgId) return;
    fetchInitialData();
  }, [orgId]);

  // Fetch preselected patient name if coming from PatientDetail
  useEffect(() => {
    if (!preselectedPatientId || !orgId) return;
    supabase
      .from("patients")
      .select("id, first_name, last_name, mrn")
      .eq("id", preselectedPatientId)
      .eq("org_id", orgId)
      .single()
      .then(({ data }) => {
        if (data) setPreselectedPatient(data);
      });
  }, [preselectedPatientId, orgId]);

  // Search patients as user types
  useEffect(() => {
    if (!orgId || preselectedPatientId) return;
    if (!patientSearch.trim()) {
      setPatients([]);
      return;
    }
    const timeout = setTimeout(() => searchPatients(patientSearch), 350);
    return () => clearTimeout(timeout);
  }, [patientSearch, orgId]);

  async function fetchInitialData() {
    const [{ data: vt }, { data: docs }] = await Promise.all([
      supabase
        .from("visit_types")
        .select("id, name, requires_bed, requires_lab, requires_hmo")
        .eq("org_id", orgId)
        .order("name"),
      supabase
        .from("profiles")
        .select("id, first_name, last_name, role")
        .eq("org_id", orgId)
        .eq("role", "doctor"),
    ]);
    setVisitTypes(vt ?? []);
    setDoctors(docs ?? []);
  }

  async function searchPatients(q) {
    const { data } = await supabase
      .from("patients")
      .select("id, first_name, last_name, mrn")
      .eq("org_id", orgId)
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,mrn.ilike.%${q}%`)
      .limit(8);
    setPatients(data ?? []);
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));

    if (name === "visit_type_id") {
      const type = visitTypes.find((t) => t.id === value);
      setSelectedType(type ?? null);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!form.patient_id) {
      setError("Please select a patient.");
      return;
    }
    if (!form.visit_type_id) {
      setError("Please select a visit type.");
      return;
    }
    if (!form.chief_complaint.trim()) {
      setError("Chief complaint is required.");
      return;
    }

    try {
      setSaving(true);

      const standardTypes = [
        "outpatient",
        "inpatient",
        "emergency",
        "day case",
        "antenatal",
      ];
      const selectedVisitType = visitTypes.find(
        (t) => t.id === form.visit_type_id,
      );
      const typeName = selectedVisitType?.name?.toLowerCase() ?? "custom";

      const { data, error: insertError } = await supabase
        .from("visits")
        .insert({
          org_id: orgId,
          patient_id: form.patient_id,
          visit_type_id: form.visit_type_id || null,
          type: standardTypes.includes(typeName) ? typeName : "custom",
          chief_complaint: form.chief_complaint.trim(),
          notes: form.notes.trim() || null,
          attending_doctor_id: form.attending_doctor_id || null,
          status: "active",
          admitted_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      navigate(`/visits/${data.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-header__title">New Visit</h1>
          <p className="page-header__subtitle">
            Admit a patient and start a visit record
          </p>
        </div>
        <button
          className="btn btn--secondary"
          onClick={() => navigate("/visits")}
        >
          ← Back
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {error && <div className="form-error">{error}</div>}

        {/* Patient selection */}
        <div className="form-card">
          <div className="form-card__title">Patient</div>
          {preselectedPatient ? (
            <div className="selected-patient">
              <div className="selected-patient__info">
                <strong>
                  {preselectedPatient.first_name} {preselectedPatient.last_name}
                </strong>
                <span className="badge badge--gray" style={{ marginLeft: 8 }}>
                  {preselectedPatient.mrn}
                </span>
              </div>
              <button
                type="button"
                className="btn btn--secondary"
                style={{ fontSize: 12, padding: "4px 10px" }}
                onClick={() => {
                  setPreselectedPatient(null);
                  setForm((f) => ({ ...f, patient_id: "" }));
                  navigate("/visits/new");
                }}
              >
                Change
              </button>
            </div>
          ) : (
            <div className="form-field">
              <label className="form-label">Search Patient</label>
              <input
                className="input"
                placeholder="Type name or MRN…"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
              />
              {patients.length > 0 && (
                <div className="patient-dropdown">
                  {patients.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="patient-dropdown__item"
                      onClick={() => {
                        setForm((f) => ({ ...f, patient_id: p.id }));
                        setPatientSearch(
                          `${p.first_name} ${p.last_name} (${p.mrn})`,
                        );
                        setPatients([]);
                      }}
                    >
                      <strong>
                        {p.first_name} {p.last_name}
                      </strong>
                      <span
                        className="badge badge--gray"
                        style={{ marginLeft: 8 }}
                      >
                        {p.mrn}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Visit details */}
        <div className="form-card">
          <div className="form-card__title">Visit Details</div>
          <div className="form-grid">
            <div className="form-field">
              <label className="form-label">Visit Type *</label>
              <select
                className="input"
                name="visit_type_id"
                value={form.visit_type_id}
                onChange={handleChange}
              >
                <option value="">Select visit type</option>
                {visitTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label className="form-label">Attending Doctor</label>
              <select
                className="input"
                name="attending_doctor_id"
                value={form.attending_doctor_id}
                onChange={handleChange}
              >
                <option value="">Not assigned</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    Dr. {d.first_name} {d.last_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field form-field--full">
              <label className="form-label">Chief Complaint *</label>
              <input
                className="input"
                name="chief_complaint"
                value={form.chief_complaint}
                onChange={handleChange}
                placeholder="e.g. Fever and headache for 3 days"
              />
            </div>

            <div className="form-field form-field--full">
              <label className="form-label">Notes</label>
              <textarea
                className="input input--textarea"
                name="notes"
                value={form.notes}
                onChange={handleChange}
                placeholder="Any additional notes…"
                rows={3}
              />
            </div>
          </div>

          {/* Visit type flags */}
          {selectedType && (
            <div className="visit-flags">
              {selectedType.requires_bed && (
                <span className="visit-flag visit-flag--blue">
                  🛏 Requires Bed
                </span>
              )}
              {selectedType.requires_lab && (
                <span className="visit-flag visit-flag--yellow">
                  🧪 Requires Lab
                </span>
              )}
              {selectedType.requires_hmo && (
                <span className="visit-flag visit-flag--green">
                  🏛 Requires HMO
                </span>
              )}
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="form-actions">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => navigate("/visits")}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? "Saving…" : "Start Visit"}
          </button>
        </div>
      </form>
    </div>
  );
}
