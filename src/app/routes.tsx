import { createBrowserRouter } from "react-router";
import { RootLayout } from "./components/root-layout";
import { Dashboard } from "./components/dashboard";
import { ClientsList } from "./components/clients-list";
import { ClientDetail } from "./components/client-detail";
import { Projects } from "./components/projects";
import { ProjectDetail } from "./components/project-detail";
import { Team } from "./components/team";
import { Financials } from "./components/financials";
import { Integrations } from "./components/integrations";
import { AdminPortal } from "./components/admin/admin-portal";
import { PipelineForecast } from "./components/pipeline-forecast";
import { ClientPortalLayout } from "./components/client-portal/client-portal-layout";
import { ClientDashboard } from "./components/client-portal/client-dashboard";
import { ProposalDetail } from "./components/proposal-detail";
import { EstimateTemplateSelector } from "./components/estimate-template-selector";
import { EstimateBuilder } from "./components/estimate-builder";
import { EstimateTemplateManager } from "./components/admin/estimate-template-manager";
import { ProposalBuilder } from "./components/proposal-builder";
import { Settings } from "./components/settings";
import { DocuSignCallback } from "./components/docusign-callback";
import { DataMigration } from "./components/admin/data-migration";
import { LoginPage } from "./components/login-page";
import { SetPasswordPage } from "./components/set-password-page";

// Simple 404 component
function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
        <p className="text-muted-foreground">The page you're looking for doesn't exist.</p>
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      { index: true, Component: Dashboard },
      { path: "clients", Component: ClientsList },
      { path: "clients/:id", Component: ClientDetail },
      { path: "clients/:clientId/create-proposal", Component: ProposalBuilder },
      { path: "clients/:clientId/estimate/:templateId", Component: EstimateBuilder },
      { path: "projects", Component: Projects },
      { path: "projects/:id", Component: ProjectDetail },
      { path: "proposals/:id", Component: ProposalDetail },
      { path: "team", Component: Team },
      { path: "financials", Component: Financials },
      { path: "integrations", Component: Integrations },
      { path: "settings", Component: Settings },
      { path: "admin", Component: AdminPortal },
      { path: "admin/estimate-templates", Component: EstimateTemplateManager },
      { path: "admin/data-migration", Component: DataMigration },
      { path: "pipeline", Component: PipelineForecast },
      { path: "*", Component: NotFound },
    ],
  },
  {
    path: "/client-portal",
    Component: ClientPortalLayout,
    children: [
      { index: true, Component: ClientDashboard },
    ],
  },
  {
    path: "/docusign-callback",
    Component: DocuSignCallback,
  },
  {
    path: "/login",
    Component: LoginPage,
  },
  {
    path: "/set-password",
    Component: SetPasswordPage,
  },
]);