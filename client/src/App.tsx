import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { ErrorProvider } from "@/lib/error-context";
import { UserPreferencesProvider } from "@/hooks/use-user-preferences"; // Re-enabled with proper implementation
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/hooks/use-auth";

import Login from "@/pages/login";
import ManagerDashboard from "@/pages/manager-dashboard";
import SupervisorView from "@/pages/supervisor-view";
import WorkerScanner from "@/pages/worker-scanner";
import CheckCountPage from "@/pages/check-count";
import QADashboard from "@/pages/qa-dashboard";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/login" component={Login} />
      <Route path="/manager" component={ManagerDashboard} />
      <Route path="/supervisor/:jobId?" component={SupervisorView} />
      <Route path="/scanner/:jobId?" component={WorkerScanner} />
      <Route path="/check-count/:jobId/:boxNumber" component={CheckCountPage} />
      <Route path="/qa-dashboard/:jobId?" component={QADashboard} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorProvider>
        <UserPreferencesProvider>
          <ThemeProvider>
            <AuthProvider>
              <TooltipProvider>
                <Toaster />
                <Router />
              </TooltipProvider>
            </AuthProvider>
          </ThemeProvider>
        </UserPreferencesProvider>
      </ErrorProvider>
    </QueryClientProvider>
  );
}

export default App;
