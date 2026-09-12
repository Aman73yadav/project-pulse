import { queryOptions, useQuery } from "@tanstack/react-query";
import { getMe, listTeam } from "@/lib/dashboard.functions";
import type { TeamMember } from "@/lib/domain";

export const meQueryOptions = queryOptions({
  queryKey: ["me"],
  queryFn: () => getMe() as Promise<TeamMember>,
  staleTime: 60_000,
});

export const teamQueryOptions = queryOptions({
  queryKey: ["team"],
  queryFn: () => listTeam() as Promise<TeamMember[]>,
  staleTime: 60_000,
});

export function useMe() {
  return useQuery(meQueryOptions);
}

export function useTeam(enabled = true) {
  return useQuery({ ...teamQueryOptions, enabled });
}
