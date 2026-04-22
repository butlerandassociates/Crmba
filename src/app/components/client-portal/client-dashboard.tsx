import { useState, useEffect } from "react";
import { formatCurrency } from "@/app/utils/format";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { projectsAPI } from "../../utils/api";
import {
  FileText,
  DollarSign,
  Clock,
  FolderOpen,
} from "lucide-react";
import { PageLoader, SkeletonCards, SkeletonList } from "../ui/page-loader";

const STATUS_COLORS: Record<string, string> = {
  active:    "bg-green-500",
  selling:   "bg-blue-500",
  sold:      "bg-purple-500",
  completed: "bg-emerald-600",
  on_hold:   "bg-yellow-500",
  cancelled: "bg-red-500",
  planning:  "bg-sky-500",
};

export function ClientDashboard() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    projectsAPI.getAll()
      .then(setProjects)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);


  const formatDate = (dateStr: string | null) =>
    dateStr
      ? new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "TBD";

  const activeProjects = projects.filter((p) => ["active", "selling", "sold"].includes(p.status));
  const totalRevenue   = projects.reduce((s, p) => s + (p.totalValue || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="h-8 w-40 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-64 bg-gray-100 rounded animate-pulse mt-2" />
          </div>
        </div>
        <div className="max-w-7xl mx-auto p-4 space-y-4">
          <SkeletonCards count={3} />
          <SkeletonList rows={5} />
          <PageLoader title="Loading your portal…" description="Fetching your projects, contracts & invoices" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Client Portal</h1>
              <p className="text-sm text-muted-foreground mt-1">Butler &amp; Associates Construction, Inc.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Total Projects
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold">{projects.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Active Projects
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-blue-600">{activeProjects.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Total Contract Value
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="projects" className="w-full">
          <TabsList>
            <TabsTrigger value="projects">Projects ({projects.length})</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="contracts">Contracts</TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="mt-4 space-y-4">
            {projects.length === 0 && (
              <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
                <FolderOpen className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">No projects yet</p>
                <p className="text-xs mt-1">Your projects will appear here once work has begun.</p>
              </div>
            )}
            {projects.map((project) => (
              <Card key={project.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{project.name || "Unnamed Project"}</CardTitle>
                        <Badge className={STATUS_COLORS[project.status] ?? "bg-gray-500"}>
                          {(project.status ?? "").replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{project.clientName}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground">Project Manager</div>
                      <div className="text-sm font-medium mt-1">{project.projectManagerName || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Foreman</div>
                      <div className="text-sm font-medium mt-1">{project.foremanName || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Start Date</div>
                      <div className="text-sm font-medium mt-1">{formatDate(project.start_date)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">End Date</div>
                      <div className="text-sm font-medium mt-1">{formatDate(project.end_date)}</div>
                    </div>
                  </div>
                  <div className="pt-3 border-t flex items-center justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground">Contract Value</div>
                      <div className="text-lg font-bold mt-1">{formatCurrency(project.totalValue || 0)}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="invoices" className="mt-4">
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground text-sm">
                Invoice management coming soon.
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contracts" className="mt-4">
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground text-sm">
                Contract management coming soon.
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
