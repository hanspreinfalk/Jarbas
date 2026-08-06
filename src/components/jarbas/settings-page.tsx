import { ExternalLink } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/jarbas/theme-toggle";

const PERMISSIONS = [
  {
    id: "screen-recording",
    label: "Screen Recording",
    description: "Capture what is on screen while you work.",
    status: "Required",
    pane: "screen-recording",
  },
  {
    id: "accessibility",
    label: "Accessibility",
    description: "Read UI elements and app context for learnings.",
    status: "Required",
    pane: "accessibility",
  },
] as const;

async function openPrivacySettings(pane: string) {
  try {
    await invoke("open_privacy_settings", { pane });
  } catch (error) {
    console.error("Failed to open privacy settings", error);
  }
}

export function SettingsPage() {
  return (
    <div className="animate-rise mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <p className="label-caps text-muted-foreground">Jarbas</p>
      <h1 className="mt-1 font-display text-3xl tracking-tight text-foreground sm:text-4xl">
        Settings
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
        Recording, devices, and how Jarbas shows up on this machine.
      </p>

      <section className="mt-10 border border-border bg-card">
        <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="label-caps text-muted-foreground">Appearance</p>
            <h2 className="mt-1 text-base font-semibold tracking-tight text-foreground">
              Theme
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose light, dark, or match your system preference.
            </p>
          </div>
          <div className="shrink-0 pt-1">
            <ThemeToggle />
          </div>
        </div>
      </section>

      <section className="mt-4 border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <p className="label-caps text-muted-foreground">Permissions</p>
          <h2 className="mt-1 text-base font-semibold tracking-tight text-foreground">
            System access
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            macOS permissions Jarbas needs to learn how you work.
          </p>
        </div>
        <ul className="divide-y divide-border">
          {PERMISSIONS.map((permission) => (
            <li
              key={permission.id}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {permission.label}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {permission.description}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="label-caps border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {permission.status}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-none"
                  onClick={() => openPrivacySettings(permission.pane)}
                >
                  Open Settings
                  <ExternalLink className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4 border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <p className="label-caps text-muted-foreground">Storage</p>
          <h2 className="mt-1 text-base font-semibold tracking-tight text-foreground">
            Local capture
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Recorded frames and disk used on this machine.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-px bg-border">
          <div className="bg-card px-4 py-4">
            <p className="label-caps text-muted-foreground">Size</p>
            <p className="mt-1 font-display text-2xl tracking-tight text-foreground">
              5.24GB
            </p>
          </div>
          <div className="bg-card px-4 py-4">
            <p className="label-caps text-muted-foreground">Frames</p>
            <p className="mt-1 font-display text-2xl tracking-tight text-foreground">
              11,060
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
