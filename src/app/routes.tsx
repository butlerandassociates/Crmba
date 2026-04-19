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
import { ChangeOrderBuilder } from "./components/change-order-builder";
import { Settings } from "./components/settings";
import { DocuSignCallback } from "./components/docusign-callback";
import { PublicProposal } from "./components/public-proposal";
import { DataMigration } from "./components/admin/data-migration";
import { ListManagement } from "./components/admin/list-management";
import { LoginPage } from "./components/login-page";
import { SetPasswordPage } from "./components/set-password-page";
import { DocuSignLoadingPreview } from "./components/docusign-loading-preview";
import { Payroll } from "./components/payroll";
import { PayrollPMDetail } from "./components/payroll-pm-detail";
import { PayrollCrewDetail } from "./components/payroll-crew-detail";
import { ForemanLayout } from "./components/foreman/foreman-layout";
import { ForemanDashboard } from "./components/foreman/foreman-dashboard";
import { ForemanJobDetail } from "./components/foreman/foreman-job-detail";
import { PermissionGuard } from "./components/permission-guard";

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

const G = (permission: string, C: React.ComponentType) => () => (
  <PermissionGuard permission={permission}><C /></PermissionGuard>
);

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      { index: true, Component: Dashboard },
      { path: "clients",                              Component: ClientsList },
      { path: "clients/:id",                          Component: ClientDetail },
      { path: "clients/:clientId/create-proposal",    Component: ProposalBuilder },
      { path: "clients/:clientId/change-order",        Component: ChangeOrderBuilder },
      { path: "clients/:clientId/change-order/:coId",  Component: ChangeOrderBuilder },
      { path: "clients/:clientId/estimate/:templateId", Component: EstimateBuilder },
      { path: "projects",                             Component: Projects },
      { path: "projects/:id",                         Component: ProjectDetail },
      { path: "proposals/:id",                        Component: ProposalDetail },
      { path: "team",                                 Component: G("can_manage_team", Team) },
      { path: "financials",                           Component: G("can_view_financials", Financials) },
      { path: "integrations",                         Component: G("can_view_integrations", Integrations) },
      { path: "settings",                             Component: G("can_manage_settings", Settings) },
      { path: "admin",                                Component: G("can_view_admin_portal", AdminPortal) },
      { path: "admin/estimate-templates",             Component: G("can_view_admin_portal", EstimateTemplateManager) },
      { path: "admin/data-migration",                 Component: G("can_view_admin_portal", DataMigration) },
      { path: "admin/list-management",                Component: G("can_view_admin_portal", ListManagement) },
      { path: "pipeline",                             Component: G("can_view_pipeline", PipelineForecast) },
      { path: "payroll",                              Component: G("can_view_payroll", Payroll) },
      { path: "payroll/pm/:id",                       Component: G("can_view_payroll", PayrollPMDetail) },
      { path: "payroll/crew/:id",                     Component: G("can_view_payroll", PayrollCrewDetail) },
      { path: "*",                                    Component: NotFound },
    ],
  },
  {
    path: "/foreman",
    Component: ForemanLayout,
    children: [
      { index: true, Component: ForemanDashboard },
      { path: "jobs/:fioId", Component: ForemanJobDetail },
    ],
  },
  {
    path: "/client-portal",
    Component: ClientPortalLayout,
    children: [
      { index: true, Component: ClientDashboard },
    ],
  },
  { path: "/p/:id",                    Component: PublicProposal },
  { path: "/docusign-callback",        Component: DocuSignCallback },
  { path: "/login",                    Component: LoginPage },
  { path: "/set-password",             Component: SetPasswordPage },
  { path: "/docusign-loading-preview", Component: DocuSignLoadingPreview },
]);
