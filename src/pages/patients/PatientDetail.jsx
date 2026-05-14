// src/pages/PatientDetail.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

export default function PatientDetail() {
  const { id } = useParams();
  const { orgId } = useAuth();
  const navigate = useNavigate();

  const [patient, setPatient] = useState(null);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!orgId || !id) return;
    fetchPatient();
  }, [orgId, id]);

  async function fetchPatient() {
    setLoading(true);
    try {
      const [{ data: p, error: pErr }, { data: v, error: vErr }] =
        await Promise.all([
          supabase
            .from("patients")
            .select("*, hmo_plans(name)")
            .eq("id", id)
            .eq("org_id", orgId)
            .single(),
          supabase
            .from("visits")
            .select("id, created_at, type, status, notes")
            .eq("patient_id", id)
            .eq("org_id", orgId)
            .order("created_at", { ascending: false })
            .limit(10),
        ]);

      if (pErr) throw pErr;
      if (vErr) throw vErr;

      setPatient(p);
      setVisits(v ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="empty-state">Loading patient…</div>;
  if (error) return <div className="form-error">{error}</div>;
  if (!patient) return <div className="empty-state">Patient not found.</div>;

  const age = patient.dob ? calculateAge(patient.dob) : null;

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-header__title">
            {patient.first_name} {patient.last_name}
          </h1>
          <p className="page-header__subtitle">
            <span className="badge badge--gray">{patient.mrn}</span>
            {age && <span style={{ marginLeft: 8 }}>{age} years old</span>}
            {patient.gender && (
              <span style={{ marginLeft: 8, textTransform: "capitalize" }}>
                · {patient.gender}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="btn btn--secondary"
            onClick={() => navigate("/patients")}
          >
            ← Back
          </button>
          <button
            className="btn btn--secondary"
            onClick={() => navigate(`/patients/${id}/edit`)}
          >
            Edit
          </button>
          <button
            className="btn btn--primary"
            onClick={() => navigate(`/visits/new?patient=${id}`)}
          >
            + New Visit
          </button>
        </div>
      </div>

      <div className="detail-grid">
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Personal info */}
          <div className="form-card">
            <div className="form-card__title">Personal Information</div>
            <div className="info-grid">
              <InfoRow label="Full Name" value={`${patient.first_name} ${patient.last_name}`} />
              <InfoRow label="MRN" value={patient.mrn} />
              <InfoRow label="Date of Birth" value={patient.dob ? formatDate(patient.dob) : null} />
              <InfoRow label="Age" value={age ? `${age} years` : null} />
              <InfoRow label="Gender" value={patient.gender} capitalize />
              <InfoRow label="Blood Group" value={patient.blood_group} />
              <InfoRow label="Phone" value={patient.phone} />
              <InfoRow label="Address" value={patient.address} />
            </div>
          </div>

          {/* HMO */}
          <div className="form-card">
            <div className="form-card__title">HMO Information</div>
            <div className="info-grid">
              <InfoRow
                label="HMO Plan"
                value={
                  patient.hmo_plans?.name ? (
                    <span className="badge badge--blue">
                      {patient.hmo_plans.name}
                    </span>
                  ) : (
                    <span className="badge badge--gray">None</span>
                  )
                }
              />
            </div>
          </div>

          {/* Next of kin */}
          <div className="form-card">
            <div className="form-card__title">Next of Kin</div>
            <div className="info-grid">
              <InfoRow label="Full Name" value={patient.next_of_kin} />
              <InfoRow label="Phone" value={patient.nok_phone} />
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Visit history */}
          <div className="card">
            <div className="card__header">
              <span className="card__title">Visit History</span>
              <button
                className="btn btn--primary"
                style={{ fontSize: 12, padding: "6px 12px" }}
                onClick={() => navigate(`/visits/new?patient=${id}`)}
              >
                + New Visit
              </button>
            </div>
            {visits.length === 0 ? (
              <div className="empty-state">No visits recorded yet.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map((v) => (
                    <tr key={v.id}>
                      <td>{formatDate(v.created_at)}</td>
                      <td style={{ textTransform: "capitalize" }}>
                        {v.visit_type ?? "—"}
                      </td>
                      <td>
                        <VisitStatusBadge status={v.status} />
                      </td>
                      <td>
                        <Link to={`/visits/${v.id}`} className="card__link">
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Prescriptions */}
          <div className="card">
            <div className="card__header">
              <span className="card__title">Prescriptions</span>
            </div>
            <div className="empty-state">
              No prescriptions yet.
            </div>
          </div>

          {/* Lab orders */}
          <div className="card">
            <div className="card__header">
              <span className="card__title">Lab Orders</span>
            </div>
            <div className="empty-state">
              No lab orders yet.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Helper components ── */

function InfoRow({ label, value, capitalize }) {
  return (
    <div className="info-row">
      <span className="info-row__label">{label}</span>
      <span
        className="info-row__value"
        style={capitalize ? { textTransform: "capitalize" } : undefined}
      >
        {value ?? <span className="info-row__empty">—</span>}
      </span>
    </div>
  );
}

function VisitStatusBadge({ status }) {
  const map = {
    active:     ["badge--green",  "Active"],
    discharged: ["badge--gray",   "Discharged"],
    pending:    ["badge--yellow", "Pending"],
    cancelled:  ["badge--red",    "Cancelled"],
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
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}