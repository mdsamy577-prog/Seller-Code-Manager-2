import { Switch, Route, useLocation } from "wouter";
import { queryClient, getQueryFn } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import SellerCodeManager from "@/pages/seller-code-manager";
import SellerApplication from "@/pages/seller-application";
import SellerApplications from "@/pages/seller-applications";
import Login from "@/pages/login";
import AdminSetup from "@/pages/admin-setup";
import { Skeleton } from "@/components/ui/skeleton";

interface AuthStatus {
  setupRequired: boolean;
  authenticated: boolean;
  user?: { username: string };
}

function ProtectedRouter() {
  const [location] = useLocation();

  const { data: authStatus, isLoading } = useQuery<AuthStatus>({
    queryKey: ["/api/auth/status"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  if (location === "/apply") {
    return <SellerApplication />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="space-y-4 w-full max-w-md p-6">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  if (authStatus?.setupRequired) {
    return <AdminSetup />;
  }

  if (!authStatus?.authenticated) {
    return <Login />;
  }

  return (
    <Switch>
      <Route path="/" component={SellerCodeManager} />
      <Route path="/applications" component={SellerApplications} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <ProtectedRouter />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
