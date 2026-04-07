import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SellerRenewalApplication } from "@shared/schema";
import { CheckCircle2, XCircle, Clock, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

const durationLabels: Record<string, string> = {
  "1": "1 Month", "2": "2 Months", "3": "3 Months", "4": "4 Months",
  "5": "5 Months", "6": "6 Months", "7": "7 Months", "8": "8 Months",
  "9": "9 Months", "10": "10 Months", "11": "11 Months", "12": "12 Months",
};

const paymentLabels: Record<string, string> = {
  bkash: "bKash",
  nagad: "Nagad",
};

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string; icon: typeof Clock }> = {
    pending: { label: "Pending", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25", icon: Clock },
    approved: { label: "Approved", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25", icon: CheckCircle2 },
    rejected: { label: "Rejected", className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/25", icon: XCircle },
  };
  const { label, className, icon: Icon } = config[status] || config.pending;
  return (
    <Badge variant="outline" className={`${className} no-default-active-elevate text-xs`} data-testid={`badge-renewal-status-${status}`}>
      <Icon className="w-3 h-3 mr-1" />
      {label}
    </Badge>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex gap-4 items-center">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-24" />
        </div>
      ))}
    </div>
  );
}

function formatDate(createdAt: string) {
  const d = new Date(createdAt);
  return (
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " • " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
  );
}

