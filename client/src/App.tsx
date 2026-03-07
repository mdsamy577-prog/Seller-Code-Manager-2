import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import SellerCodeManager from "@/pages/seller-code-manager";
import SellerApplication from "@/pages/seller-application";
import SellerApplications from "@/pages/seller-applications";

function Router() {
  return (
    <Switch>
      <Route path="/" component={SellerCodeManager} />
      <Route path="/apply" component={SellerApplication} />
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
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
