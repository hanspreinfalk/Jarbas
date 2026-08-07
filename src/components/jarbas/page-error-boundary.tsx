import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  children: ReactNode;
  /** Reset key — change when navigating so a new page can recover. */
  resetKey?: string;
};

type State = {
  error: Error | null;
};

/** Keeps a page crash from blanking the whole app shell. */
export class PageErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Page crashed", error, info.componentStack);
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="animate-rise mx-auto flex w-full max-w-lg flex-col items-start gap-4 px-4 py-16 sm:px-6">
          <p className="label-caps text-muted-foreground">Something went wrong</p>
          <h1 className="font-display text-2xl tracking-tight text-foreground">
            This page hit an error
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {this.state.error.message || "Unknown error"}
          </p>
          <Button
            type="button"
            className="rounded-none"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
