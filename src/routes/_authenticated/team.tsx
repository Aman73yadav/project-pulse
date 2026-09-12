import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useTeam } from "@/hooks/useMe";
import { RoleBadge } from "@/components/badges";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Team — Studio Ops" },
      { name: "description", content: "Studio members and their access levels." },
      { property: "og:title", content: "Team — Studio Ops" },
      { property: "og:description", content: "Studio members and their access levels." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const team = useTeam();

  return (
    <AppShell title="Team" subtitle="Admins can see everyone in the studio.">
      {team.isLoading ? (
        <Skeleton className="h-56 w-full" />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.data?.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{member.full_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{member.email}</TableCell>
                  <TableCell>
                    <RoleBadge role={member.role} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AppShell>
  );
}
