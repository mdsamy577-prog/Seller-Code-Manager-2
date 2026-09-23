import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
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

function AppRoutes() {
  usePWA();

  return (
    <Switch>
      {/* Public Landing & Verified Directory */}
      <Route path="/" component={PublicDirectory} />

      {/* Public Applicant Routes */}
      <Route path="/apply" component={SellerApplication} />
      <Route path="/renew" component={RenewalPage} />

      {/* Admin Dedicated Routes */}
      <Route path="/admin/login" component={Login} />
      <Route path="/admin/dashboard" component={SellerCodeManager} />
      <Route path="/admin/applications" component={SellerApplications} />
      <Route path="/admin/renewals" component={RenewalApplications} />
      <Route path="/admin/email-logs" component={EmailLogsPage} />
      <Route path="/admin/setup" component={AdminSetup} />
      <Route path="/admin" component={SellerCodeManager} />

      {/* Legacy / Direct Aliases */}
      <Route path="/dashboard" component={SellerCodeManager} />
      <Route path="/preview" component={SellerCodeManager} />
      <Route path="/applications" component={SellerApplications} />
      <Route path="/renewals" component={RenewalApplications} />
      <Route path="/email-logs" component={EmailLogsPage} />
      <Route path="/login" component={Login} />
      <Route path="/setup" component={AdminSetup} />

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
