import { useState, type ComponentType, type CSSProperties } from "react";
import {
  AudioLines,
  BookOpen,
  ChevronsUpDown,
  FileBarChart,
  Plug,
  Settings,
  Sparkles,
} from "lucide-react";
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
import { ConnectorsPage } from "@/components/jarbas/connectors-page";
import { LearningsPage } from "@/components/jarbas/learnings-page";
import { RecordingPage } from "@/components/jarbas/recording-page";
import { ReportsPage } from "@/components/jarbas/reports-page";
import { SettingsPage } from "@/components/jarbas/settings-page";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type AppTabId =
  | "recording"
  | "learnings"
  | "opportunities"
  | "reports"
  | "connectors"
  | "settings";

type AppTab = {
  id: AppTabId;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const TABS: AppTab[] = [
  {
    id: "recording",
    label: "Recording / Ask",
    icon: AudioLines,
  },
  {
    id: "connectors",
    label: "Connectors",
    icon: Plug,
  },
  {
    id: "learnings",
    label: "Learnings",
    icon: BookOpen,
  },
  {
    id: "opportunities",
    label: "Opportunities",
    icon: Sparkles,
  },
  {
    id: "reports",
    label: "Reports",
    icon: FileBarChart,
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
  },
];

function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="animate-rise mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <p className="label-caps text-muted-foreground">Jarbas</p>
      <h1 className="mt-1 font-display text-3xl tracking-tight text-foreground sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
        {description}
      </p>
    </div>
  );
}

export function AppShell() {
  const [activeId, setActiveId] = useState<AppTabId>("recording");
  const activeTab = TABS.find((tab) => tab.id === activeId) ?? TABS[0];

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
                  {TABS.map((tab) => {
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
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-none border border-border bg-background px-2.5 py-2 text-left transition-colors hover:bg-muted group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
              title="Account"
            >
              <span className="flex size-7 shrink-0 items-center justify-center bg-sky text-[11px] font-semibold text-navy">
                HP
              </span>
              <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                <span className="block truncate text-sm font-semibold tracking-tight">
                  Hans Preinfalk
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  hans@deploy.co
                </span>
              </span>
              <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
            </button>
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
          </header>

          <div className="jarbas-chat-canvas flex min-h-0 flex-1 flex-col overflow-y-auto">
            {activeId === "recording" ? (
              <RecordingPage />
            ) : activeId === "learnings" ? (
              <LearningsPage />
            ) : activeId === "reports" ? (
              <ReportsPage />
            ) : activeId === "connectors" ? (
              <ConnectorsPage />
            ) : activeId === "settings" ? (
              <SettingsPage />
            ) : (
              <PlaceholderPage
                title="Opportunities"
                description="Fast delivery unlocks ready for review and deployment."
              />
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
