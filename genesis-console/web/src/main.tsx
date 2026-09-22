import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router";
import { shellLoader } from "@/shell-loader";
import { shouldRevalidateShell } from "@/lib/revalidation";
import { AppShell, ConsoleError } from "@/components/AppShell";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { OverviewPage } from "@/pages/OverviewPage";
import { ServicesPage } from "@/pages/ServicesPage";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

const router = createBrowserRouter([
  { path: "/login", lazy: async () => {
    const page = await import("@/pages/LoginPage");
    return { Component: page.LoginPage, loader: page.loginLoader };
  }, errorElement: <ConsoleError /> },
  {
    path: "/",
    loader: shellLoader,
    shouldRevalidate: shouldRevalidateShell,
    Component: AppShell,
    HydrateFallback: () => <p role="status" className="p-6 text-[var(--muted)]">Loading Genesis Console…</p>,
    errorElement: <ConsoleError />,
    children: [
      { index: true, Component: OverviewPage },
      { path: "packages", lazy: async () => ({ Component: (await import("@/pages/PackagesPage")).PackagesPage }) },
      { path: "packages/:packageKey", lazy: async () => ({ Component: (await import("@/pages/PackagesPage")).PackagePage }) },
      { path: "images", lazy: async () => ({ Component: (await import("@/pages/ImagesPage")).ImagesPage }) },
      { path: "images/:source/:imageId", lazy: async () => ({ Component: (await import("@/pages/ImagesPage")).ImagesPage }) },
      { path: "scans", lazy: async () => ({ Component: (await import("@/pages/ScansPage")).ScansPage }) },
      { path: "services", Component: ServicesPage },
    ],
  },
]);

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
