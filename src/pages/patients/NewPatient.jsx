// src/pages/NewPatient.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

function getInitials(name) {
  if (!name) return "MCH";
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .join("");
}

async function generateMRN(orgId, orgName) {
  const initials = getInitials(orgName);
  const year = new Date().getFullYear();

  const { count } = await supabase
    .from("patients")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);

  const next = String((count ?? 0) + 1).padStart(5, "0");
  return `${initials}-${year}-${next}`;
}

const EMPTY_FORM = {
  first_name: "",
  last_name: "",
  dob: "",
  gender: "",
  phone: "",
  address: "",
  blood_group: "",
  hmo_plan_id: "",
  next_of_kin: "",
  nok_phone: "",
};

export default function NewPatient() {
  const { orgId, org } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [hmoPlans, setHmoPlans] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!orgId) return;
    supabase
      .from("hmo_plans")
      .select("id, name")
      .eq("org_id", orgId)
      .then(({ data }) => setHmoPlans(data ?? []));
  }, [orgId]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError("First name and last name are required.");
      return;
    }
    if (!form.gender) {
      setError("Please select a gender.");
      return;
    }

    try {
      setSaving(true);
      const mrn = await generateMRN(orgId, org?.name);

      const payload = {
        org_id: orgId,
        mrn,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        dob: form.dob || null,
        gender: form.gender,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        blood_group: form.blood_group || null,
        hmo_plan_id: form.hmo_plan_id || null,
        next_of_kin: form.next_of_kin.trim() || null,
        nok_phone: form.nok_phone.trim() || null,
      };

      const { data, error: insertError } = await supabase
        .from("patients")
        .insert(payload)
        .select("id")
        .single();

      if (insertError) throw insertError;

      navigate(`/patients/${data.id}`);
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
          <h1 className="page-header__title">Register New Patient</h1>
          <p className="page-header__subtitle">
            MRN will be generated automatically
          </p>
        </div>
        <button
          className="btn btn--secondary"
          onClick={() => navigate("/patients")}
        >
          ← Back
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {error && <div className="form-error">{error}</div>}

        {/* Personal Information */}
        <div className="form-card">
          <div className="form-card__title">Personal Information</div>
          <div className="form-grid">
            <div className="form-field">
              <label className="form-label">First Name *</label>
              <input
                className="input"
                name="first_name"
                value={form.first_name}
                onChange={handleChange}
                placeholder="e.g. Emeka"
              />
            </div>
            <div className="form-field">
              <label className="form-label">Last Name *</label>
              <input
                className="input"
                name="last_name"
                value={form.last_name}
                onChange={handleChange}
                placeholder="e.g. Okafor"
              />
            </div>
            <div className="form-field">
              <label className="form-label">Date of Birth</label>
              <input
                className="input"
                type="date"
                name="dob"
                value={form.dob}
                onChange={handleChange}
              />
            </div>
            <div className="form-field">
              <label className="form-label">Gender *</label>
              <select
                className="input"
                name="gender"
                value={form.gender}
                onChange={handleChange}
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-field">
              <label className="form-label">Phone</label>
              <input
                className="input"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="e.g. 08012345678"
              />
            </div>
            <div className="form-field">
              <label className="form-label">Blood Group</label>
              <select
                className="input"
                name="blood_group"
                value={form.blood_group}
                onChange={handleChange}
              >
                <option value="">Select blood group</option>
                {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(
                  (bg) => (
                    <option key={bg} value={bg}>
                      {bg}
                    </option>
                  )
                )}
              </select>
            </div>
            <div className="form-field form-field--full">
              <label className="form-label">Address</label>
              <textarea
                className="input input--textarea"
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="Street, city, state"
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* HMO */}
        <div className="form-card">
          <div className="form-card__title">HMO Information</div>
          <div className="form-grid">
            <div className="form-field">
              <label className="form-label">HMO Plan</label>
              <select
                className="input"
                name="hmo_plan_id"
                value={form.hmo_plan_id}
                onChange={handleChange}
              >
                <option value="">No HMO</option>
                {hmoPlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Next of Kin */}
        <div className="form-card">
          <div className="form-card__title">Next of Kin</div>
          <div className="form-grid">
            <div className="form-field">
              <label className="form-label">Full Name</label>
              <input
                className="input"
                name="next_of_kin"
                value={form.next_of_kin}
                onChange={handleChange}
                placeholder="e.g. Ngozi Okafor"
              />
            </div>
            <div className="form-field">
              <label className="form-label">Phone</label>
              <input
                className="input"
                name="nok_phone"
                value={form.nok_phone}
                onChange={handleChange}
                placeholder="e.g. 08098765432"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="form-actions">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => navigate("/patients")}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? "Saving…" : "Register Patient"}
          </button>
        </div>
      </form>
    </div>
  );
}