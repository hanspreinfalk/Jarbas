import { useState, type CSSProperties } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AgentsPage } from "@/components/jarbas/agents-page";
import { AppHeaderActions } from "@/components/jarbas/app-header-actions";
import { AskPage } from "@/components/jarbas/ask-page";
import { ConnectorsPage } from "@/components/jarbas/connectors-page";
import { LearningsPage } from "@/components/jarbas/learnings-page";
import { ObservabilityPage } from "@/components/jarbas/observability-page";
import { OpportunitiesPage } from "@/components/jarbas/opportunities-page";
import { RecordingPage } from "@/components/jarbas/recording-page";
import { ReportsPage } from "@/components/jarbas/reports-page";
import { SettingsPage } from "@/components/jarbas/settings-page";
import { SidebarUserMenu } from "@/components/jarbas/sidebar-user-menu";
import { TooltipProvider } from "@/components/ui/tooltip";
import { APP_TABS, type AppTabId } from "@/lib/app-tabs";
import { cn } from "@/lib/utils";

export type { AppTabId } from "@/lib/app-tabs";

export function AppShell() {
  const [activeId, setActiveId] = useState<AppTabId>("recording");
  const activeTab = APP_TABS.find((tab) => tab.id === activeId) ?? APP_TABS[0];

  return (
    <TooltipProvider>
      <SidebarProvider
        defaultOpen
        className="jarbas-shell h-dvh max-h-dvh min-h-0 overflow-hidden"
        style={
          {
            "--sidebar-width": "14rem",
            "--sidebar-width-icon": "3.25rem",
          } as CSSProperties
        }
      >
        <Sidebar collapsible="icon" className="jarbas-sidebar border-sidebar-border">
          <SidebarHeader className="h-12 shrink-0 justify-center border-b border-sidebar-border px-3 py-0 group-data-[collapsible=icon]:items-center">
            <div className="flex h-full w-full items-center gap-2.5 group-data-[collapsible=icon]:justify-center">
              <span className="flex size-7 shrink-0 items-center justify-center bg-primary font-display text-sm font-bold text-primary-foreground">
                J
              </span>
              <span className="min-w-0 flex-1 truncate font-display text-base tracking-tight text-foreground group-data-[collapsible=icon]:hidden">
                Jarbas
              </span>
            </div>
          </SidebarHeader>

          <SidebarContent className="px-2 pt-3">
            <SidebarGroup className="p-0">
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {APP_TABS.map((tab) => {
                    const active = tab.id === activeId;
                    const Icon = tab.icon;
                    return (
                      <SidebarMenuItem key={tab.id}>
                        <SidebarMenuButton
                          isActive={active}
                          tooltip={tab.label}
                          onClick={() => setActiveId(tab.id)}
                          className={cn(
                            "h-9 rounded-none px-2 text-sm font-medium hover:bg-muted hover:text-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:justify-center",
                            active &&
                              "bg-foreground text-background hover:bg-foreground hover:text-background data-active:bg-foreground data-active:text-background",
                          )}
                        >
                          <span className="flex size-5 shrink-0 items-center justify-center">
                            <Icon className="size-4" />
                          </span>
                          <span className="truncate group-data-[collapsible=icon]:hidden">
                            {tab.label}
                          </span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-sidebar-border p-2 group-data-[collapsible=icon]:items-center">
            <SidebarUserMenu />
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="relative z-10 flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden bg-background">
          <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
            <SidebarTrigger className="rounded-none" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium tracking-tight">
                {activeTab.label}
              </p>
            </div>
            <AppHeaderActions
              activeId={activeId}
              onNavigate={setActiveId}
            />
          </header>

          <div
            className={cn(
              "jarbas-chat-canvas flex min-h-0 flex-1 flex-col",
              activeId === "ask" ? "overflow-hidden" : "overflow-y-auto",
            )}
          >
            {activeId === "recording" ? (
              <RecordingPage />
            ) : activeId === "learnings" ? (
              <LearningsPage />
            ) : activeId === "opportunities" ? (
              <OpportunitiesPage />
            ) : activeId === "reports" ? (
              <ReportsPage />
            ) : activeId === "agents" ? (
              <AgentsPage />
            ) : activeId === "observability" ? (
              <ObservabilityPage />
            ) : activeId === "connectors" ? (
              <ConnectorsPage />
            ) : activeId === "ask" ? (
              <AskPage />
            ) : (
              <SettingsPage />
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
