import { useState, useEffect } from "react";
import { useRealtimeRefetch } from "../hooks/useRealtimeRefetch";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import {
  Plus, Search, Edit, Users, DollarSign, Loader2, Trash2,
} from "lucide-react";
import { projectsAPI } from "../utils/api";
import { Link, useNavigate } from "react-router";
import { NewProjectDialog } from "./new-project-dialog";
import { EditProjectDialog } from "./edit-project-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

const STAGES = ["prospect", "selling", "sold", "active", "completed"] as const;
type Stage = (typeof STAGES)[number];

export function Projects() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialogs
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [editProject, setEditProject] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  const reload = () => {
    setLoading(true);
    projectsAPI
      .getAll()
      .then((data) => { setProjects(data); setError(null); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);
  useRealtimeRefetch(reload, ["projects", "clients"], "projects");

  const filteredProjects = projects.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      (p.name ?? "").toLowerCase().includes(q) ||
      (p.clientName ?? "").toLowerCase().includes(q) ||
      (p.projectManagerName ?? "").toLowerCase().includes(q)
    );
  });

  const filterByStatus = (status?: string) =>
    status ? filteredProjects.filter((p) => p.status === status) : filteredProjects;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":     return "bg-green-500";
      case "prospect":   return "bg-blue-500";
      case "selling":    return "bg-orange-500";
      case "sold":       return "bg-purple-500";
      case "completed":  return "bg-gray-500";
      default:           return "bg-gray-400";
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(value);

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const moveToStage = async (project: any, stage: Stage) => {
    if (project.status === stage) return;
    // Optimistic update
    setProjects((prev) => prev.map((p) => p.id === project.id ? { ...p, status: stage } : p));
    try {
      await projectsAPI.update(project.id, { status: stage });
    } catch {
      reload(); // revert on failure
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await projectsAPI.delete(deleteTarget.id);
      setDeleteTarget(null);
      reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const ProjectTable = ({ projects }: { projects: any[] }) => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
            <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Project</th>
            <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Client</th>
            <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Team</th>
            <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Timeline</th>
            <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Value</th>
            <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Profit</th>
            <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Margin</th>
            <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {projects.map((project) => (
            <tr key={project.id} className="hover:bg-accent/50 transition-colors">
              <td className="p-3">
                <Badge className={`${getStatusColor(project.status)} text-white text-xs`}>
                  {project.status.replace("_", " ")}
                </Badge>
              </td>
              <td className="p-3">
                <span className="font-semibold text-sm">{project.name}</span>
              </td>
              <td className="p-3">
                {project.client_id ? (
                  <Link
                    to={`/clients?stage=${project.status ?? "active"}`}
                    className="text-sm hover:text-primary hover:underline"
                  >
                    {project.clientName || "—"}
                  </Link>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </td>
              <td className="p-3">
                <div className="space-y-0.5 text-xs text-muted-foreground">
                  <div>PM: {project.projectManagerName || "—"}</div>
                  <div>FM: {project.foremanName || "—"}</div>
                </div>
              </td>
              <td className="p-3">
                <div className="text-xs space-y-0.5">
                  <div>{formatDate(project.startDate)}</div>
                  {project.endDate && (
                    <div className="text-muted-foreground">{formatDate(project.endDate)}</div>
                  )}
                </div>
              </td>
              <td className="p-3">
                <div className="text-sm font-semibold">{formatCurrency(project.totalValue ?? 0)}</div>
              </td>
              <td className="p-3">
                <div className="text-sm font-semibold text-green-600">
                  {formatCurrency(project.grossProfit ?? 0)}
                </div>
              </td>
              <td className="p-3">
                <div className="text-sm font-medium">{(project.profitMargin ?? 0).toFixed(1)}%</div>
              </td>
              <td className="p-3">
                <div className="flex items-center gap-2">
                  {/* Stage picker — no icon, just names */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="text-xs">
                        Stage
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-36">
                      {STAGES.map((stage) => (
                        <DropdownMenuItem
                          key={stage}
                          onClick={() => moveToStage(project, stage)}
                          disabled={project.status === stage}
                          className={project.status === stage ? "font-semibold" : ""}
                        >
                          {stage.charAt(0).toUpperCase() + stage.slice(1)}
                          {project.status === stage && " ✓"}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="default" size="sm" className="text-xs">
                        Actions
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={() => setEditProject(project)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Project
                      </DropdownMenuItem>
                      {project.client_id && (
                        <DropdownMenuItem onClick={() => navigate(`/clients/${project.client_id}`)}>
                          <Users className="h-4 w-4 mr-2" />
                          View Client
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem disabled>
                        <DollarSign className="h-4 w-4 mr-2" />
                        Create Invoice
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeleteTarget(project)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const EmptyState = ({ label }: { label: string }) => (
    <div className="text-center py-12">
      <p className="text-muted-foreground">{label}</p>
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your construction projects</p>
        </div>
        <Button onClick={() => setNewProjectOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search projects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading && (
        <div className="flex items-center justify-center p-12">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">Loading projects...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800"><strong>Error:</strong> {error}</p>
        </div>
      )}

      {/* New Project Dialog */}
      <NewProjectDialog
        open={newProjectOpen}
        onOpenChange={setNewProjectOpen}
        onCreated={reload}
      />

      {editProject && (
        <EditProjectDialog
          open={!!editProject}
          onOpenChange={(open) => { if (!open) setEditProject(null); }}
          project={editProject}
          onSaved={() => { setEditProject(null); reload(); }}
        />
      )}

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tabs */}
      {!loading && !error && (
        <Tabs defaultValue="all">
          <TabsList className="w-full">
            <TabsTrigger value="all">All ({filteredProjects.length})</TabsTrigger>
            <TabsTrigger value="prospect">Prospect ({filterByStatus("prospect").length})</TabsTrigger>
            <TabsTrigger value="selling">Selling ({filterByStatus("selling").length})</TabsTrigger>
            <TabsTrigger value="sold">Sold ({filterByStatus("sold").length})</TabsTrigger>
            <TabsTrigger value="active">Active ({filterByStatus("active").length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({filterByStatus("completed").length})</TabsTrigger>
          </TabsList>

          {[
            { value: "all",       data: filteredProjects,          empty: "No projects found" },
            { value: "prospect",  data: filterByStatus("prospect"), empty: "No prospect projects" },
            { value: "selling",   data: filterByStatus("selling"),  empty: "No selling projects" },
            { value: "sold",      data: filterByStatus("sold"),     empty: "No sold projects" },
            { value: "active",    data: filterByStatus("active"),   empty: "No active projects" },
            { value: "completed", data: filterByStatus("completed"),empty: "No completed projects" },
          ].map(({ value, data, empty }) => (
            <TabsContent key={value} value={value} className="mt-4">
              <Card>
                <CardContent className="p-0">
                  {data.length > 0 ? <ProjectTable projects={data} /> : <EmptyState label={empty} />}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
