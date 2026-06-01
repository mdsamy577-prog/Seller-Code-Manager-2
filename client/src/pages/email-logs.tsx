import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { ArrowLeft, RefreshCw, Trash2, Mail, CheckCircle2, Circle, XCircle, AlertCircle, MousePointerClick, Clock, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { EmailLog } from "@shared/schema";

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ComponentType<{ className?: string }> }> = {
  sent:      { label: "Sent",      className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800",          icon: Mail },
  delivered: { label: "Delivered", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800",     icon: CheckCircle2 },
  opened:    { label: "Opened",    className: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300 border-sky-200 dark:border-sky-800",                 icon: Circle },
  clicked:   { label: "Clicked",   className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800", icon: MousePointerClick },
  failed:    { label: "Failed",    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800",                 icon: XCircle },
  bounced:   { label: "Bounced",   className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800", icon: AlertCircle },
  complaint: { label: "Complaint", className: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-800",           icon: AlertCircle },
  pending:   { label: "Pending",   className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800", icon: Clock },
};

const EMAIL_TYPE_LABELS: Record<string, string> = {
  seller_code:       "Activation",
  extension:         "Extension",
  reminder:          "Reminder",
  renewal_approval:  "Renewal ✓",
  renewal_rejection: "Renewal ✗",
  test:              "Test",
};

function formatDateTime(isoStr: string): string {
  try {
    return new Date(isoStr).toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
  } catch {
    return isoStr;
  }
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.sent;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${cfg.className}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

export default function EmailLogsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: logs = [], isLoading, refetch, isFetching } = useQuery<EmailLog[]>({
    queryKey: ["/api/email-logs"],
    staleTime: 30_000,
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/email-logs");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-logs"] });
      toast({ title: "Email logs cleared" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const webhookUrl = `${window.location.origin}/api/webhooks/resend`;

  function copyWebhook() {
    navigator.clipboard.writeText(webhookUrl);
    toast({ title: "Webhook URL copied" });
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="outline" size="sm" onClick={() => navigate("/")} data-testid="button-back-dashboard" className="h-9 shrink-0">
              <ArrowLeft className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Dashboard</span>
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Email Logs</h1>
              <p className="text-muted-foreground mt-0.5 text-sm hidden sm:block">Track delivery status for all outgoing emails</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="h-9" data-testid="button-refresh-logs">
              <RefreshCw className={`h-4 w-4 sm:mr-2 ${isFetching ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            {logs.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 text-destructive hover:text-destructive" data-testid="button-clear-logs">
                    <Trash2 className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Clear Logs</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear all email logs?</AlertDialogTitle>
                    <AlertDialogDescription>This will permanently delete all {logs.length} email log entries. This cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => clearMutation.mutate()} className="bg-destructive hover:bg-destructive/90">
                      Clear All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* Webhook config info */}
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">Enable live status updates via Resend Webhook</p>
                <p className="text-xs text-blue-700 dark:text-blue-400">Configure this URL in your Resend dashboard under <strong>Webhooks</strong> to receive real-time delivery events (delivered, opened, bounced, etc.).</p>
                <div className="flex items-center gap-2 bg-white dark:bg-gray-900 rounded-lg border border-blue-200 dark:border-blue-800 px-3 py-2">
                  <code className="text-xs text-blue-800 dark:text-blue-300 truncate flex-1" data-testid="text-webhook-url">{webhookUrl}</code>
                  <Button variant="ghost" size="sm" className="h-7 px-2 shrink-0" onClick={copyWebhook} data-testid="button-copy-webhook">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats row */}
        {logs.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {(["delivered", "opened", "sent", "pending", "bounced", "failed"] as const).map((s) => {
              const count = logs.filter((l) => l.status === s).length;
              const cfg = STATUS_CONFIG[s];
              return (
                <Card key={s} className="text-center">
                  <CardContent className="p-3">
                    <div className="text-xl font-bold">{count}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{cfg.label}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Logs table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Email History</CardTitle>
              {logs.length > 0 && <span className="text-xs text-muted-foreground">{logs.length} records</span>}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <Mail className="h-12 w-12 text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground font-medium">No email logs yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Emails sent from this system will appear here</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-3 font-semibold text-xs text-muted-foreground whitespace-nowrap">Date & Time</th>
                      <th className="text-left p-3 font-semibold text-xs text-muted-foreground whitespace-nowrap">Recipient</th>
                      <th className="text-left p-3 font-semibold text-xs text-muted-foreground whitespace-nowrap hidden sm:table-cell">Seller</th>
                      <th className="text-left p-3 font-semibold text-xs text-muted-foreground whitespace-nowrap hidden md:table-cell">Code</th>
                      <th className="text-left p-3 font-semibold text-xs text-muted-foreground whitespace-nowrap hidden lg:table-cell">Subject</th>
                      <th className="text-left p-3 font-semibold text-xs text-muted-foreground whitespace-nowrap hidden sm:table-cell">Type</th>
                      <th className="text-left p-3 font-semibold text-xs text-muted-foreground whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors" data-testid={`row-email-log-${log.id}`}>
                        <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(log.sentAt)}</td>
                        <td className="p-3">
                          <span className="text-xs font-mono truncate block max-w-[150px] sm:max-w-none" title={log.recipientEmail} data-testid={`text-recipient-${log.id}`}>{log.recipientEmail}</span>
                        </td>
                        <td className="p-3 hidden sm:table-cell">
                          <span className="text-xs font-medium" data-testid={`text-seller-name-${log.id}`}>{log.sellerName}</span>
                        </td>
                        <td className="p-3 hidden md:table-cell">
                          {log.sellerCode ? (
                            <span className="text-xs font-mono text-blue-700 dark:text-blue-400" data-testid={`text-seller-code-${log.id}`}>{log.sellerCode}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </td>
                        <td className="p-3 hidden lg:table-cell">
                          <span className="text-xs text-muted-foreground truncate block max-w-[200px]" title={log.subject}>{log.subject}</span>
                        </td>
                        <td className="p-3 hidden sm:table-cell">
                          <span className="text-xs text-muted-foreground">{EMAIL_TYPE_LABELS[log.emailType] ?? log.emailType}</span>
                        </td>
                        <td className="p-3">
                          <StatusBadge status={log.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