export default function RenewalApplications() {
  const { toast } = useToast();

  const { data: applications = [], isLoading } = useQuery<SellerRenewalApplication[]>({
    queryKey: ["/api/renewals"],
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/renewals/${id}/approve`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/renewals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sellers"] });
      toast({ title: "Renewal approved", description: "Seller subscription has been extended." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/renewals/${id}/reject`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/renewals"] });
      toast({ title: "Renewal rejected" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/renewals/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/renewals"] });
      toast({ title: "Renewal application deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const sorted = [...applications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const pendingCount = applications.filter((a) => a.status === "pending").length;
  const approvedCount = applications.filter((a) => a.status === "approved").length;
  const rejectedCount = applications.filter((a) => a.status === "rejected").length;

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full max-w-[1400px] mx-auto p-3 sm:p-4 space-y-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight" data-testid="text-renewals-title">Renewal Applications</h1>
          <p className="text-muted-foreground mt-1 text-sm">Review and manage seller renewal requests</p>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 p-3 pb-1 sm:p-6 sm:pb-2">
              <CardTitle className="text-[10px] sm:text-sm font-medium text-muted-foreground leading-tight">Pending</CardTitle>
              <Clock className="hidden sm:block h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0 text-center sm:text-left">
              <div className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400" data-testid="text-renewals-pending-count">{pendingCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 p-3 pb-1 sm:p-6 sm:pb-2">
              <CardTitle className="text-[10px] sm:text-sm font-medium text-muted-foreground leading-tight">Approved</CardTitle>
              <CheckCircle2 className="hidden sm:block h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0 text-center sm:text-left">
              <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400" data-testid="text-renewals-approved-count">{approvedCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 p-3 pb-1 sm:p-6 sm:pb-2">
              <CardTitle className="text-[10px] sm:text-sm font-medium text-muted-foreground leading-tight">Rejected</CardTitle>
              <XCircle className="hidden sm:block h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0 text-center sm:text-left">
              <div className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-renewals-rejected-count">{rejectedCount}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Applications</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pb-4">
            {isLoading ? (
              <div className="px-6"><TableSkeleton /></div>
            ) : applications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <RefreshCw className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-1" data-testid="text-no-renewals">No renewal applications yet</h3>
                <p className="text-muted-foreground max-w-sm">
                  Renewal requests submitted through the public form will appear here.
                </p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block rounded-md border mx-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs py-2">Phone</TableHead>
                        <TableHead className="text-xs py-2">Duration</TableHead>
                        <TableHead className="text-xs py-2">Payment</TableHead>
                        <TableHead className="text-xs py-2">Sender No.</TableHead>
                        <TableHead className="text-xs py-2">Submitted</TableHead>
                        <TableHead className="text-xs py-2">Status</TableHead>
                        <TableHead className="text-xs py-2 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sorted.map((app) => (
                        <TableRow key={app.id} data-testid={`row-renewal-${app.id}`}>
                          <TableCell className="text-xs py-1.5 font-medium" data-testid={`text-renewal-phone-${app.id}`}>{app.phone}</TableCell>
                          <TableCell className="py-1.5">
                            <Badge variant="secondary" className="no-default-active-elevate text-xs" data-testid={`text-renewal-duration-${app.id}`}>
                              {durationLabels[app.duration] || app.duration}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-1.5">
                            <Badge variant="secondary" className="no-default-active-elevate text-xs" data-testid={`text-renewal-payment-${app.id}`}>
                              {paymentLabels[app.paymentMethod] || app.paymentMethod}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs py-1.5" data-testid={`text-renewal-sender-${app.id}`}>{app.senderNumber}</TableCell>
                          <TableCell className="text-xs py-1.5 whitespace-nowrap text-muted-foreground" data-testid={`text-renewal-submitted-${app.id}`}>{formatDate(app.createdAt)}</TableCell>
                          <TableCell className="py-1.5"><StatusBadge status={app.status} /></TableCell>
                          <TableCell className="py-1.5">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant={app.status === "approved" ? "default" : "outline"}
                                className={`h-6 text-xs px-1.5 ${app.status !== "approved" ? "text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-700 dark:hover:bg-emerald-950" : "bg-emerald-600 hover:bg-emerald-700"}`}
                                onClick={() => approveMutation.mutate(app.id)}
                                disabled={approveMutation.isPending || rejectMutation.isPending || app.status !== "pending"}
                                data-testid={`button-approve-renewal-${app.id}`}
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />Approve
                              </Button>
                              <Button
                                size="sm"
                                variant={app.status === "rejected" ? "default" : "outline"}
                                className={`h-6 text-xs px-1.5 ${app.status !== "rejected" ? "text-red-700 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-950" : "bg-red-600 hover:bg-red-700"}`}
                                onClick={() => rejectMutation.mutate(app.id)}
                                disabled={approveMutation.isPending || rejectMutation.isPending || app.status !== "pending"}
                                data-testid={`button-reject-renewal-${app.id}`}
                              >
                                <XCircle className="h-3 w-3 mr-1" />Reject
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => deleteMutation.mutate(app.id)}
                                disabled={deleteMutation.isPending}
                                data-testid={`button-delete-renewal-${app.id}`}
                                title="Delete application"
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden space-y-3 px-4 pb-2">
                  {sorted.map((app) => (
                    <div key={app.id} className="border rounded-xl p-4 space-y-3 bg-card shadow-sm" data-testid={`row-renewal-${app.id}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm" data-testid={`text-renewal-phone-${app.id}`}>{app.phone}</p>
                          <p className="text-xs text-muted-foreground mt-0.5" data-testid={`text-renewal-submitted-${app.id}`}>{formatDate(app.createdAt)}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <StatusBadge status={app.status} />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 ml-1"
                            onClick={() => deleteMutation.mutate(app.id)}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-renewal-${app.id}`}
                            title="Delete application"
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="secondary" className="text-xs no-default-active-elevate" data-testid={`text-renewal-duration-${app.id}`}>
                          {durationLabels[app.duration] || app.duration}
                        </Badge>
                        <Badge variant="secondary" className="text-xs no-default-active-elevate" data-testid={`text-renewal-payment-${app.id}`}>
                          {paymentLabels[app.paymentMethod] || app.paymentMethod}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground" data-testid={`text-renewal-sender-${app.id}`}>Sender: {app.senderNumber}</p>
                      <div className="flex items-center gap-2 pt-0.5">
                        <Button
                          size="sm"
                          variant={app.status === "approved" ? "default" : "outline"}
                          className={`flex-1 h-9 text-xs ${app.status !== "approved" ? "text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-700 dark:hover:bg-emerald-950" : "bg-emerald-600 hover:bg-emerald-700"}`}
                          onClick={() => approveMutation.mutate(app.id)}
                          disabled={approveMutation.isPending || rejectMutation.isPending || app.status !== "pending"}
                          data-testid={`button-approve-renewal-${app.id}`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Approve
                        </Button>
                        <Button
                          size="sm"
                          variant={app.status === "rejected" ? "default" : "outline"}
                          className={`flex-1 h-9 text-xs ${app.status !== "rejected" ? "text-red-700 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-950" : "bg-red-600 hover:bg-red-700"}`}
                          onClick={() => rejectMutation.mutate(app.id)}
                          disabled={approveMutation.isPending || rejectMutation.isPending || app.status !== "pending"}
                          data-testid={`button-reject-renewal-${app.id}`}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1.5" />Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
