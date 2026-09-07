import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LandingRoute } from "@/routes/landing";

// The app route pulls in viem and the whole chain layer, roughly 300kB that a
// visitor reading the landing page has no use for. Splitting it keeps the
// marketing page light and loads the wallet stack only when someone actually
// goes to use the protocol.
const AppRoute = lazy(() =>
  import("@/routes/app").then((m) => ({ default: m.AppRoute })),
);

// Documentation inlines every markdown file at build time, so it is split out
// for the same reason: a visitor who never opens it never downloads it.
const DocsRoute = lazy(() =>
  import("@/routes/docs").then((m) => ({ default: m.DocsRoute })),
);

/** Shown for the moment the app chunk is in flight. */
function RouteFallback() {
  return (
    <main className="grid min-h-[100svh] place-items-center px-6">
      <p className="text-sm text-faint">Loading…</p>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingRoute />} />
        <Route
          path="/app"
          element={
            <Suspense fallback={<RouteFallback />}>
              <AppRoute />
            </Suspense>
          }
        />
        <Route
          path="/docs"
          element={
            <Suspense fallback={<RouteFallback />}>
              <DocsRoute />
            </Suspense>
          }
        />
        <Route
          path="/docs/:slug"
          element={
            <Suspense fallback={<RouteFallback />}>
              <DocsRoute />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
