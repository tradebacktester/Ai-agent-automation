import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminAuthProvider, useAdminAuth } from "@/contexts/AdminAuth";
import NotFound from "@/pages/not-found";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import CreateVideo from "@/pages/CreateVideo";
import Projects from "@/pages/Projects";
import ProjectDetail from "@/pages/ProjectDetail";
import Settings from "@/pages/Settings";
import CommandCenter from "@/pages/CommandCenter";
import AuthPage from "@/pages/AuthPage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function ProtectedPage({ children }: { children: React.ReactNode }) {
  const { isLoggedIn } = useAdminAuth();
  if (!isLoggedIn) return <Redirect to="/login" />;
  return <Layout>{children}</Layout>;
}

function HomeRedirect() {
  const { isLoggedIn } = useAdminAuth();
  return isLoggedIn ? <Redirect to="/dashboard" /> : <Redirect to="/login" />;
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/login" component={AuthPage} />
      <Route path="/sign-in/*?" component={AuthPage} />
      <Route path="/sign-up/*?" component={AuthPage} />
      <Route path="/dashboard"><ProtectedPage><Dashboard /></ProtectedPage></Route>
      <Route path="/create"><ProtectedPage><CreateVideo /></ProtectedPage></Route>
      <Route path="/projects"><ProtectedPage><Projects /></ProtectedPage></Route>
      <Route path="/projects/:id">{() => <ProtectedPage><ProjectDetail /></ProtectedPage>}</Route>
      <Route path="/settings"><ProtectedPage><Settings /></ProtectedPage></Route>
      <Route path="/command"><ProtectedPage><CommandCenter /></ProtectedPage></Route>
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <WouterRouter base={basePath}>
      <AdminAuthProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <AppRoutes />
          </TooltipProvider>
        </QueryClientProvider>
        <Toaster />
      </AdminAuthProvider>
    </WouterRouter>
  );
}
