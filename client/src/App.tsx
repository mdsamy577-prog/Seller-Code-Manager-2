import React, { Component, useEffect, type ErrorInfo, type ReactNode } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import PublicDirectory from "@/pages/public-directory";
import SellerCodeManager from "@/pages/seller-code-manager";
import SellerApplication from "@/pages/seller-application";
import SellerApplications from "@/pages/seller-applications";
import RenewalPage from "@/pages/renewal";
import RenewalApplications from "@/pages/renewal-applications";
import EmailLogsPage from "@/pages/email-logs";
import Login from "@/pages/login";
import AdminSetup from "@/pages/admin-setup";
import { usePWA } from "@/hooks/use-pwa";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background text-foreground font-sans">
          <div className="max-w-md w-full text-center space-y-4 p-6 rounded-2xl border border-border bg-card shadow-lg">
            <h2 className="text-xl font-bold text-red-600 dark:text-red-400">
              একটি সমস্যা দেখা দিয়েছে
            </h2>
            <p className="text-sm text-muted-foreground">
              দয়া করে পৃষ্ঠাটি পুনরায় লোড (Reload) করুন।
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              পেজ রিলোড করুন
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const [location, navigate] = useLocation();
  const { data: authStatus, isLoading } = useQuery<{ authenticated: boolean; setupRequired: boolean }>({
    queryKey: ["/api/auth/status"],
  });

  const prefix = location.startsWith("/tanny-admin") ? "/tanny-admin" : "/.tanny.admin";

  useEffect(() => {
    if (!isLoading && authStatus) {
      if (authStatus.setupRequired) {
        navigate(`${prefix}/setup`);
      } else if (!authStatus.authenticated) {
        navigate(`${prefix}/login`);
      }
    }
  }, [authStatus, isLoading, navigate, prefix]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!authStatus?.authenticated) {
    return null;
  }

  return <Component />;
}

function AppRoutes() {
  usePWA();

  return (
    <Switch>
      {/* Public Landing & Verified Directory */}
      <Route path="/" component={PublicDirectory} />
      <Route path="/verify/:code" component={PublicDirectory} />

      {/* Public Applicant Routes */}
      <Route path="/apply" component={SellerApplication} />
      <Route path="/renew" component={RenewalPage} />

      {/* Secret Admin Routes (/.tanny.admin) */}
      <Route path="/.tanny.admin/login" component={Login} />
      <Route path="/.tanny.admin/setup" component={AdminSetup} />
      <Route path="/.tanny.admin/dashboard">{() => <ProtectedRoute component={SellerCodeManager} />}</Route>
      <Route path="/.tanny.admin/sellers">{() => <ProtectedRoute component={SellerCodeManager} />}</Route>
      <Route path="/.tanny.admin/applications">{() => <ProtectedRoute component={SellerApplications} />}</Route>
      <Route path="/.tanny.admin/renewals">{() => <ProtectedRoute component={RenewalApplications} />}</Route>
      <Route path="/.tanny.admin/email-logs">{() => <ProtectedRoute component={EmailLogsPage} />}</Route>
      <Route path="/.tanny.admin">{() => <ProtectedRoute component={SellerCodeManager} />}</Route>

      {/* Secondary Alias Admin Routes (/tanny-admin fallback) */}
      <Route path="/tanny-admin/login" component={Login} />
      <Route path="/tanny-admin/setup" component={AdminSetup} />
      <Route path="/tanny-admin/dashboard">{() => <ProtectedRoute component={SellerCodeManager} />}</Route>
      <Route path="/tanny-admin/sellers">{() => <ProtectedRoute component={SellerCodeManager} />}</Route>
      <Route path="/tanny-admin/applications">{() => <ProtectedRoute component={SellerApplications} />}</Route>
      <Route path="/tanny-admin/renewals">{() => <ProtectedRoute component={RenewalApplications} />}</Route>
      <Route path="/tanny-admin/email-logs">{() => <ProtectedRoute component={EmailLogsPage} />}</Route>
      <Route path="/tanny-admin">{() => <ProtectedRoute component={SellerCodeManager} />}</Route>

      {/* Block Standard /admin Routes - returns 404 (Not Found) without disclosing portal */}
      <Route path="/admin" component={NotFound} />
      <Route path="/admin/:rest*" component={NotFound} />

      {/* 404 Fallback */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <AppRoutes />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
