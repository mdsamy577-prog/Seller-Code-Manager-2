import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Seller, SellerApplication, SellerRenewalApplication } from "@shared/schema";
import { format, differenceInDays, parseISO } from "date-fns";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  Users,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Phone,
  Hash,
  Calendar,
  Clock,
  X,
  Link,
  Copy,
  Check,
  ClipboardList,
  LogOut,
  Mail,
  Send,
  Settings,
  BookOpen,
  Save,
  CalendarPlus,
  Archive,
  RotateCcw,
} from "lucide-react";
import { SiMeta } from "react-icons/si";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Skeleton } from "@/components/ui/skeleton";

const sellerFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone number is required"),
  email: z.string().email("Must be a valid email").optional().or(z.literal("")),
  facebookLink: z.string().url("Must be a valid URL"),
  duration: z.enum(["15_days", "1_month", "2_months", "3_months", "4_months", "5_months", "6_months", "7_months", "8_months", "9_months", "10_months", "11_months", "12_months"]),
  startDate: z.string().min(1, "Start date is required"),
});

type SellerFormValues = z.infer<typeof sellerFormSchema>;

function getSellerStatus(expiryDate: string): "active" | "expiring" | "expired" {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (expiryDate < todayStr) return "expired";
  const today = new Date(todayStr);
  const expiry = new Date(expiryDate);
  const diffDays = Math.round((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 3) return "expiring";
  return "active";
}

function StatusBadge({ expiryDate }: { expiryDate: string }) {
  const status = getSellerStatus(expiryDate);
  const config = {
    active: { label: "Active", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25" },
    expiring: { label: "Expiring Soon", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25" },
    expired: { label: "Expired", className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/25" },
  };
  const { label, className } = config[status];
  return (
    <Badge variant="outline" className={`${className} no-default-active-elevate`} data-testid={`badge-status-${status}`}>
      {status === "active" && <CheckCircle2 className="w-3 h-3 mr-1" />}
      {status === "expiring" && <AlertTriangle className="w-3 h-3 mr-1" />}
      {status === "expired" && <XCircle className="w-3 h-3 mr-1" />}
      {label}
    </Badge>
  );
}

function getRowClass(expiryDate: string): string {
  const status = getSellerStatus(expiryDate);
  if (status === "expired") return "bg-red-500/5 dark:bg-red-500/10";
  if (status === "expiring") return "bg-amber-500/5 dark:bg-amber-500/10";
  return "";
}

function StatsCards({
  sellers,
  archivedCount,
  onArchivedClick,
}: {
  sellers: Seller[];
  archivedCount: number;
  onArchivedClick: () => void;
}) {
  const active = sellers.filter((s) => getSellerStatus(s.expiryDate) === "active").length;
  const expiring = sellers.filter((s) => getSellerStatus(s.expiryDate) === "expiring").length;

  return (
    <div className="grid grid-cols-4 sm:grid-cols-4 gap-2 sm:gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 p-3 pb-1 sm:p-6 sm:pb-2">
          <CardTitle className="text-[10px] sm:text-sm font-medium text-muted-foreground leading-tight">
            <span className="sm:hidden">Total</span>
            <span className="hidden sm:inline">Total Sellers</span>
          </CardTitle>
          <Users className="hidden sm:block h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0 text-center sm:text-left">
          <div className="text-xl sm:text-2xl font-bold" data-testid="text-total-sellers">{sellers.length}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 p-3 pb-1 sm:p-6 sm:pb-2">
          <CardTitle className="text-[10px] sm:text-sm font-medium text-muted-foreground leading-tight">Active</CardTitle>
          <CheckCircle2 className="hidden sm:block h-4 w-4 text-emerald-500" />
        </CardHeader>
        <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0 text-center sm:text-left">
          <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400" data-testid="text-active-count">{active}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 p-3 pb-1 sm:p-6 sm:pb-2">
          <CardTitle className="text-[10px] sm:text-sm font-medium text-muted-foreground leading-tight">
            <span className="sm:hidden">Expiring</span>
            <span className="hidden sm:inline">Expiring Soon</span>
          </CardTitle>
          <AlertTriangle className="hidden sm:block h-4 w-4 text-amber-500" />
        </CardHeader>
        <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0 text-center sm:text-left">
          <div className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400" data-testid="text-expiring-count">{expiring}</div>
        </CardContent>
      </Card>
      <Card className="cursor-pointer hover:ring-1 hover:ring-red-400 transition-all" onClick={onArchivedClick} data-testid="card-archived">
        <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 p-3 pb-1 sm:p-6 sm:pb-2">
          <CardTitle className="text-[10px] sm:text-sm font-medium text-muted-foreground leading-tight">Expired</CardTitle>
          <Archive className="hidden sm:block h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0 text-center sm:text-left">
          <div className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-expired-count">{archivedCount}</div>
        </CardContent>
      </Card>
    </div>
  );
}

const durationLabels: Record<string, string> = {
  "15_days": "15 Days",
  "1_month": "1 Month",
  "2_months": "2 Months",
  "3_months": "3 Months",
  "4_months": "4 Months",
  "5_months": "5 Months",
  "6_months": "6 Months",
  "7_months": "7 Months",
  "8_months": "8 Months",
  "9_months": "9 Months",
  "10_months": "10 Months",
  "11_months": "11 Months",
  "12_months": "12 Months",
  "1": "1 Month",
  "2": "2 Months",
  "3": "3 Months",
  "4": "4 Months",
  "5": "5 Months",
  "6": "6 Months",
  "7": "7 Months",
  "8": "8 Months",
  "9": "9 Months",
  "10": "10 Months",
  "11": "11 Months",
  "12": "12 Months",
};

const sellerTypeLabels: Record<string, string> = {
  "personal_facebook_id": "Personal Facebook ID",
  "facebook_business_page": "Facebook Business Page",
};

const paymentMethodLabels: Record<string, string> = {
  "bkash": "Bkash",
  "nagad": "Nagad",
};

function PendingApplications() {
  const { toast } = useToast();

  const { data: applications = [], isLoading } = useQuery<SellerApplication[]>({
    queryKey: ["/api/applications"],
  });

  const pendingApps = applications.filter((a) => a.status === "pending");

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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (pendingApps.length === 0) {
    return null;
  }

  return (
    <Card data-testid="card-pending-applications">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-amber-500" />
          <CardTitle className="text-lg" data-testid="text-pending-title">
            Pending Seller Applications
          </CardTitle>
          <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25 no-default-active-elevate ml-2">
            {pendingApps.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0 sm:p-6 sm:pt-0">
        {/* Desktop table */}
        <div className="hidden sm:block rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Facebook Link</TableHead>
                <TableHead>Seller Type</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Payment Method</TableHead>
                <TableHead>Sender Number</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingApps.map((app) => (
                <TableRow key={app.id} data-testid={`row-pending-app-${app.id}`}>
                  <TableCell className="font-medium" data-testid={`text-pending-name-${app.id}`}>{app.name}</TableCell>
                  <TableCell data-testid={`text-pending-phone-${app.id}`}>
                    <span className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      {app.phone}
                    </span>
                  </TableCell>
                  <TableCell>
                    <a href={app.facebookLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-primary" data-testid={`link-pending-facebook-${app.id}`}>
                      <SiMeta className="h-3.5 w-3.5" />
                      <span className="text-sm">Profile</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </TableCell>
                  <TableCell data-testid={`text-pending-seller-type-${app.id}`}>
                    <Badge variant="secondary" className="no-default-active-elevate">{sellerTypeLabels[app.sellerType] || app.sellerType}</Badge>
                  </TableCell>
                  <TableCell data-testid={`text-pending-duration-${app.id}`}>
                    <Badge variant="secondary" className="no-default-active-elevate">{durationLabels[app.duration] || app.duration}</Badge>
                  </TableCell>
                  <TableCell data-testid={`text-pending-payment-${app.id}`}>
                    <Badge variant="secondary" className="no-default-active-elevate">{paymentMethodLabels[app.paymentMethod] || app.paymentMethod}</Badge>
                  </TableCell>
                  <TableCell data-testid={`text-pending-sender-${app.id}`}>{app.senderNumber}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="outline" className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-700 dark:hover:bg-emerald-950" onClick={() => approveMutation.mutate(app.id)} disabled={approveMutation.isPending || rejectMutation.isPending} data-testid={`button-pending-approve-${app.id}`}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Approve
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-700 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-950" onClick={() => rejectMutation.mutate(app.id)} disabled={approveMutation.isPending || rejectMutation.isPending} data-testid={`button-pending-reject-${app.id}`}>
                        <XCircle className="h-3.5 w-3.5 mr-1" />Reject
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile card list */}
        <div className="sm:hidden space-y-3 px-4 pb-4 pt-2">
          {pendingApps.map((app) => (
            <div key={app.id} className="border rounded-xl p-4 space-y-3 bg-card shadow-sm" data-testid={`row-pending-app-${app.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm" data-testid={`text-pending-name-${app.id}`}>{app.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1" data-testid={`text-pending-phone-${app.id}`}>
                    <Phone className="h-3 w-3" />{app.phone}
                  </p>
                </div>
                <a href={app.facebookLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-[#1877F2] hover:text-[#0e5bbf]" data-testid={`link-pending-facebook-${app.id}`}>
                  <SiMeta className="h-4 w-4" />
                  <span className="text-xs">Profile</span>
                </a>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="text-xs no-default-active-elevate" data-testid={`text-pending-seller-type-${app.id}`}>{sellerTypeLabels[app.sellerType] || app.sellerType}</Badge>
                <Badge variant="secondary" className="text-xs no-default-active-elevate" data-testid={`text-pending-duration-${app.id}`}>{durationLabels[app.duration] || app.duration}</Badge>
                <Badge variant="secondary" className="text-xs no-default-active-elevate" data-testid={`text-pending-payment-${app.id}`}>{paymentMethodLabels[app.paymentMethod] || app.paymentMethod}</Badge>
              </div>
              <p className="text-xs text-muted-foreground" data-testid={`text-pending-sender-${app.id}`}>Sender: {app.senderNumber}</p>
              <div className="flex gap-2 pt-0.5">
                <Button size="sm" variant="outline" className="flex-1 h-9 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-700 dark:hover:bg-emerald-950" onClick={() => approveMutation.mutate(app.id)} disabled={approveMutation.isPending || rejectMutation.isPending} data-testid={`button-pending-approve-${app.id}`}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Approve
                </Button>
                <Button size="sm" variant="outline" className="flex-1 h-9 text-xs text-red-700 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-950" onClick={() => rejectMutation.mutate(app.id)} disabled={approveMutation.isPending || rejectMutation.isPending} data-testid={`button-pending-reject-${app.id}`}>
                  <XCircle className="h-3.5 w-3.5 mr-1.5" />Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function GroupRules() {
  const { toast } = useToast();
  const [rules, setRules] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/settings/group-rules")
      .then((res) => res.json())
      .then((data) => {
        setRules(data.rules || "");
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiRequest("POST", "/api/settings/group-rules", { rules });
      toast({ title: "Group rules saved successfully" });
    } catch {
      toast({ title: "Failed to save group rules", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;

  return (
    <div className="space-y-3">
      <Textarea
        value={rules}
        onChange={(e) => setRules(e.target.value)}
        placeholder="Write your group rules here..."
        rows={8}
        className="resize-y"
      />
      <Button onClick={handleSave} disabled={saving} size="sm">
        <Save className="h-4 w-4 mr-2" />
        {saving ? "Saving..." : "Save Rules"}
      </Button>
    </div>
  );
}

function RegistrationLink() {
  const { toast } = useToast();
  const [copiedReg, setCopiedReg] = useState(false);
  const [copiedRenew, setCopiedRenew] = useState(false);
  const registrationUrl = `${window.location.origin}/apply`;
  const renewalUrl = `${window.location.origin}/renew`;

  const handleCopyReg = async () => {
    try {
      await navigator.clipboard.writeText(registrationUrl);
      setCopiedReg(true);
      toast({ title: "Link copied to clipboard" });
      setTimeout(() => setCopiedReg(false), 2000);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const handleCopyRenew = async () => {
    try {
      await navigator.clipboard.writeText(renewalUrl);
      setCopiedRenew(true);
      toast({ title: "Link copied to clipboard" });
      setTimeout(() => setCopiedRenew(false), 2000);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4" data-testid="card-registration-link">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Share this link for sellers to apply for a seller code</p>
        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={registrationUrl}
            className="font-mono text-xs sm:text-sm min-w-0"
            data-testid="input-registration-url"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={handleCopyReg}
            className="shrink-0"
            data-testid="button-copy-registration-link"
          >
            {copiedReg ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="space-y-2" data-testid="card-renewal-link">
        <p className="text-sm font-medium">Renewal Link</p>
        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={renewalUrl}
            className="font-mono text-xs sm:text-sm min-w-0"
            data-testid="input-renewal-url"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={handleCopyRenew}
            className="shrink-0"
            data-testid="button-copy-renewal-link"
          >
            {copiedRenew ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EmailSettings() {
  const { toast } = useToast();
  const [senderName, setSenderName] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [initialized, setInitialized] = useState(false);

  const { data: emailSettings, isLoading } = useQuery<{
    senderName: string;
    hasApiKey: boolean;
  }>({
    queryKey: ["/api/settings/email"],
  });

  useEffect(() => {
    if (emailSettings && !initialized) {
      setSenderName(emailSettings.senderName);
      setInitialized(true);
    }
  }, [emailSettings, initialized]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/settings/email", {
        senderName,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/email"] });
      toast({ title: "Email settings saved" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/settings/email/test", { testEmail });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Test email sent", description: `Check ${testEmail} for the test email.` });
      setTestEmail("");
    },
    onError: (error: Error) => {
      toast({ title: "Test failed", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) return null;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">API Status</label>
        <div className="flex items-center gap-2">
          {emailSettings?.hasApiKey ? (
            <Badge variant="outline" className="text-emerald-600 border-emerald-300">Resend API Key Configured</Badge>
          ) : (
            <Badge variant="outline" className="text-destructive border-destructive/30">Resend API Key Missing</Badge>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Sender Name (Optional)</label>
        <Input
          placeholder="CPS&S Seller Code"
          value={senderName}
          onChange={(e) => setSenderName(e.target.value)}
        />
      </div>
      <Button
        className="w-full"
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
      >
        {saveMutation.isPending ? "Saving..." : "Save Email Settings"}
      </Button>

      {emailSettings?.hasApiKey && (
        <div className="border-t pt-4 space-y-3">
          <label className="text-sm font-medium">Send Test Email</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="email"
              placeholder="test@example.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="flex-1"
            />
            <Button
              variant="outline"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending || !testEmail}
              className="sm:shrink-0"
            >
              <Send className="h-4 w-4 mr-1" />
              {testMutation.isPending ? "Sending..." : "Test"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SellerForm({
  seller,
  onClose,
}: {
  seller?: Seller;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const isEditing = !!seller;

  const form = useForm<SellerFormValues>({
    resolver: zodResolver(sellerFormSchema),
    defaultValues: {
      name: seller?.name || "",
      phone: seller?.phone || "",
      email: "",
      facebookLink: seller?.facebookLink || "",
      duration: (seller?.duration as SellerFormValues["duration"]) || "1_month",
      startDate: seller?.startDate || format(new Date(), "yyyy-MM-dd"),
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: SellerFormValues) => {
      const res = await apiRequest("POST", "/api/sellers", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sellers"] });
      toast({ title: "Seller added successfully" });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: SellerFormValues) => {
      const res = await apiRequest("PATCH", `/api/sellers/${seller!.id}`, {
        ...data,
        sellerCode: seller!.sellerCode,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sellers"] });
      toast({ title: "Seller updated successfully" });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: SellerFormValues) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter seller name" {...field} data-testid="input-name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number</FormLabel>
              <FormControl>
                <Input placeholder="Enter phone number" {...field} data-testid="input-phone" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {!isEditing && (
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email Address <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
                <FormControl>
                  <Input placeholder="Enter email address" type="email" {...field} data-testid="input-email" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <FormField
          control={form.control}
          name="facebookLink"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Facebook Profile Link</FormLabel>
              <FormControl>
                <Input placeholder="https://facebook.com/..." {...field} data-testid="input-facebook" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="duration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Duration</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-duration">
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="15_days">15 Days</SelectItem>
                    <SelectItem value="1_month">1 Month</SelectItem>
                    <SelectItem value="2_months">2 Months</SelectItem>
                    <SelectItem value="3_months">3 Months</SelectItem>
                    <SelectItem value="4_months">4 Months</SelectItem>
                    <SelectItem value="5_months">5 Months</SelectItem>
                    <SelectItem value="6_months">6 Months</SelectItem>
                    <SelectItem value="7_months">7 Months</SelectItem>
                    <SelectItem value="8_months">8 Months</SelectItem>
                    <SelectItem value="9_months">9 Months</SelectItem>
                    <SelectItem value="10_months">10 Months</SelectItem>
                    <SelectItem value="11_months">11 Months</SelectItem>
                    <SelectItem value="12_months">12 Months</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Date (YYYY-MM-DD)</FormLabel>
                <FormControl>
                  <Input type="date" {...field} data-testid="input-start-date" />
                </FormControl>
                <FormDescription className="text-xs">
                  {field.value && /^\d{4}-\d{2}-\d{2}$/.test(field.value)
                    ? format(parseISO(field.value), "MMM dd, yyyy")
                    : ""}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel">
            Cancel
          </Button>
          <Button type="submit" disabled={isPending} data-testid="button-submit">
            {isPending ? "Saving..." : isEditing ? "Update Seller" : "Add Seller"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex gap-4 items-center">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-20" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Users className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-1" data-testid="text-empty-title">No sellers yet</h3>
      <p className="text-muted-foreground mb-6 max-w-sm">
        Add your first seller to start managing Facebook group seller codes.
      </p>
      <Button onClick={onAdd} data-testid="button-add-first-seller">
        <Plus className="w-4 h-4 mr-2" />
        Add First Seller
      </Button>
    </div>
  );
}

export default function SellerCodeManager() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [durationFilter, setDurationFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSeller, setEditingSeller] = useState<Seller | undefined>();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editingCodeId, setEditingCodeId] = useState<number | null>(null);
  const [editingCodeValue, setEditingCodeValue] = useState("");
  const [emailDialogSeller, setEmailDialogSeller] = useState<Seller | undefined>();
  const [emailDialogInput, setEmailDialogInput] = useState("");
  const [settingsPanel, setSettingsPanel] = useState<"registration" | "email" | "group-rules" | null>(null);
  const [extendSeller, setExtendSeller] = useState<Seller | undefined>();
  const [extendMonths, setExtendMonths] = useState<number>(1);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [permanentDeleteId, setPermanentDeleteId] = useState<number | null>(null);
  const { toast } = useToast();

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/status"] });
      toast({ title: "Logged out successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const { data: sellers = [], isLoading } = useQuery<Seller[]>({
    queryKey: ["/api/sellers"],
  });

  const { data: applications = [] } = useQuery<SellerApplication[]>({
    queryKey: ["/api/applications"],
  });

  const { data: archivedSellers = [] } = useQuery<Seller[]>({
    queryKey: ["/api/sellers/archived"],
  });

  const { data: renewalApplications = [] } = useQuery<SellerRenewalApplication[]>({
    queryKey: ["/api/renewals"],
  });

  const pendingCount = applications.filter((a) => a.status === "pending").length;
  const pendingRenewalsCount = renewalApplications.filter((r) => r.status === "pending").length;

  const sortedSellers = [...sellers].sort(
    (a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()
  );

  const normalizeDuration = (d: string): string => {
    const map: Record<string, string> = {
      "1_month": "1", "2_months": "2", "3_months": "3", "4_months": "4",
      "5_months": "5", "6_months": "6", "7_months": "7", "8_months": "8",
      "9_months": "9", "10_months": "10", "11_months": "11", "12_months": "12",
    };
    return map[d] ?? d;
  };

  const filteredSellers = sortedSellers.filter((s) => {
    const matchesSearch = !searchQuery || (
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.sellerCode.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const matchesDuration = durationFilter === "all" || normalizeDuration(s.duration) === durationFilter;
    return matchesSearch && matchesDuration;
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/sellers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sellers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sellers/archived"] });
      toast({ title: "Seller moved to Expired" });
      setDeleteId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateCodeMutation = useMutation({
    mutationFn: async ({ id, sellerCode, seller }: { id: number; sellerCode: string; seller: Seller }) => {
      const res = await apiRequest("PATCH", `/api/sellers/${id}`, {
        name: seller.name,
        phone: seller.phone,
        facebookLink: seller.facebookLink,
        duration: seller.duration,
        startDate: seller.startDate,
        sellerCode,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sellers"] });
      toast({ title: "Seller code updated successfully" });
      setEditingCodeId(null);
      setEditingCodeValue("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateEmailMutation = useMutation({
    mutationFn: async ({ id, email }: { id: number; email: string }) => {
      const res = await apiRequest("PATCH", `/api/sellers/${id}/email`, { email });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sellers"] });
      setEmailDialogSeller(undefined);
      toast({ title: "Email updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resendEmailMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/sellers/${id}/resend-email`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Seller code email sent successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to send email", description: error.message, variant: "destructive" });
    },
  });

  const extendMutation = useMutation({
    mutationFn: async ({ id, months }: { id: number; months: number }) => {
      const res = await apiRequest("POST", `/api/sellers/${id}/extend`, { months });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sellers"] });
      setExtendSeller(undefined);
      toast({ title: "Subscription extended successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to extend subscription", description: error.message, variant: "destructive" });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/sellers/${id}/restore`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sellers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sellers/archived"] });
      toast({ title: "Seller restored successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to restore seller", description: error.message, variant: "destructive" });
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/sellers/${id}/permanent`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sellers/archived"] });
      toast({ title: "Seller permanently deleted" });
      setPermanentDeleteId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete seller", description: error.message, variant: "destructive" });
    },
  });

  const handleAdd = () => {
    setEditingSeller(undefined);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingSeller(undefined);
  };


  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight" data-testid="text-page-title">Seller Code Manager</h1>
            <p className="text-muted-foreground mt-0.5 text-sm hidden sm:block">Manage Facebook group seller codes and subscriptions</p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(pendingRenewalsCount > 0 ? "/applications?tab=renewals" : "/applications")}
              data-testid="button-seller-applications"
              className="h-9"
            >
              <div className="relative sm:mr-2">
                <ClipboardList className="w-4 h-4" />
                {(pendingCount + pendingRenewalsCount) > 0 && (
                  <span className="absolute -top-2 -right-2 flex items-center justify-center rounded-full bg-amber-500 text-white font-semibold leading-none min-w-[16px] h-[16px] px-[3px] text-[10px]" data-testid="badge-pending-count">
                    {pendingCount + pendingRenewalsCount}
                  </span>
                )}
              </div>
              <span className="hidden sm:inline">Seller Applications</span>
            </Button>

            <Button size="sm" onClick={handleAdd} data-testid="button-add-seller" className="h-9">
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Add Seller</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              data-testid="button-logout"
              className="h-9"
            >
              <LogOut className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">{logoutMutation.isPending ? "Logging out..." : "Logout"}</span>
            </Button>
          </div>
        </div>

        {!isLoading && (
          <StatsCards
            sellers={sellers}
            archivedCount={archivedSellers.length}
            onArchivedClick={() => setArchivedOpen(true)}
          />
        )}

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <CardTitle className="text-lg">Sellers</CardTitle>
              <div className="flex flex-row gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-72 sm:flex-none">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, phone, or code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      data-testid="button-clear-search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Select value={durationFilter} onValueChange={setDurationFilter}>
                  <SelectTrigger className="w-32 sm:w-36" data-testid="select-duration-filter">
                    <SelectValue placeholder="Duration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="1">1 Month</SelectItem>
                    <SelectItem value="2">2 Months</SelectItem>
                    <SelectItem value="3">3 Months</SelectItem>
                    <SelectItem value="4">4 Months</SelectItem>
                    <SelectItem value="5">5 Months</SelectItem>
                    <SelectItem value="6">6 Months</SelectItem>
                    <SelectItem value="7">7 Months</SelectItem>
                    <SelectItem value="8">8 Months</SelectItem>
                    <SelectItem value="9">9 Months</SelectItem>
                    <SelectItem value="10">10 Months</SelectItem>
                    <SelectItem value="11">11 Months</SelectItem>
                    <SelectItem value="12">12 Months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <TableSkeleton />
            ) : sellers.length === 0 ? (
              <EmptyState onAdd={handleAdd} />
            ) : filteredSellers.length === 0 ? (
              <div className="text-center py-12">
                <Search className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground" data-testid="text-no-results">No sellers match your search</p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden sm:block rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Facebook</TableHead>
                        <TableHead>Seller Code</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>Expiry Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSellers.map((seller) => (
                        <TableRow key={seller.id} className={getRowClass(seller.expiryDate)} data-testid={`row-seller-${seller.id}`}>
                          <TableCell className="font-medium" data-testid={`text-name-${seller.id}`}>{seller.name}</TableCell>
                          <TableCell data-testid={`text-phone-${seller.id}`}>
                            <span className="flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5 text-muted-foreground" />{seller.phone}
                            </span>
                          </TableCell>
                          <TableCell>
                            <a href={seller.facebookLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-primary" data-testid={`link-facebook-${seller.id}`}>
                              <SiMeta className="h-3.5 w-3.5" />
                              <span className="text-sm">Profile</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </TableCell>
                          <TableCell data-testid={`text-code-${seller.id}`}>
                            <div className="flex items-center gap-1.5">
                              <Badge variant="secondary" className="no-default-active-elevate font-mono">
                                <Hash className="h-3 w-3 mr-1" />{seller.sellerCode}
                              </Badge>
                              <button type="button" onClick={() => { setEmailDialogSeller(seller); setEmailDialogInput(seller.email ?? ""); }} className={`inline-flex items-center justify-center transition-colors ${seller.email ? "text-blue-500 hover:text-blue-700" : "text-muted-foreground hover:text-primary"}`} data-testid={`button-email-popup-${seller.id}`}>
                                <Mail className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </TableCell>
                          <TableCell data-testid={`text-start-${seller.id}`}>
                            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Calendar className="h-3.5 w-3.5" />{format(parseISO(seller.startDate), "MMM dd, yyyy")}
                            </span>
                          </TableCell>
                          <TableCell data-testid={`text-expiry-${seller.id}`}>
                            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Clock className="h-3.5 w-3.5" />{format(parseISO(seller.expiryDate), "MMM dd, yyyy")}
                            </span>
                          </TableCell>
                          <TableCell><StatusBadge expiryDate={seller.expiryDate} /></TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button size="icon" variant="ghost" onClick={() => { setExtendSeller(seller); setExtendMonths(1); }} data-testid={`button-extend-${seller.id}`} title="Extend subscription">
                                <CalendarPlus className="h-4 w-4 text-emerald-600" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => setDeleteId(seller.id)} data-testid={`button-delete-${seller.id}`}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile card list */}
                <div className="sm:hidden space-y-3">
                  {filteredSellers.map((seller) => (
                    <div key={seller.id} className={`border rounded-xl p-4 space-y-3 shadow-sm ${getRowClass(seller.expiryDate) || "bg-card"}`} data-testid={`row-seller-${seller.id}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate" data-testid={`text-name-${seller.id}`}>{seller.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1" data-testid={`text-phone-${seller.id}`}>
                            <Phone className="h-3 w-3 shrink-0" />{seller.phone}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <StatusBadge expiryDate={seller.expiryDate} />
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setExtendSeller(seller); setExtendMonths(1); }} data-testid={`button-extend-${seller.id}`} title="Extend subscription">
                            <CalendarPlus className="h-3.5 w-3.5 text-emerald-600" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDeleteId(seller.id)} data-testid={`button-delete-${seller.id}`}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="no-default-active-elevate font-mono text-xs" data-testid={`text-code-${seller.id}`}>
                          <Hash className="h-3 w-3 mr-1" />{seller.sellerCode}
                        </Badge>
                        <button type="button" onClick={() => { setEmailDialogSeller(seller); setEmailDialogInput(seller.email ?? ""); }} className={`inline-flex items-center justify-center transition-colors ${seller.email ? "text-blue-500 hover:text-blue-700" : "text-muted-foreground hover:text-primary"}`} data-testid={`button-email-popup-${seller.id}`}>
                          <Mail className="h-4 w-4" />
                        </button>
                        <a href={seller.facebookLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-[#1877F2] hover:text-[#0e5bbf]" data-testid={`link-facebook-${seller.id}`}>
                          <SiMeta className="h-3.5 w-3.5" />Profile
                        </a>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1" data-testid={`text-start-${seller.id}`}>
                          <Calendar className="h-3 w-3 shrink-0" />{format(parseISO(seller.startDate), "MMM dd, yyyy")}
                        </span>
                        <span className="flex items-center gap-1" data-testid={`text-expiry-${seller.id}`}>
                          <Clock className="h-3 w-3 shrink-0" />Exp: {format(parseISO(seller.expiryDate), "MMM dd, yyyy")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-2">
            <div className="grid grid-cols-3 divide-x">
              {([
                { key: "registration", icon: Link, label: "Registration Link" },
                { key: "email", icon: Settings, label: "Email Settings" },
                { key: "group-rules", icon: BookOpen, label: "Group Rules" },
              ] as const).map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSettingsPanel(key)}
                  className="flex flex-col items-center gap-1.5 py-3 px-2 hover:bg-muted rounded-none transition-colors first:rounded-l-lg last:rounded-r-lg"
                  data-testid={`button-settings-${key}`}
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium leading-tight text-center">{label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Dialog open={emailDialogSeller !== undefined} onOpenChange={(o) => { if (!o) setEmailDialogSeller(undefined); }}>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-sm sm:w-full rounded-xl sm:rounded-lg" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>Update Email</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-1">
              <Input
                type="email"
                placeholder="seller@email.com"
                value={emailDialogInput}
                onChange={(e) => setEmailDialogInput(e.target.value)}
                className="h-9"
                data-testid={`input-email-edit-${emailDialogSeller?.id}`}
              />
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => emailDialogSeller && updateEmailMutation.mutate({ id: emailDialogSeller.id, email: emailDialogInput })}
                  disabled={updateEmailMutation.isPending}
                  data-testid={`button-email-save-${emailDialogSeller?.id}`}
                >
                  <Save className="h-4 w-4 mr-2" />Save
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => emailDialogSeller && resendEmailMutation.mutate(emailDialogSeller.id)}
                  disabled={resendEmailMutation.isPending || !emailDialogSeller?.email}
                  data-testid={`button-resend-email-${emailDialogSeller?.id}`}
                >
                  <Send className="h-4 w-4 mr-2" />Resend Code
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={settingsPanel === "registration"} onOpenChange={(o) => { if (!o) setSettingsPanel(null); }}>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-sm sm:w-full rounded-xl sm:rounded-lg" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Link className="h-4 w-4" />Seller Registration Link</DialogTitle>
            </DialogHeader>
            <RegistrationLink />
          </DialogContent>
        </Dialog>

        <Dialog open={settingsPanel === "email"} onOpenChange={(o) => { if (!o) setSettingsPanel(null); }}>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-sm sm:w-full rounded-xl sm:rounded-lg" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Settings className="h-4 w-4" />Email Settings</DialogTitle>
            </DialogHeader>
            <EmailSettings />
          </DialogContent>
        </Dialog>

        <Dialog open={settingsPanel === "group-rules"} onOpenChange={(o) => { if (!o) setSettingsPanel(null); }}>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-lg sm:w-full rounded-xl sm:rounded-lg" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><BookOpen className="h-4 w-4" />Group Rules</DialogTitle>
            </DialogHeader>
            <GroupRules />
          </DialogContent>
        </Dialog>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-lg sm:w-full rounded-xl sm:rounded-lg" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>{editingSeller ? "Edit Seller" : "Add New Seller"}</DialogTitle>
            </DialogHeader>
            <SellerForm seller={editingSeller} onClose={handleCloseDialog} />
          </DialogContent>
        </Dialog>

        <Dialog open={extendSeller !== undefined} onOpenChange={(o) => { if (!o) setExtendSeller(undefined); }}>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-sm sm:w-full rounded-xl sm:rounded-lg" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarPlus className="h-5 w-5 text-emerald-600" />
                Extend Subscription
              </DialogTitle>
            </DialogHeader>
            {extendSeller && (
              <div className="space-y-4 pt-1">
                <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Seller</span>
                    <span className="font-medium">{extendSeller.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Code</span>
                    <span className="font-mono font-semibold text-primary">{extendSeller.sellerCode}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Current expiry</span>
                    <span className="font-medium">{format(parseISO(extendSeller.expiryDate), "MMM dd, yyyy")}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Extend by</p>
                  <div className="grid grid-cols-2 gap-2">
                    {([1, 3, 6, 12] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setExtendMonths(m)}
                        data-testid={`button-extend-months-${m}`}
                        className={`rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                          extendMonths === m
                            ? "border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                            : "border-border hover:bg-muted"
                        }`}
                      >
                        {m === 1 ? "1 Month" : `${m} Months`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button variant="outline" className="flex-1" onClick={() => setExtendSeller(undefined)} data-testid="button-cancel-extend">
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => extendMutation.mutate({ id: extendSeller.id, months: extendMonths })}
                    disabled={extendMutation.isPending}
                    data-testid="button-confirm-extend"
                  >
                    {extendMutation.isPending ? "Extending..." : "Confirm"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Move Seller to Expired</AlertDialogTitle>
              <AlertDialogDescription>
                This seller will be moved to the Expired section. You can restore them later if needed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteId && deleteMutation.mutate(deleteId)}
                className="bg-destructive text-destructive-foreground"
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending ? "Moving..." : "Move to Expired"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={permanentDeleteId !== null} onOpenChange={() => setPermanentDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Permanently Delete Seller</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. The seller will be permanently removed from the database.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-permanent-delete">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => permanentDeleteId && permanentDeleteMutation.mutate(permanentDeleteId)}
                className="bg-destructive text-destructive-foreground"
                data-testid="button-confirm-permanent-delete"
              >
                {permanentDeleteMutation.isPending ? "Deleting..." : "Permanently Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={archivedOpen} onOpenChange={setArchivedOpen}>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl sm:w-full rounded-xl sm:rounded-lg" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Archive className="h-5 w-5 text-red-500" />
                Expired Sellers ({archivedSellers.length})
              </DialogTitle>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto">
              {archivedSellers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Archive className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No expired sellers</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {archivedSellers.map((seller) => (
                    <div key={seller.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 bg-red-500/5" data-testid={`row-archived-${seller.id}`}>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="font-semibold text-sm truncate" data-testid={`text-archived-name-${seller.id}`}>{seller.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1" data-testid={`text-archived-phone-${seller.id}`}>
                          <Phone className="h-3 w-3" />{seller.phone}
                        </p>
                        <p className="text-xs font-mono text-primary" data-testid={`text-archived-code-${seller.id}`}>{seller.sellerCode}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1" data-testid={`text-archived-expiry-${seller.id}`}>
                          <Clock className="h-3 w-3" />Expired: {format(parseISO(seller.expiryDate), "MMM dd, yyyy")}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                          onClick={() => restoreMutation.mutate(seller.id)}
                          disabled={restoreMutation.isPending}
                          data-testid={`button-restore-${seller.id}`}
                        >
                          <RotateCcw className="h-3.5 w-3.5 sm:mr-1" />
                          <span className="hidden sm:inline">Restore</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-destructive hover:text-destructive"
                          onClick={() => setPermanentDeleteId(seller.id)}
                          data-testid={`button-permanent-delete-${seller.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
