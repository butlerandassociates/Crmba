import { useState } from "react";
import type { PortalData } from "../api/portal";
import { PortalSidebar } from "./PortalSidebar";
import { PortalHero } from "./PortalHero";
import { PortalOverview } from "./PortalOverview";
import { PortalDocuments } from "./PortalDocuments";
import { PortalPayments } from "./PortalPayments";
import { PortalUpdates } from "./PortalUpdates";
import "./portal.css";

type Tab = "overview" | "documents" | "payments" | "updates";

const MOBILE_TABS: { id: Tab; label: string }[] = [
  { id: "overview",  label: "Overview" },
  { id: "payments",  label: "Payments" },
  { id: "documents", label: "Docs" },
  { id: "updates",   label: "Updates" },
];

interface Props {
  data: PortalData;
}

export function PortalLayout({ data }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const { client, project, phases, payments, updates, files } = data;

  return (
    <div className="portal-root">
      {/* Desktop layout */}
      <div className="portal-desktop">
        <PortalSidebar
          tab={tab}
          setTab={setTab}
          client={client}
          project={project}
          payments={payments}
        />
        <div className="portal-main">
          <PortalHero client={client} project={project} payments={payments} />
          <div style={{ padding: "0 48px 64px" }}>
            {tab === "overview"  && <PortalOverview phases={phases} payments={payments} updates={updates} startDate={project?.start_date ?? null} targetDate={project?.target_date ?? null} />}
            {tab === "documents" && <PortalDocuments files={files} />}
            {tab === "payments"  && <PortalPayments payments={payments} />}
            {tab === "updates"   && <PortalUpdates updates={updates} />}
          </div>
        </div>
      </div>

      {/* Mobile layout */}
      <div className="portal-mobile">
        <PortalHero client={client} project={project} payments={payments} />
        {/* Pill tab bar */}
        <div className="portal-mobile-tabs">
          {MOBILE_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`portal-mobile-tab${tab === t.id ? " active" : ""}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="portal-mobile-content">
          {tab === "overview"  && <PortalOverview phases={phases} payments={payments} updates={updates} startDate={project?.start_date ?? null} targetDate={project?.target_date ?? null} />}
          {tab === "documents" && <PortalDocuments files={files} />}
          {tab === "payments"  && <PortalPayments payments={payments} />}
          {tab === "updates"   && <PortalUpdates updates={updates} />}
        </div>
      </div>
    </div>
  );
}
