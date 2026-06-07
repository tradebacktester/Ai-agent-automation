import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
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
import Analytics from "@/pages/Analytics";
import Trends from "@/pages/Trends";
import Settings from "@/pages/Settings";
import AgentStudio from "@/pages/AgentStudio";
import StrategyPage from "@/pages/StrategyPage";
import CommandCenter from "@/pages/CommandCenter";
import MemoryVault from "@/pages/MemoryVault";
import Publisher from "@/pages/Publisher";
import ABTesting from "@/pages/ABTesting";
import Insights from "@/pages/Insights";
import Monetization from "@/pages/Monetization";
import PersonalityClone from "@/pages/PersonalityClone";
import Marketplace from "@/pages/Marketplace";
import BrandCreator from "@/pages/BrandCreator";
import StoryUniverse from "@/pages/StoryUniverse";
import EnterpriseOps from "@/pages/EnterpriseOps";
import CinematicEngine from "@/pages/CinematicEngine";
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
      <Route path="/analytics"><ProtectedPage><Analytics /></ProtectedPage></Route>
      <Route path="/trends"><ProtectedPage><Trends /></ProtectedPage></Route>
      <Route path="/settings"><ProtectedPage><Settings /></ProtectedPage></Route>
      <Route path="/agents"><ProtectedPage><AgentStudio /></ProtectedPage></Route>
      <Route path="/strategy"><ProtectedPage><StrategyPage /></ProtectedPage></Route>
      <Route path="/command"><ProtectedPage><CommandCenter /></ProtectedPage></Route>
      <Route path="/memory"><ProtectedPage><MemoryVault /></ProtectedPage></Route>
      <Route path="/publisher"><ProtectedPage><Publisher /></ProtectedPage></Route>
      <Route path="/ab-testing"><ProtectedPage><ABTesting /></ProtectedPage></Route>
      <Route path="/insights"><ProtectedPage><Insights /></ProtectedPage></Route>
      <Route path="/monetization"><ProtectedPage><Monetization /></ProtectedPage></Route>
      <Route path="/personality"><ProtectedPage><PersonalityClone /></ProtectedPage></Route>
      <Route path="/marketplace"><ProtectedPage><Marketplace /></ProtectedPage></Route>
      <Route path="/brand"><ProtectedPage><BrandCreator /></ProtectedPage></Route>
      <Route path="/universe"><ProtectedPage><StoryUniverse /></ProtectedPage></Route>
      <Route path="/enterprise"><ProtectedPage><EnterpriseOps /></ProtectedPage></Route>
      <Route path="/cinematic"><ProtectedPage><CinematicEngine /></ProtectedPage></Route>
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
