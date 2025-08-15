import { Route, Switch } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth";
import { ErrorProvider } from "@/lib/error-context";
import { ThemeProvider } from "@/components/theme-provider";
import Login from "@/pages/login";
import ManagerDashboard from "@/pages/manager-dashboard";
import SupervisorView from "@/pages/supervisor-view";
import WorkerScanner from "@/pages/worker-scanner";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ErrorProvider>
          <AuthProvider>
            <Switch>
              <Route path="/login" component={Login} />
              <Route path="/manager" component={ManagerDashboard} />
              <Route path="/supervisor/:jobId" component={SupervisorView} />
              <Route path="/scanner/:jobId?" component={WorkerScanner} />
              <Route path="/scanner" component={WorkerScanner} />
              <Route path="/settings" component={Settings} />
              <Route path="/" component={Login} />
              <Route component={NotFound} />
            </Switch>
            <Toaster />
          </AuthProvider>
        </ErrorProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;