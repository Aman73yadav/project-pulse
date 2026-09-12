import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createClient, listClients } from "@/lib/dashboard.functions";
import { readableError } from "@/lib/api-error";
import type { Client } from "@/lib/domain";
import { AppShell } from "@/components/AppShell";
import { useMe } from "@/hooks/useMe";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({
    meta: [
      { title: "Clients — Studio Ops" },
      { name: "description", content: "Agency clients and their contact details." },
      { property: "og:title", content: "Clients — Studio Ops" },
      { property: "og:description", content: "Agency clients and their contact details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClientsPage,
});

function NewClientDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createClient({
        data: {
          name: name.trim(),
          ...(email.trim() ? { contact_email: email.trim() } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        },
      }),
    onSuccess: () => {
      toast.success("Client added");
      setOpen(false);
      setName("");
      setEmail("");
      setNotes("");
      void queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (error) => toast.error(readableError(error)),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> New client
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New client</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="client-name">Name</Label>
            <Input id="client-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client-email">Contact email</Label>
            <Input
              id="client-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client-notes">Notes</Label>
            <Textarea id="client-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={name.trim().length < 2 || create.isPending}
            onClick={() => create.mutate()}
          >
            Add client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClientsPage() {
  const { data: me } = useMe();
  const clients = useQuery({
    queryKey: ["clients"],
    queryFn: () => listClients() as Promise<Client[]>,
  });

  return (
    <AppShell
      title="Clients"
      subtitle="Only admins can add clients — the rule lives in the database."
      actions={me?.role === "admin" ? <NewClientDialog /> : undefined}
    >
      {clients.isLoading ? (
        <Skeleton className="h-56 w-full" />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.data?.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {client.contact_email ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-96 text-sm text-muted-foreground">
                    {client.notes ?? "—"}
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
