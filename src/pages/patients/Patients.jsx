// src/pages/patients/Patients.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePatients } from "../../hooks/usePatients";

const PAGE_SIZE = 20;

function calculateAge(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export default function Patients() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page,   setPage]   = useState(1);

  // ← One line. Data comes from cache instantly on revisit.
  const { patients, total, isLoading, isError, error } = usePatients({ search, page, pageSize: PAGE_SIZE });

  const totalPages = Math.ceil(total / PAGE_SIZE);

  function handleSearchChange(e) {
    setSearch(e.target.value);
    setPage(1); // reset to page 1 on new search
  }

  return (
    <div>
      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Patients</h1>
          <p className="page-header__subtitle">
            {total > 0 ? `${total} patient${total !== 1 ? "s" : ""} registered` : "No patients yet"}
          </p>
        </div>
        <button className="btn btn--primary" onClick={() => navigate("/patients/new")}>
          + New Patient
        </button>
      </div>

      {/* ── Filter bar ── */}
      <div className="filter-bar">
        <input
          className="input"
          placeholder="Search by name or MRN…"
          value={search}
          onChange={handleSearchChange}
        />
      </div>

      {/* ── Error ── */}
      {isError && (
        <div className="form-error">{error?.message ?? "Failed to load patients."}</div>
      )}

      {/* ── Table ── */}
      <div className="card" style={{ padding: 0 }}>
        {isLoading && patients.length === 0 ? (
          <div className="empty-state">Loading patients…</div>
        ) : patients.length === 0 ? (
          <div className="empty-state">
            {search ? `No patients matching "${search}".` : "No patients registered yet."}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>MRN</th>
                <th>Age</th>
                <th>Gender</th>
                <th>Phone</th>
                <th>Blood Group</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr
                  key={p.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate(`/patients/${p.id}`)}
                >
                  <td>
                    <Link
                      to={`/patients/${p.id}`}
                      style={{ fontWeight: 600, color: "var(--blue-600)", textDecoration: "none" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {p.first_name} {p.last_name}
                    </Link>
                  </td>
                  <td>
                    <span className="badge badge--gray">{p.mrn}</span>
                  </td>
                  <td>{calculateAge(p.dob) ?? "—"}</td>
                  <td style={{ textTransform: "capitalize" }}>{p.gender ?? "—"}</td>
                  <td>{p.phone ?? "—"}</td>
                  <td>{p.blood_group ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="pagination">
            <button
              className="btn btn--secondary"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Prev
            </button>
            <span className="pagination__info">
              Page {page} of {totalPages} · {total} patients
            </span>
            <button
              className="btn btn--secondary"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}