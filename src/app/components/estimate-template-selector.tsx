import { useParams, Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  ArrowLeft,
  FileText,
  Hammer,
  Home,
  Trees,
  Droplets,
  Lightbulb,
  ArrowRight,
} from "lucide-react";
import { estimateTemplates } from "../data/estimate-templates";
import { mockClients } from "../data/mock-data";

const categoryIcons: Record<string, any> = {
  Concrete: Hammer,
  'Outdoor Kitchen': Home,
  Structures: Home,
  Landscaping: Trees,
  Drainage: Droplets,
  Lighting: Lightbulb,
};

export function EstimateTemplateSelector() {
  const { clientId } = useParams();
  const client = mockClients.find((c) => c.id === clientId);

  if (!client) {
    return (
      <div className="p-4">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold">Client not found</h2>
          <Link to="/clients">
            <Button className="mt-4">Back to Clients</Button>
          </Link>
        </div>
      </div>
    );
  }

  const groupedTemplates = estimateTemplates.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, typeof estimateTemplates>);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={`/clients/${clientId}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Client
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Create Proposal</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{client.name}</p>
          </div>
        </div>
        <Link to="/admin/estimate-templates">
          <Button variant="outline" size="sm">
            Manage Templates
          </Button>
        </Link>
      </div>

      <div className="space-y-6">
        {Object.entries(groupedTemplates).map(([category, templates]) => {
          const Icon = categoryIcons[category] || FileText;
          
          return (
            <div key={category}>
              <div className="flex items-center gap-2 mb-3">
                <Icon className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">{category}</h2>
                <Badge variant="outline">{templates.length}</Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((template) => (
                  <Card
                    key={template.id}
                    className="hover:shadow-md transition-shadow cursor-pointer group"
                  >
                    <Link to={`/clients/${clientId}/estimate/${template.id}`}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center justify-between">
                          {template.name}
                          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-3">
                          {template.description}
                        </p>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {template.steps.length} steps
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            Guided
                          </Badge>
                        </div>
                      </CardContent>
                    </Link>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick/Simple Proposal Option */}
      <div className="border-t pt-6">
        <h2 className="text-lg font-semibold mb-3">Other Options</h2>
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <Link to={`/clients/${clientId}/proposal/new`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Blank Proposal
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Create a custom proposal from scratch without the guided workflow
              </p>
            </CardContent>
          </Link>
        </Card>
      </div>
    </div>
  );
}
