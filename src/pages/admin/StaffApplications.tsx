import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Loader2, Search } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { callEdgeFunction } from "@/lib/supabaseEdge";
import {
  STAFF_APPLICATION_POSITIONS,
  STAFF_APPLICATION_STATUSES,
  type StaffApplication,
  type StaffApplicationPosition,
  type StaffApplicationStatus,
} from "@/lib/staff-applications/types";
import { formatStaffAppDate, positionLabels, statusBadgeClass, statusLabels } from "@/lib/staff-applications/ui";

type AdminStaffApplication = StaffApplication & {
  user: { id: string; username: string | null; avatar_url: string | null };
};

type Filters = {
  q: string;
  status: StaffApplicationStatus | "all";
  position: StaffApplicationPosition | "all";
  from: string;
  to: string;
};

const StaffApplications: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<Filters>({
    q: "",
    status: "all",
    position: "all",
    from: "",
    to: "",
  });
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    const channel = supabase
      .channel("admin-staff-applications")
      .on("postgres_changes", { event: "*", schema: "public", table: "staff_applications" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-staff-applications"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.q.trim()) params.set("q", filters.q.trim());
    if (filters.status !== "all") params.set("status", filters.status);
    if (filters.position !== "all") params.set("position", filters.position);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    params.set("limit", "100");
    return params.toString();
  }, [filters]);

  const listQuery = useQuery({
    queryKey: ["admin-staff-applications", filters],
    queryFn: async () =>
      callEdgeFunction<{ applications: AdminStaffApplication[] }>(`admin-staff-applications?${queryString}`),
  });

  const applications = listQuery.data?.applications ?? [];

  const applySearch = () => {
    setFilters((prev) => ({ ...prev, q: searchInput.trim() }));
  };

  const resetFilters = () => {
    setSearchInput("");
    setFilters({ q: "", status: "all", position: "all", from: "", to: "" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold">Staff Applications</h1>
        <p className="text-muted-foreground">Review and manage staff applications in real time.</p>
      </div>

      <Card className="glass-card border-border/30">
        <CardContent className="p-6">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") applySearch();
                    }}
                    className="pl-9"
                    placeholder="Search by username or application/user id"
                  />
                </div>
                <Button type="button" variant="outline" onClick={applySearch}>
                  Apply
                </Button>
              </div>
            </div>

            <Select
              value={filters.status}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, status: value as Filters["status"] }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STAFF_APPLICATION_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {statusLabels[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.position}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, position: value as Filters["position"] }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Position" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All positions</SelectItem>
                {STAFF_APPLICATION_POSITIONS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {positionLabels[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))}
              placeholder="From"
            />
            <Input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))}
              placeholder="To"
            />

            <div className="md:col-span-4 flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetFilters}>
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card border-border/30">
        <CardContent className="p-0">
          {listQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : listQuery.isError ? (
            <div className="p-6 text-sm text-red-500">{(listQuery.error as Error).message}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Edited</TableHead>
                  <TableHead>Revisions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((app) => {
                  const displayName = app.user.username ?? "Unknown";
                  const fallback = displayName.slice(0, 2).toUpperCase();
                  const edited = (app.revision_count ?? 1) > 1;
                  return (
                    <TableRow key={app.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={app.user.avatar_url ?? undefined} />
                            <AvatarFallback>{fallback}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{displayName}</p>
                            <p className="truncate font-mono text-xs text-muted-foreground">{app.user.id}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{positionLabels[app.position]}</TableCell>
                      <TableCell>
                        <Badge className={statusBadgeClass[app.status]}>{statusLabels[app.status]}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatStaffAppDate(app.created_at)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatStaffAppDate(app.last_edited_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{app.revision_count ?? 1}</span>
                          {edited ? <Badge variant="outline">Edited</Badge> : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/admin/staff-applications/${app.id}`)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Open
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {applications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      No applications match the current filters.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StaffApplications;

