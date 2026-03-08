import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Seller, SellerApplication } from "@shared/schema";
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
} from "lucide-react";
import { SiMeta } from "react-icons/si";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  facebookLink: z.string().url("Must be a valid URL"),
  duration: z.enum(["15_days", "1_month", "2_months", "3_months", "4_months", "5_months", "6_months", "7_months", "8_months", "9_months", "10_months", "11_months", "12_months"]),
  startDate: z.string().min(1, "Start date is required"),
});

type SellerFormValues = z.infer<typeof sellerFormSchema>;

function getSellerStatus(expiryDate: string): "active" | "expiring" | "expired" {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = parseISO(expiryDate);
  const daysUntilExpiry = differenceInDays(expiry, today);
  if (daysUntilExpiry < 0) return "expired";
  if (daysUntilExpiry <= 3) return "expiring";
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

function StatsCards({ sellers }: { sellers: Seller[] }) {
  const active = sellers.filter((s) => getSellerStatus(s.expiryDate) === "active").length;
  const expiring = sellers.filter((s) => getSellerStatus(s.expiryDate) === "expiring").length;
  const expired = sellers.filter((s) => getSellerStatus(s.expiryDate) === "expired").length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Sellers</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="text-total-sellers">{sellers.length}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400" data-testid="text-active-count">{active}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Expiring Soon</CardTitle>
          <AlertTriangle className="h-4 w-4 text-amber-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400" data-testid="text-expiring-count">{expiring}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Expired</CardTitle>
          <XCircle className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-expired-count">{expired}</div>
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
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
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
                    <a
                      href={app.facebookLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-primary"
                      data-testid={`link-pending-facebook-${app.id}`}
                    >
                      <SiMeta className="h-3.5 w-3.5" />
                      <span className="text-sm">Profile</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </TableCell>
                  <TableCell data-testid={`text-pending-seller-type-${app.id}`}>
                    <Badge variant="secondary" className="no-default-active-elevate">
                      {sellerTypeLabels[app.sellerType] || app.sellerType}
                    </Badge>
                  </TableCell>
                  <TableCell data-testid={`text-pending-duration-${app.id}`}>
                    <Badge variant="secondary" className="no-default-active-elevate">
                      {durationLabels[app.duration] || app.duration}
                    </Badge>
                  </TableCell>
                  <TableCell data-testid={`text-pending-payment-${app.id}`}>
                    <Badge variant="secondary" className="no-default-active-elevate">
                      {paymentMethodLabels[app.paymentMethod] || app.paymentMethod}
                    </Badge>
                  </TableCell>
                  <TableCell data-testid={`text-pending-sender-${app.id}`}>
                    {app.senderNumber}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-700 dark:hover:bg-emerald-950"
                        onClick={() => approveMutation.mutate(app.id)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        data-testid={`button-pending-approve-${app.id}`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-700 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-950"
                        onClick={() => rejectMutation.mutate(app.id)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        data-testid={`button-pending-reject-${app.id}`}
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function RegistrationLink() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const registrationUrl = `${window.location.origin}/apply`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(registrationUrl);
      setCopied(true);
      toast({ title: "Link copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  return (
    <Card data-testid="card-registration-link">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Link className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle className="text-lg" data-testid="text-registration-title">Seller Registration Link</CardTitle>
            <CardDescription>
              Share this link for sellers to apply for a seller code
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={registrationUrl}
            className="font-mono text-sm"
            data-testid="input-registration-url"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={handleCopy}
            data-testid="button-copy-registration-link"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
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
        <div className="grid grid-cols-2 gap-4">
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
                <FormLabel>Start Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} data-testid="input-start-date" />
                </FormControl>
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSeller, setEditingSeller] = useState<Seller | undefined>();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editingCodeId, setEditingCodeId] = useState<number | null>(null);
  const [editingCodeValue, setEditingCodeValue] = useState("");
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


  const sortedSellers = [...sellers].sort(
    (a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()
  );

  const filteredSellers = searchQuery
    ? sortedSellers.filter(
        (s) =>
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.sellerCode.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : sortedSellers;

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/sellers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sellers"] });
      toast({ title: "Seller deleted successfully" });
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
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Seller Code Manager</h1>
            <p className="text-muted-foreground mt-1">Manage Facebook group seller codes and subscriptions</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/applications")} data-testid="button-seller-applications">
              <ClipboardList className="w-4 h-4 mr-2" />
              Seller Applications
            </Button>
            <Button onClick={handleAdd} data-testid="button-add-seller">
              <Plus className="w-4 h-4 mr-2" />
              Add Seller
            </Button>
            <Button
              variant="outline"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4 mr-2" />
              {logoutMutation.isPending ? "Logging out..." : "Logout"}
            </Button>
          </div>
        </div>

        {!isLoading && <StatsCards sellers={sellers} />}

        <PendingApplications />

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <CardTitle className="text-lg">Sellers</CardTitle>
              <div className="relative w-full sm:w-72">
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
              <div className="rounded-md border overflow-x-auto">
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
                      <TableRow
                        key={seller.id}
                        className={getRowClass(seller.expiryDate)}
                        data-testid={`row-seller-${seller.id}`}
                      >
                        <TableCell className="font-medium" data-testid={`text-name-${seller.id}`}>{seller.name}</TableCell>
                        <TableCell data-testid={`text-phone-${seller.id}`}>
                          <span className="flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                            {seller.phone}
                          </span>
                        </TableCell>
                        <TableCell>
                          <a
                            href={seller.facebookLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-primary"
                            data-testid={`link-facebook-${seller.id}`}
                          >
                            <SiMeta className="h-3.5 w-3.5" />
                            <span className="text-sm">Profile</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </TableCell>
                        <TableCell data-testid={`text-code-${seller.id}`}>
                          {editingCodeId === seller.id ? (
                            <div className="flex items-center gap-1">
                              <Input
                                value={editingCodeValue}
                                onChange={(e) => setEditingCodeValue(e.target.value)}
                                className="h-7 w-32 font-mono text-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    updateCodeMutation.mutate({ id: seller.id, sellerCode: editingCodeValue, seller });
                                  } else if (e.key === "Escape") {
                                    setEditingCodeId(null);
                                    setEditingCodeValue("");
                                  }
                                }}
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => updateCodeMutation.mutate({ id: seller.id, sellerCode: editingCodeValue, seller })}
                                disabled={updateCodeMutation.isPending}
                              >
                                <Check className="h-4 w-4 text-emerald-600" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => { setEditingCodeId(null); setEditingCodeValue(""); }}
                              >
                                <X className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </div>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="no-default-active-elevate font-mono cursor-pointer hover:bg-muted"
                              onClick={() => { setEditingCodeId(seller.id); setEditingCodeValue(seller.sellerCode); }}
                            >
                              <Hash className="h-3 w-3 mr-1" />
                              {seller.sellerCode}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell data-testid={`text-start-${seller.id}`}>
                          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            {format(parseISO(seller.startDate), "MMM dd, yyyy")}
                          </span>
                        </TableCell>
                        <TableCell data-testid={`text-expiry-${seller.id}`}>
                          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            {format(parseISO(seller.expiryDate), "MMM dd, yyyy")}
                          </span>
                        </TableCell>
                        <TableCell>
                          <StatusBadge expiryDate={seller.expiryDate} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setDeleteId(seller.id)}
                              data-testid={`button-delete-${seller.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <RegistrationLink />

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>{editingSeller ? "Edit Seller" : "Add New Seller"}</DialogTitle>
            </DialogHeader>
            <SellerForm seller={editingSeller} onClose={handleCloseDialog} />
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Seller</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this seller? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteId && deleteMutation.mutate(deleteId)}
                className="bg-destructive text-destructive-foreground"
                data-testid="button-confirm-delete"
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
