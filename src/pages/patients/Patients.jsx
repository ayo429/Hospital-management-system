// src/pages/Patients.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

const PAGE_SIZE = 20;

export default function Patients() {
  const { orgId } = useAuth();
  const navigate = useNavigate();

  const [patients, setPatients] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [hmoFilter, setHmoFilter] = useState("all");
  const [hmoPlans, setHmoPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch HMO plans once for the filter dropdown
  useEffect(() => {
    if (!orgId) return;
    supabase
      .from("hmo_plans")
      .select("id, name")
      .eq("org_id", orgId)
      .then(({ data }) => setHmoPlans(data ?? []));
  }, [orgId]);

  // Fetch patients whenever page, search, or filter changes
  useEffect(() => {
    if (!orgId) return;
    fetchPatients();
  }, [orgId, page, search, hmoFilter]);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("patients")
        .select(
          "id, first_name, last_name, phone, gender, dob, mrn, hmo_plan_id, hmo_plans(name), created_at",
          { count: "exact" }
        )
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (search.trim()) {
        query = query.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%,mrn.ilike.%${search}%`
        );
      }

      if (hmoFilter !== "all") {
        if (hmoFilter === "none") {
          query = query.is("hmo_plan_id", null);
        } else {
          query = query.eq("hmo_plan_id", hmoFilter);
        }
      }

      const { data, count, error } = await query;
      if (error) throw error;
      setPatients(data ?? []);
      setTotalCount(count ?? 0);
    } catch (err) {
      console.error("Error fetching patients:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(0); // reset to first page on new search
  };

  const handleHmoFilterChange = (e) => {
    setHmoFilter(e.target.value);
    setPage(0);
  };

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Patients</h1>
          <p className="page-header__subtitle">
            {totalCount.toLocaleString()} total patients
          </p>
        </div>
        <button
          className="btn btn--primary"
          onClick={() => navigate("/patients/new")}
        >
          + New Patient
        </button>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <input
          type="text"
          className="input"
          placeholder="Search by name, phone or MRN…"
          value={search}
          onChange={handleSearchChange}
        />
        <select
          className="input"
          value={hmoFilter}
          onChange={handleHmoFilterChange}
        >
          <option value="all">All HMO</option>
          <option value="none">No HMO</option>
          {hmoPlans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : patients.length === 0 ? (
          <div className="empty-state">
            No patients found.{" "}
            <Link to="/patients/new">Register the first one →</Link>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>MRN</th>
                <th>Name</th>
                <th>Gender</th>
                <th>Phone</th>
                <th>HMO Plan</th>
                <th>Registered</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id}>
                  <td>
                    <span className="badge badge--gray">{p.mrn ?? "—"}</span>
                  </td>
                  <td>
                    <strong>
                      {p.first_name} {p.last_name}
                    </strong>
                  </td>
                  <td>{p.gender ?? "—"}</td>
                  <td>{p.phone ?? "—"}</td>
                  <td>
                    {p.hmo_plans?.name ? (
                      <span className="badge badge--blue">
                        {p.hmo_plans.name}
                      </span>
                    ) : (
                      <span className="badge badge--gray">None</span>
                    )}
                  </td>
                  <td>{formatDate(p.created_at)}</td>
                  <td>
                    <Link
                      to={`/patients/${p.id}`}
                      className="card__link"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <button
              className="btn btn--secondary"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0}
            >
              ← Prev
            </button>
            <span className="pagination__info">
              Page {page + 1} of {totalPages}
            </span>
            <button
              className="btn btn--secondary"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages - 1}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Helpers ── */

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}