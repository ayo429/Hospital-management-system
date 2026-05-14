// src/pages/Visits.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

const PAGE_SIZE = 20;

export default function Visits() {
  const { orgId } = useAuth();
  const navigate = useNavigate();

  const [visits, setVisits] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    fetchVisits();
  }, [orgId, page, statusFilter, search]);

  async function fetchVisits() {
    setLoading(true);
    try {
      let query = supabase
        .from("visits")
        .select(
          `id, type, status, chief_complaint, admitted_at, discharged_at, created_at,
          patients(first_name, last_name, mrn),
          profiles(first_name, last_name)`,
          { count: "exact" }
        )
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (search.trim()) {
        query = query.or(
          `chief_complaint.ilike.%${search}%`
        );
      }

      const { data, count, error } = await query;
      if (error) throw error;
      setVisits(data ?? []);
      setTotalCount(count ?? 0);
    } catch (err) {
      console.error("Error fetching visits:", err.message);
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Visits</h1>
          <p className="page-header__subtitle">
            {totalCount.toLocaleString()} total visits
          </p>
        </div>
        <button
          className="btn btn--primary"
          onClick={() => navigate("/visits/new")}
        >
          + New Visit
        </button>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <input
          type="text"
          className="input"
          placeholder="Search by complaint…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        />
        <select
          className="input"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="discharged">Discharged</option>
          <option value="pending">Pending</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : visits.length === 0 ? (
          <div className="empty-state">
            No visits found.{" "}
            <Link to="/visits/new">Create the first one →</Link>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>MRN</th>
                <th>Type</th>
                <th>Chief Complaint</th>
                <th>Doctor</th>
                <th>Admitted</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => (
                <tr key={v.id}>
                  <td>
                    <strong>
                      {v.patients?.first_name} {v.patients?.last_name}
                    </strong>
                  </td>
                  <td>
                    <span className="badge badge--gray">
                      {v.patients?.mrn ?? "—"}
                    </span>
                  </td>
                  <td style={{ textTransform: "capitalize" }}>
                    {v.type ?? "—"}
                  </td>
                  <td>{v.chief_complaint ?? "—"}</td>
                  <td>
                    {v.profiles
                      ? `${v.profiles.first_name} ${v.profiles.last_name}`
                      : "—"}
                  </td>
                  <td>{formatDate(v.admitted_at ?? v.created_at)}</td>
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

/* ── Helper components ── */

function VisitStatusBadge({ status }) {
  const map = {
    active:     { bg: "#dcfce7", color: "#15803d", label: "Active" },
    discharged: { bg: "#fee2e2", color: "#b91c1c", label: "Discharged" },
    pending:    { bg: "#fef9c3", color: "#a16207", label: "Pending" },
    cancelled:  { bg: "#f1f5f9", color: "#475569", label: "Cancelled" },
  };
  const s = map[status] ?? { bg: "#f1f5f9", color: "#475569", label: status ?? "—" };
  return (
    <span
      className="badge"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
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