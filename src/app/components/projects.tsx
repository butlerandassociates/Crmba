import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Plus, Search, Calendar, Users, Edit, Mail, FileText, DollarSign, MoveRight, UserPlus, Loader2 } from "lucide-react";
import { projectsAPI } from "../utils/api";
import { Link } from "react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export function Projects() {
  const [searchQuery, setSearchQuery] = useState("");
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch projects from API on mount
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        const data = await projectsAPI.getAll();
        setProjects(data);
        setError(null);
      } catch (err: any) {
        console.error("Failed to fetch projects:", err);
        setError(err.message || "Failed to load projects");
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  const filteredProjects = projects.filter(
    (project) =>
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.projectManagerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500";
      case "prospect":
        return "bg-blue-500";
      case "selling":
        return "bg-orange-500";
      case "sold":
        return "bg-purple-500";
      case "completed":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const filterByStatus = (status?: string) => {
    if (!status) return filteredProjects;
    return filteredProjects.filter((p) => p.status === status);
  };

  const ProjectTable = ({ projects }: { projects: typeof projects }) => (
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
                <Badge className={`${getStatusColor(project.status)} text-xs`}>
                  {project.status.replace("_", " ")}
                </Badge>
              </td>
              <td className="p-3">
                <Link
                  to={`/projects/${project.id}`}
                  className="font-semibold text-sm hover:text-primary"
                >
                  {project.name}
                </Link>
              </td>
              <td className="p-3">
                <span className="text-sm">{project.clientName}</span>
              </td>
              <td className="p-3">
                <div className="space-y-0.5 text-xs">
                  <div className="text-muted-foreground">PM: {project.projectManagerName}</div>
                  <div className="text-muted-foreground">FM: {project.foremanName}</div>
                </div>
              </td>
              <td className="p-3">
                <div className="text-xs space-y-0.5">
                  <div>{formatDate(project.startDate)}</div>
                  {project.endDate && <div className="text-muted-foreground">{formatDate(project.endDate)}</div>}
                </div>
              </td>
              <td className="p-3">
                <div className="text-sm font-semibold">{formatCurrency(project.totalValue)}</div>
              </td>
              <td className="p-3">
                <div className="text-sm font-semibold text-green-600">
                  {formatCurrency(project.grossProfit)}
                </div>
              </td>
              <td className="p-3">
                <div className="text-sm font-medium">{project.profitMargin.toFixed(1)}%</div>
              </td>
              <td className="p-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="default" size="sm">
                      Actions
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Project Actions</DropdownMenuLabel>
                    <DropdownMenuItem>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Project
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Assign Team Members
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Users className="h-4 w-4 mr-2" />
                      View Client
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <DollarSign className="h-4 w-4 mr-2" />
                      Create Invoice
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Move to Stage</DropdownMenuLabel>
                    <DropdownMenuItem>
                      <MoveRight className="h-4 w-4 mr-2" />
                      Prospect
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <MoveRight className="h-4 w-4 mr-2" />
                      Selling
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <MoveRight className="h-4 w-4 mr-2" />
                      Sold
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <MoveRight className="h-4 w-4 mr-2" />
                      Active
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <MoveRight className="h-4 w-4 mr-2" />
                      Completed
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your construction projects</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center p-12">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">Loading projects from database...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">
            <strong>Error:</strong> {error}
          </p>
        </div>
      )}

      {!loading && !error && (
        <Tabs defaultValue="all">
          <TabsList className="w-full">
            <TabsTrigger value="all">All ({filteredProjects.length})</TabsTrigger>
            <TabsTrigger value="prospect">
              Prospect ({filterByStatus("prospect").length})
            </TabsTrigger>
            <TabsTrigger value="selling">
              Selling ({filterByStatus("selling").length})
            </TabsTrigger>
            <TabsTrigger value="sold">
              Sold ({filterByStatus("sold").length})
            </TabsTrigger>
            <TabsTrigger value="active">
              Active ({filterByStatus("active").length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed ({filterByStatus("completed").length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <>
                  <ProjectTable projects={filteredProjects} />
                  {filteredProjects.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">No projects found</p>
                    </div>
                  )}
                </>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="prospect" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <ProjectTable projects={filterByStatus("prospect")} />
                {filterByStatus("prospect").length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No prospect projects</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="selling" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <ProjectTable projects={filterByStatus("selling")} />
                {filterByStatus("selling").length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No selling projects</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sold" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <ProjectTable projects={filterByStatus("sold")} />
                {filterByStatus("sold").length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No sold projects</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="active" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <ProjectTable projects={filterByStatus("active")} />
                {filterByStatus("active").length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No active projects</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="completed" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <ProjectTable projects={filterByStatus("completed")} />
                {filterByStatus("completed").length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No completed projects</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}