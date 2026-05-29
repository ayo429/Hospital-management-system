// src/hooks/usePatients.js
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export function usePatients({ search = "", page = 1, pageSize = 20 } = {}) {
  const { orgId } = useAuth();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["patients", orgId, search, page],
    queryFn: async () => {
      let query = supabase
        .from("patients")
        .select("id, first_name, last_name, mrn, dob, gender, phone, blood_group, created_at", { count: "exact" })
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (search.trim()) {
        query = query.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,mrn.ilike.%${search}%`
        );
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { patients: data ?? [], total: count ?? 0 };
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 2, // 2 min — data is fresh, no refetch on revisit
    placeholderData: (prev) => prev, // keep showing old data while new page loads
  });

  // Call this after creating/editing/deleting a patient to bust the cache
  const queryClient = useQueryClient();
  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["patients", orgId] });
  }

  return {
    patients:  data?.patients ?? [],
    total:     data?.total    ?? 0,
    isLoading,
    isError,
    error,
    invalidate,
  };
}