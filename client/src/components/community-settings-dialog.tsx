import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { SocialCommunityLink, InsertSocialCommunityLink } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SiFacebook, SiMessenger, SiWhatsapp, SiTelegram } from "react-icons/si";
import {
  Globe,
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  ArrowUp,
  ArrowDown,
  Loader2,
  Users,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from "lucide-react";

interface CommunitySettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type PlatformKey = "facebook" | "messenger" | "whatsapp" | "telegram" | "other";

interface PlatformMeta {
  key: PlatformKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  badgeBg: string;
  maxCount?: number;
  description: string;
}

const PLATFORMS: PlatformMeta[] = [
  {
    key: "facebook",
    label: "Facebook Groups",
    icon: SiFacebook,
    color: "text-[#1877F2]",
    badgeBg: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    maxCount: 5,
    description: "অফিসিয়াল ফেসবুক কমিউনিটি গ্রুপ (সর্বোচ্চ ৫টি)",
  },
  {
    key: "messenger",
    label: "Facebook Messenger",
    icon: SiMessenger,
    color: "text-[#0084FF]",
    badgeBg: "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800",
    description: "মেসেঞ্জার সাপোর্ট বা চ্যাট কমিউনিটি",
  },
  {
    key: "whatsapp",
    label: "WhatsApp Groups",
    icon: SiWhatsapp,
    color: "text-[#25D366]",
    badgeBg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    description: "হোয়াটসঅ্যাপ সাপোর্ট বা ব্রডকাস্ট গ্রুপ",
  },
  {
    key: "telegram",
    label: "Telegram Groups",
    icon: SiTelegram,
    color: "text-[#24A1DE]",
    badgeBg: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800",
    description: "টেলিগ্রাম গ্রুপ বা অফিশিয়াল চ্যানেল",
  },
  {
    key: "other",
    label: "Other Community",
    icon: Globe,
    color: "text-orange-600 dark:text-orange-400",
    badgeBg: "bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200 dark:border-orange-800",
    description: "অন্যান্য সোশ্যাল প্ল্যাটফর্ম বা ফোরাম লিংক",
  },
];

export function CommunitySettingsDialog({
  open,
  onOpenChange,
}: CommunitySettingsDialogProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<PlatformKey | "all">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<SocialCommunityLink | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Form State
  const [formPlatform, setFormPlatform] = useState<PlatformKey>("facebook");
  const [formGroupName, setFormGroupName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formInvitationUrl, setFormInvitationUrl] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);

  // Query all community links
  const {
    data: allLinks = [],
    isLoading,
    refetch,
  } = useQuery<SocialCommunityLink[]>({
    queryKey: ["/api/admin/community-links"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/community-links");
      return res.json();
    },
    enabled: open,
  });

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: async (data: InsertSocialCommunityLink) => {
      const res = await apiRequest("POST", "/api/admin/community-links", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/community-links"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/community-links"] });
      toast({
        title: "কমিউনিটি লিংক যোগ হয়েছে",
        description: "নতুন গ্রুপ সফলভাবে সংরক্ষণ করা হয়েছে।",
      });
      closeForm();
    },
    onError: (err: any) => {
      toast({
        title: "যোগ করতে ব্যর্থ",
        description: err.message || "কমিউনিটি লিংক যোগ করা সম্ভব হয়নি।",
        variant: "destructive",
      });
    },
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: Partial<InsertSocialCommunityLink>;
    }) => {
      const res = await apiRequest("PUT", `/api/admin/community-links/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/community-links"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/community-links"] });
      toast({
        title: "কমিউনিটি লিংক আপডেট হয়েছে",
        description: "পরিবর্তনগুলো সফলভাবে সংরক্ষণ করা হয়েছে।",
      });
      closeForm();
    },
    onError: (err: any) => {
      toast({
        title: "আপডেট ব্যর্থ",
        description: err.message || "কমিউনিটি লিংক আপডেট করা সম্ভব হয়নি।",
        variant: "destructive",
      });
    },
  });

  // Toggle Mutation
  const toggleMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/admin/community-links/${id}/toggle`);
      return res.json();
    },
    onSuccess: (updated: SocialCommunityLink) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/community-links"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/community-links"] });
      toast({
        title: updated.isActive ? "গ্রুপ সক্রিয় করা হয়েছে" : "গ্রুপ নিষ্ক্রিয় করা হয়েছে",
        description: updated.isActive
          ? "পাবলিক ওয়েবসাইটে এই গ্রুপটি প্রদর্শিত হবে।"
          : "পাবলিক ওয়েবসাইট থেকে এটি লুকিয়ে রাখা হয়েছে।",
      });
    },
    onError: (err: any) => {
      toast({
        title: "স্ট্যাটাস পরিবর্তন ব্যর্থ",
        description: err.message || "স্ট্যাটাস পরিবর্তন করা যায়নি।",
        variant: "destructive",
      });
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/community-links/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/community-links"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/community-links"] });
      toast({
        title: "গ্রুপ মুছে ফেলা হয়েছে",
        description: "কমিউনিটি লিংক সফলভাবে মুছে ফেলা হয়েছে।",
      });
      setDeletingId(null);
    },
    onError: (err: any) => {
      toast({
        title: "মুছতে ব্যর্থ",
        description: err.message || "কমিউনিটি লিংক মুছে ফেলা সম্ভব হয়নি।",
        variant: "destructive",
      });
    },
  });

  // Reorder Mutation
  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: number[]) => {
      const res = await apiRequest("POST", "/api/admin/community-links/reorder", {
        orderedIds,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/community-links"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/community-links"] });
    },
  });

  const openAddForm = (defaultPlatform: PlatformKey = "facebook") => {
    setEditingLink(null);
    setFormPlatform(defaultPlatform);
    setFormGroupName("");
    setFormDescription("");
    setFormInvitationUrl("");
    setFormIsActive(true);
    setFormOpen(true);
  };

  const openEditForm = (link: SocialCommunityLink) => {
    setEditingLink(link);
    setFormPlatform(link.platform as PlatformKey);
    setFormGroupName(link.groupName);
    setFormDescription(link.description || "");
    setFormInvitationUrl(link.invitationUrl);
    setFormIsActive(link.isActive);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingLink(null);
    setFormGroupName("");
    setFormDescription("");
    setFormInvitationUrl("");
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formGroupName.trim()) {
      toast({
        title: "গ্রুপ নাম আবশ্যক",
        description: "অনুগ্রহ করে একটি গ্রুপ নাম লিখুন।",
        variant: "destructive",
      });
      return;
    }

    const trimmedUrl = formInvitationUrl.trim();
    if (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://")) {
      toast({
        title: "সঠিক URL দিন",
        description: "ইনভিটেশন লিংক অবশ্যই https:// বা http:// দিয়ে শুরু হতে হবে।",
        variant: "destructive",
      });
      return;
    }

    if (editingLink) {
      updateMutation.mutate({
        id: editingLink.id,
        data: {
          platform: formPlatform,
          groupName: formGroupName.trim(),
          description: formDescription.trim() || null,
          invitationUrl: trimmedUrl,
          isActive: formIsActive,
        },
      });
    } else {
      createMutation.mutate({
        platform: formPlatform,
        groupName: formGroupName.trim(),
        description: formDescription.trim() || null,
        invitationUrl: trimmedUrl,
        isActive: formIsActive,
        displayOrder: allLinks.length,
      });
    }
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= allLinks.length) return;

    const newOrder = [...allLinks];
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;

    reorderMutation.mutate(newOrder.map((l) => l.id));
  };

  // Group links by platform
  const filteredLinks =
    activeTab === "all"
      ? allLinks
      : allLinks.filter((l) => l.platform === activeTab);

  const getPlatformCount = (p: PlatformKey) =>
    allLinks.filter((l) => l.platform === p).length;

  const fbCount = getPlatformCount("facebook");
  const canAddFacebook = fbCount < 5;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="w-[calc(100vw-1.5rem)] max-w-4xl max-h-[88vh] flex flex-col p-0 rounded-2xl overflow-hidden"
          aria-describedby={undefined}
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b bg-gradient-to-r from-orange-50/50 via-background to-background dark:from-slate-900/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center border border-orange-500/20">
                    <Users className="w-5 h-5" />
                  </div>
                  <span>Social Media & Community Links</span>
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-1">
                  অফিসিয়াল সোশ্যাল গ্রুপ ও কমিউনিটি লিংকগুলো ম্যানেজ করুন। পাবলিক ওয়েবসাইটে শুধু সক্রিয় লিংকগুলো দেখাবে।
                </DialogDescription>
              </div>

              <Button
                onClick={() => openAddForm(activeTab === "all" ? "facebook" : activeTab)}
                size="sm"
                className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl gap-1.5 shadow-xs font-semibold self-start sm:self-auto"
                data-testid="button-add-community-link"
              >
                <Plus className="w-4 h-4" />
                <span>Add Community Group</span>
              </Button>
            </div>

            {/* Platform Filter Tabs */}
            <div className="flex items-center gap-1.5 mt-4 overflow-x-auto pb-1 scrollbar-none">
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                  activeTab === "all"
                    ? "bg-orange-600 text-white shadow-xs"
                    : "bg-muted/60 hover:bg-muted text-muted-foreground"
                }`}
                data-testid="tab-platform-all"
              >
                All Links ({allLinks.length})
              </button>

              {PLATFORMS.map((p) => {
                const Icon = p.icon;
                const count = getPlatformCount(p.key);
                const isSelected = activeTab === p.key;

                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setActiveTab(p.key)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                      isSelected
                        ? "bg-orange-600 text-white shadow-xs"
                        : "bg-muted/60 hover:bg-muted text-muted-foreground"
                    }`}
                    data-testid={`tab-platform-${p.key}`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-white" : p.color}`} />
                    <span>{p.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-background/80 text-foreground"
                      }`}
                    >
                      {p.maxCount ? `${count}/${p.maxCount}` : count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Links List Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-orange-600" />
                <span>কমিউনিটি লিংক লোড হচ্ছে...</span>
              </div>
            ) : filteredLinks.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-2xl p-6 bg-muted/20">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-600 flex items-center justify-center mx-auto mb-3">
                  <Users className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-sm sm:text-base text-foreground mb-1">
                  কোনো কমিউনিটি লিংক পাওয়া যায়নি
                </h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-4">
                  {activeTab === "all"
                    ? "পাবলিক ওয়েবসাইটে দেখানোর জন্য নতুন ফেসবুক, টেলিগ্রাম বা হোয়াটসঅ্যাপ গ্রুপ যোগ করুন।"
                    : `${activeTab} প্ল্যাটফর্মের জন্য এখনও কোনো গ্রুপ যোগ করা হয়নি।`}
                </p>
                <Button
                  onClick={() => openAddForm(activeTab === "all" ? "facebook" : activeTab)}
                  size="sm"
                  variant="outline"
                  className="rounded-xl border-orange-500/30 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  গ্রুপ যোগ করুন
                </Button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredLinks.map((link, idx) => {
                  const pMeta = PLATFORMS.find((p) => p.key === link.platform) || PLATFORMS[4];
                  const Icon = pMeta.icon;

                  return (
                    <div
                      key={link.id}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl border bg-card transition-all ${
                        link.isActive
                          ? "border-border shadow-xs hover:border-orange-500/30"
                          : "border-border/60 bg-muted/30 opacity-75"
                      }`}
                      data-testid={`row-community-link-${link.id}`}
                    >
                      {/* Left: Platform Icon & Name */}
                      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${pMeta.badgeBg}`}
                        >
                          <Icon className={`w-5 h-5 ${pMeta.color}`} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="font-bold text-sm sm:text-base text-foreground truncate"
                              data-testid={`text-admin-group-name-${link.id}`}
                            >
                              {link.groupName}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] uppercase font-bold py-0 h-4.5 ${pMeta.badgeBg}`}
                            >
                              {pMeta.label}
                            </Badge>
                            {link.isActive ? (
                              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25 text-[10px] py-0 h-4.5">
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] py-0 h-4.5 text-muted-foreground">
                                Inactive
                              </Badge>
                            )}
                          </div>

                          {link.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                              {link.description}
                            </p>
                          )}

                          <a
                            href={link.invitationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-mono text-orange-600 dark:text-orange-400 hover:underline mt-1 truncate max-w-full"
                            title={link.invitationUrl}
                          >
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            <span className="truncate">{link.invitationUrl}</span>
                          </a>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50 w-full sm:w-auto justify-end">
                        {/* Move Up/Down */}
                        <div className="flex items-center border rounded-lg bg-muted/40 mr-1">
                          <button
                            type="button"
                            onClick={() => handleMove(idx, "up")}
                            disabled={idx === 0 || activeTab !== "all"}
                            className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 rounded-l-lg transition-colors"
                            title="Move Up"
                            data-testid={`button-move-up-${link.id}`}
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <div className="w-[1px] h-3.5 bg-border" />
                          <button
                            type="button"
                            onClick={() => handleMove(idx, "down")}
                            disabled={idx === filteredLinks.length - 1 || activeTab !== "all"}
                            className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 rounded-r-lg transition-colors"
                            title="Move Down"
                            data-testid={`button-move-down-${link.id}`}
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Active Toggle Switch */}
                        <div className="flex items-center gap-1.5 px-2">
                          <Switch
                            checked={link.isActive}
                            onCheckedChange={() => toggleMutation.mutate(link.id)}
                            disabled={toggleMutation.isPending}
                            data-testid={`switch-toggle-${link.id}`}
                            title={link.isActive ? "সক্রিয় রয়েছে" : "নিষ্ক্রিয় রয়েছে"}
                          />
                        </div>

                        {/* Edit Button */}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => openEditForm(link)}
                          data-testid={`button-edit-${link.id}`}
                          title="Edit Group"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>

                        {/* Delete Button */}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => setDeletingId(link.id)}
                          data-testid={`button-delete-${link.id}`}
                          title="Delete Group"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Info */}
          <div className="p-4 border-t bg-muted/20 text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-orange-600 shrink-0" />
              <span>Facebook Groups-এ সর্বোচ্চ ৫টি গ্রুপ যোগ করা যাবে। ইনঅ্যাক্টিভ বা ফাঁকা প্ল্যাটফর্ম ওয়েবসাইটে লুকানো থাকবে।</span>
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs h-8"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Form Modal */}
      <Dialog open={formOpen} onOpenChange={(o) => { if (!o) closeForm(); }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-2xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-4 h-4 text-orange-600" />
              <span>{editingLink ? "Edit Community Group" : "Add Community Group"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              গ্রুপের তথ্য ও ইনভিটেশন লিংক প্রদান করুন।
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            {/* Platform Selector */}
            <div className="space-y-1.5">
              <Label htmlFor="input-platform" className="text-xs font-semibold">
                Platform
              </Label>
              <Select
                value={formPlatform}
                onValueChange={(val: PlatformKey) => setFormPlatform(val)}
                disabled={Boolean(editingLink)}
              >
                <SelectTrigger id="input-platform" className="h-9 text-xs" data-testid="select-platform">
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => {
                    const Icon = p.icon;
                    const count = getPlatformCount(p.key);
                    const disabled = !editingLink && p.key === "facebook" && count >= 5;

                    return (
                      <SelectItem
                        key={p.key}
                        value={p.key}
                        disabled={disabled}
                        className="text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Icon className={`w-3.5 h-3.5 ${p.color}`} />
                          <span>{p.label}</span>
                          {p.maxCount && (
                            <span className="text-[10px] text-muted-foreground">
                              ({count}/{p.maxCount})
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {formPlatform === "facebook" && !editingLink && fbCount >= 5 && (
                <p className="text-[11px] text-red-600">
                  ফেসবুক গ্রুপের সর্বোচ্চ সীমা (৫টি) পূর্ণ হয়েছে।
                </p>
              )}
            </div>

            {/* Group Name */}
            <div className="space-y-1.5">
              <Label htmlFor="input-group-name" className="text-xs font-semibold">
                Group / Community Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="input-group-name"
                placeholder="e.g. Seller Community Bangladesh"
                value={formGroupName}
                onChange={(e) => setFormGroupName(e.target.value)}
                className="h-9 text-xs"
                required
                data-testid="input-group-name"
              />
            </div>

            {/* Invitation URL */}
            <div className="space-y-1.5">
              <Label htmlFor="input-invitation-url" className="text-xs font-semibold">
                Invitation URL <span className="text-red-500">*</span>
              </Label>
              <Input
                id="input-invitation-url"
                type="url"
                placeholder="https://facebook.com/groups/... or https://t.me/..."
                value={formInvitationUrl}
                onChange={(e) => setFormInvitationUrl(e.target.value)}
                className="h-9 text-xs font-mono"
                required
                data-testid="input-invitation-url"
              />
              <p className="text-[10px] text-muted-foreground">
                অবশ্যই https:// বা http:// সহ পূর্ণ URL লিখুন।
              </p>
            </div>

            {/* Short Description */}
            <div className="space-y-1.5">
              <Label htmlFor="input-group-desc" className="text-xs font-semibold">
                Short Description (Optional)
              </Label>
              <Textarea
                id="input-group-desc"
                placeholder="গ্রুপ সম্পর্কিত সংক্ষিপ্ত বর্ণনা..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={2}
                className="text-xs resize-none"
                data-testid="input-group-desc"
              />
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/30">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold cursor-pointer">
                  Active Status
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  সক্রিয় রাখলে পাবলিক ওয়েবসাইটে প্রদর্শিত হবে
                </p>
              </div>
              <Switch
                checked={formIsActive}
                onCheckedChange={setFormIsActive}
                data-testid="switch-form-active"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-xl text-xs"
                onClick={closeForm}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 rounded-xl text-xs bg-orange-600 hover:bg-orange-700 text-white font-semibold"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-community-group"
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                )}
                <span>{editingLink ? "Update Group" : "Save Group"}</span>
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog
        open={deletingId !== null}
        onOpenChange={(o) => { if (!o) setDeletingId(null); }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>গ্রুপ মুছে ফেলবেন?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              এই গ্রুপটি মুছে ফেললে এটি পাবলিক ওয়েবসাইট থেকে স্থায়ীভাবে অপসারিত হবে। এই কাজটি পূর্বাবস্থায় ফিরিয়ে আনা যাবে না।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl text-xs">
              বাতিল
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl text-xs"
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-group"
            >
              {deleteMutation.isPending ? "মুছছে..." : "মুছে ফেলুন"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default CommunitySettingsDialog;
