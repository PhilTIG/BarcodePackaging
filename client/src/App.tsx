import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { ErrorProvider } from "@/lib/error-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/hooks/use-auth";

import Login from "@/pages/login";
import ManagerDashboard from "@/pages/manager-dashboard";
import SupervisorView from "@/pages/supervisor-view";
import WorkerScanner from "@/pages/worker-scanner";
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
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorProvider>
        <ThemeProvider>
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </ErrorProvider>
    </QueryClientProvider>
  );
}

export default App;
