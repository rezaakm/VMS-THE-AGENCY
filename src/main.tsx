import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/error-boundary";
import "./index.css";

// Auto-recover from stale deploys: when a code-split chunk fails to load
// (old tab open, new version shipped), reload once to fetch the fresh assets
// instead of showing a black screen.
const RELOAD_KEY = "vms-chunk-reloaded";
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  if (!sessionStorage.getItem(RELOAD_KEY)) {
    sessionStorage.setItem(RELOAD_KEY, "1");
    window.location.reload();
  }
});
// If the app runs cleanly for a few seconds, clear the guard so a future
// deploy can recover the same way.
setTimeout(() => sessionStorage.removeItem(RELOAD_KEY), 5000);

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
