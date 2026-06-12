import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

const RELOAD_KEY = "vms-chunk-reloaded";

function isChunkError(err: unknown): boolean {
  const m = (err as Error)?.message || String(err);
  return /Loading chunk|dynamically imported module|Importing a module script failed|ChunkLoadError|Failed to fetch/i.test(
    m,
  );
}

/**
 * Catches render-time errors so a single broken page shows a recover screen
 * instead of a fully black app. If the error is a code-split chunk failing to
 * load (almost always a stale tab after a new deploy), it reloads once to pull
 * the fresh assets.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    if (isChunkError(error) && !sessionStorage.getItem(RELOAD_KEY)) {
      sessionStorage.setItem(RELOAD_KEY, "1");
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.75rem",
            background: "#0b0f14",
            color: "#e5e7eb",
            fontFamily: "system-ui, sans-serif",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "1.05rem", fontWeight: 600 }}>
            This page hit a snag.
          </div>
          <div style={{ fontSize: "0.85rem", opacity: 0.7, maxWidth: 460 }}>
            This usually means a new version was just deployed. Reloading fixes
            it — your data is safe.
          </div>
          <button
            onClick={() => {
              sessionStorage.removeItem(RELOAD_KEY);
              window.location.reload();
            }}
            style={{
              marginTop: "0.25rem",
              padding: "0.5rem 1.1rem",
              borderRadius: "0.5rem",
              border: "1px solid #2563eb",
              background: "#2563eb",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.9rem",
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
