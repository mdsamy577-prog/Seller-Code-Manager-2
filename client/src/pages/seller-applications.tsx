import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SellerApplication } from "@shared/schema";
import {
  CheckCircle2,
  XCircle,
  Clock,
  ClipboardList,
  Trash2,
} from "lucide-react";
import { SiMeta } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";

const durationLabels: Record<string, string> = {
  "15_days": "15 Days",
  "1_month": "1 Month",
  "2_months": "2 Months",
  "6_months": "6 Months",
};

const sellerTypeLabels: Record<string, string> = {
  "personal_facebook_id": "Personal Facebook ID",
  "facebook_business_page": "Facebook Business Page",
};

const sellerTypeShortLabels: Record<string, string> = {
  "personal_facebook_id": "Personal",
  "facebook_business_page": "Business",
};

const paymentMethodLabels: Record<string, string> = {
  "bkash": "Bkash",
  "nagad": "Nagad",
};

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string; icon: typeof Clock }> = {
    pending: { label: "Pending", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25", icon: Clock },
    approved: { label: "Approved", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25", icon: CheckCircle2 },
    rejected: { label: "Rejected", className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/25", icon: XCircle },
  };
  const { label, className, icon: Icon } = config[status] || config.pending;
  return (
    <Badge variant="outline" className={`${className} no-default-active-elevate text-xs`} data-testid={`badge-app-status-${status}`}>
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

export default function SellerApplications() {
  const { toast } = useToast();
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: applications = [], isLoading } = useQuery<SellerApplication[]>({
    queryKey: ["/api/applications"],
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/applications/${id}/approve`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sellers"] });
      toast({ title: "Application approved", description: "Seller account created with a unique code." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/applications/${id}/reject`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      toast({ title: "Application rejected" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/applications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      toast({ title: "Application deleted" });
      setDeleteId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const pendingCount = applications.filter((a) => a.status === "pending").length;
  const approvedCount = applications.filter((a) => a.status === "approved").length;
  const rejectedCount = applications.filter((a) => a.status === "rejected").length;

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full max-w-[1400px] mx-auto p-3 sm:p-4 space-y-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight" data-testid="text-applications-title">Seller Applications</h1>
          <p className="text-muted-foreground mt-1 text-sm">Review and manage seller applications</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400" data-testid="text-pending-count">{pendingCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400" data-testid="text-approved-count">{approvedCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-rejected-count">{rejectedCount}</div>
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
                  <ClipboardList className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-1" data-testid="text-no-applications">No applications yet</h3>
                <p className="text-muted-foreground max-w-sm">
                  Applications submitted through the public form will appear here.
                </p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block rounded-md border mx-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap text-xs py-2">Name</TableHead>
                        <TableHead className="whitespace-nowrap text-xs py-2">Phone</TableHead>
                        <TableHead className="whitespace-nowrap text-xs py-2 w-10">FB</TableHead>
                        <TableHead className="whitespace-nowrap text-xs py-2">Type</TableHead>
                        <TableHead className="whitespace-nowrap text-xs py-2 w-16">Dur.</TableHead>
                        <TableHead className="whitespace-nowrap text-xs py-2 w-16">Pay.</TableHead>
                        <TableHead className="whitespace-nowrap text-xs py-2">Sender</TableHead>
                        <TableHead className="whitespace-nowrap text-xs py-2">Status</TableHead>
                        <TableHead className="whitespace-nowrap text-xs py-2 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {applications.map((app) => (
                        <TableRow key={app.id} data-testid={`row-application-${app.id}`}>
                          <TableCell className="font-medium text-xs py-1.5" data-testid={`text-app-name-${app.id}`}>{app.name}</TableCell>
                          <TableCell className="text-xs py-1.5" data-testid={`text-app-phone-${app.id}`}>{app.phone}</TableCell>
                          <TableCell className="py-1.5 w-10 text-center">
                            <a href={app.facebookLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center text-[#1877F2] hover:text-[#0e5bbf] transition-colors" data-testid={`link-app-facebook-${app.id}`}>
                              <SiMeta className="h-4 w-4" />
                            </a>
                          </TableCell>
                          <TableCell className="py-1.5" data-testid={`text-app-seller-type-${app.id}`}>
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="secondary" className="no-default-active-elevate text-xs cursor-default">
                                  {sellerTypeShortLabels[app.sellerType] || app.sellerType}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent><p>{sellerTypeLabels[app.sellerType] || app.sellerType}</p></TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="py-1.5 w-16" data-testid={`text-app-duration-${app.id}`}>
                            <Badge variant="secondary" className="no-default-active-elevate text-xs">{durationLabels[app.duration] || app.duration}</Badge>
                          </TableCell>
                          <TableCell className="py-1.5 w-16" data-testid={`text-app-payment-method-${app.id}`}>
                            <Badge variant="secondary" className="no-default-active-elevate text-xs">{paymentMethodLabels[app.paymentMethod] || app.paymentMethod}</Badge>
                          </TableCell>
                          <TableCell className="text-xs py-1.5" data-testid={`text-app-sender-number-${app.id}`}>{app.senderNumber}</TableCell>
                          <TableCell className="py-1.5"><StatusBadge status={app.status} /></TableCell>
                          <TableCell className="py-1.5">
                            <div className="flex items-center justify-end gap-1">
                              <Button size="sm" variant={app.status === "approved" ? "default" : "outline"} className={`h-6 text-xs px-1.5 ${app.status !== "approved" ? "text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-700 dark:hover:bg-emerald-950" : "bg-emerald-600 hover:bg-emerald-700"}`} onClick={() => approveMutation.mutate(app.id)} disabled={approveMutation.isPending || rejectMutation.isPending || app.status !== "pending"} data-testid={`button-approve-${app.id}`}>
                                <CheckCircle2 className="h-3 w-3 mr-1" />Approve
                              </Button>
                              <Button size="sm" variant={app.status === "rejected" ? "default" : "outline"} className={`h-6 text-xs px-1.5 ${app.status !== "rejected" ? "text-red-700 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-950" : "bg-red-600 hover:bg-red-700"}`} onClick={() => rejectMutation.mutate(app.id)} disabled={approveMutation.isPending || rejectMutation.isPending || app.status !== "pending"} data-testid={`button-reject-${app.id}`}>
                                <XCircle className="h-3 w-3 mr-1" />Reject
                              </Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setDeleteId(app.id)} data-testid={`button-delete-app-${app.id}`}>
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile card list */}
                <div className="md:hidden space-y-3 px-4 pb-2">
                  {applications.map((app) => (
                    <div key={app.id} className="border rounded-xl p-4 space-y-3 bg-card shadow-sm" data-testid={`row-application-${app.id}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm leading-tight" data-testid={`text-app-name-${app.id}`}>{app.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5" data-testid={`text-app-phone-${app.id}`}>{app.phone}</p>
                        </div>
                        <StatusBadge status={app.status} />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="secondary" className="text-xs no-default-active-elevate" data-testid={`text-app-seller-type-${app.id}`}>
                          {sellerTypeShortLabels[app.sellerType] || app.sellerType}
                        </Badge>
                        <Badge variant="secondary" className="text-xs no-default-active-elevate" data-testid={`text-app-duration-${app.id}`}>
                          {durationLabels[app.duration] || app.duration}
                        </Badge>
                        <Badge variant="secondary" className="text-xs no-default-active-elevate" data-testid={`text-app-payment-method-${app.id}`}>
                          {paymentMethodLabels[app.paymentMethod] || app.paymentMethod}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <a href={app.facebookLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#1877F2] hover:text-[#0e5bbf]" data-testid={`link-app-facebook-${app.id}`}>
                          <SiMeta className="h-3.5 w-3.5" />
                          <span>Profile</span>
                        </a>
                        <span data-testid={`text-app-sender-number-${app.id}`}>Sender: {app.senderNumber}</span>
                      </div>
                      <div className="flex items-center gap-2 pt-0.5">
                        <Button size="sm" variant={app.status === "approved" ? "default" : "outline"} className={`flex-1 h-9 text-xs ${app.status !== "approved" ? "text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-700 dark:hover:bg-emerald-950" : "bg-emerald-600 hover:bg-emerald-700"}`} onClick={() => approveMutation.mutate(app.id)} disabled={approveMutation.isPending || rejectMutation.isPending || app.status !== "pending"} data-testid={`button-approve-${app.id}`}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Approve
                        </Button>
                        <Button size="sm" variant={app.status === "rejected" ? "default" : "outline"} className={`flex-1 h-9 text-xs ${app.status !== "rejected" ? "text-red-700 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-950" : "bg-red-600 hover:bg-red-700"}`} onClick={() => rejectMutation.mutate(app.id)} disabled={approveMutation.isPending || rejectMutation.isPending || app.status !== "pending"} data-testid={`button-reject-${app.id}`}>
                          <XCircle className="h-3.5 w-3.5 mr-1.5" />Reject
                        </Button>
                        <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => setDeleteId(app.id)} data-testid={`button-delete-app-${app.id}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure you want to delete this seller application?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteId && deleteMutation.mutate(deleteId)}
                className="bg-destructive text-destructive-foreground"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
