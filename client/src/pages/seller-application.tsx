import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { User, Phone, CheckCircle2, Wallet, Hash, Copy, Mail, BookOpen, ShieldCheck, Send, ClipboardList, CreditCard, Link, TriangleAlert, Upload, FileText, X, ImageIcon } from "lucide-react";
import { SiMeta } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const applicationFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone number is required"),
  facebookLink: z.string().url("Must be a valid Facebook profile URL"),
  duration: z.enum(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]),
  sellerType: z.enum(["personal_facebook_id", "facebook_business_page"]),
  paymentMethod: z.enum(["bkash", "nagad"]),
  senderNumber: z.string().min(1, "Sender number is required"),
  email: z.union([
    z.literal(""),
    z.string().regex(
      /^[a-zA-Z0-9._%+\-]+@gmail\.com$/i,
      "আপনি যে ইমেইলটি লিখেছেন তা সঠিক নয়। দয়া করে একটি সঠিক Gmail লিখুন (example@gmail.com)।"
    ),
  ]).optional(),
  nidFileUrl: z.string().optional(),
});

type ApplicationFormValues = z.infer<typeof applicationFormSchema>;

const personalPricing: Record<string, string> = {
  "1": "২০০ টাকা", "2": "৩৮০ টাকা", "3": "৫৫০ টাকা", "4": "৭০০ টাকা",
  "5": "৮৫০ টাকা", "6": "১০০০ টাকা", "7": "১১০০ টাকা", "8": "১২০০ টাকা",
  "9": "১৩০০ টাকা", "10": "১৪০০ টাকা", "11": "১৫০০ টাকা", "12": "১৬০০ টাকা",
};

const businessPricing: Record<string, string> = {
  "1": "৩০০ টাকা", "2": "৫৫০ টাকা", "3": "৮০০ টাকা", "4": "১০০০ টাকা",
  "5": "১২০০ টাকা", "6": "১৪০০ টাকা", "7": "১৬০০ টাকা", "8": "১৮০০ টাকা",
  "9": "২০০০ টাকা", "10": "২২০০ টাকা", "11": "২৪০০ টাকা", "12": "২৬০০ টাকা",
};

const monthLabels: Record<string, string> = {
  "1": "১ মাস", "2": "২ মাস", "3": "৩ মাস", "4": "৪ মাস",
  "5": "৫ মাস", "6": "৬ মাস", "7": "৭ মাস", "8": "৮ মাস",
  "9": "৯ মাস", "10": "১০ মাস", "11": "১১ মাস", "12": "১২ মাস",
};

const dashboardPackages = ["1", "6", "9", "12"];

export default function SellerApplication() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [emailErrorOpen, setEmailErrorOpen] = useState(false);
  const [nidFile, setNidFile] = useState<File | null>(null);
  const [nidUploading, setNidUploading] = useState(false);
  const nidInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ApplicationFormValues>({
    resolver: zodResolver(applicationFormSchema),
    mode: "onSubmit",
    defaultValues: {
      name: "",
      phone: "",
      facebookLink: "",
      duration: "1",
      sellerType: "personal_facebook_id",
      paymentMethod: "bkash",
      senderNumber: "",
      email: "",
      nidFileUrl: "",
    },
  });

  const sellerType = form.watch("sellerType");
  const selectedDuration = form.watch("duration");
  const currentPricing = sellerType === "facebook_business_page" ? businessPricing : personalPricing;

  const [rulesOpen, setRulesOpen] = useState(false);
  const [groupRules, setGroupRules] = useState("");

  useEffect(() => {
    fetch("/api/settings/group-rules")
      .then((res) => res.json())
      .then((data) => setGroupRules(data.rules || ""))
      .catch(() => {});
  }, []);

  const submitMutation = useMutation({
    mutationFn: async (data: ApplicationFormValues) => {
      const res = await apiRequest("POST", "/api/applications", data);
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({ title: "Application submitted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = async (data: ApplicationFormValues) => {
    let nidFileUrl = data.nidFileUrl || "";

    if (nidFile && !nidFileUrl) {
      try {
        setNidUploading(true);
        const formData = new FormData();
        formData.append("nid", nidFile);
        formData.append("phone", data.phone);
        const res = await fetch("/api/applications/upload-nid", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || "NID upload failed");
        }
        const result = await res.json();
        nidFileUrl = result.url;
        form.setValue("nidFileUrl", nidFileUrl);
      } catch (err: any) {
        toast({ title: "NID Upload Failed", description: err.message, variant: "destructive" });
        return;
      } finally {
        setNidUploading(false);
      }
    }

    const payload = { ...data, email: data.email?.trim() || undefined, nidFileUrl: nidFileUrl || undefined };
    submitMutation.mutate(payload);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center p-6">
        <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl shadow-indigo-100/60 dark:shadow-black/40 border border-slate-100 dark:border-gray-800 overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400 via-teal-500 to-green-400" />
            <div className="px-8 pt-8 pb-9 flex flex-col items-center text-center space-y-5">

              <div className="relative">
                <div className="rounded-full bg-emerald-50 dark:bg-emerald-950/60 p-5 ring-8 ring-emerald-50 dark:ring-emerald-950/30">
                  <CheckCircle2 className="h-12 w-12 text-emerald-500 dark:text-emerald-400" strokeWidth={1.75} />
                </div>
              </div>

              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight" data-testid="text-success-title">
                  ধন্যবাদ!
                </h2>
              </div>

              <div className="space-y-3 w-full" data-testid="text-success-message">
                <p className="text-[15px] text-gray-700 dark:text-gray-300 leading-relaxed">
                  আপনার আবেদন সফলভাবে গ্রহণ করা হয়েছে।
                </p>
                <p className="text-[14px] text-gray-500 dark:text-gray-400 leading-relaxed">
                  পেমেন্ট যাচাইয়ের পর আপনার সেলার কোড সক্রিয় করা হবে।
                </p>

                <div className="border-t border-dashed border-slate-200 dark:border-gray-700 pt-3 mt-1 space-y-2">
                  <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">
                    সেলার কোড আপনার দেওয়া ইমেইলে পাঠানো হবে।
                  </p>
                  <p className="inline-flex items-center gap-1.5 text-[13px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-3 py-1.5 rounded-full">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    দয়া করে ইনবক্স অথবা স্প্যাম ফোল্ডার চেক করুন।
                  </p>
                </div>
              </div>

              <button
                onClick={() => window.location.href = "/apply"}
                data-testid="button-back-home"
                className="mt-1 w-full py-2.5 px-6 rounded-xl text-white text-sm font-semibold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 shadow-md shadow-indigo-200/50 dark:shadow-indigo-900/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              >
                Back to Home
              </button>

            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-blue-100 dark:border-gray-800">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-center gap-3">
          <div className="rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 p-2">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-lg font-bold bg-gradient-to-r from-blue-700 to-indigo-700 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
            সেলার কোড ম্যানেজার
          </h1>
        </div>
      </div>

      <div className="flex justify-center p-4 sm:p-6 pb-12">
        <div className="w-full max-w-md space-y-5">

          <Card className="shadow-lg border-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm overflow-hidden" data-testid="card-payment-info">
            <div className="h-1 bg-gradient-to-r from-pink-500 via-rose-500 to-orange-500" />
            <CardHeader className="text-center pb-3">
              <div className="mx-auto rounded-full bg-rose-500/10 p-2.5 w-fit mb-2">
                <Wallet className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              </div>
              <CardTitle className="text-2xl font-bold" data-testid="text-payment-title">পেমেন্ট পদ্ধতি</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-xl border border-pink-200 dark:border-pink-900/40 bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-950/20 dark:to-rose-950/20 p-3.5 transition-all hover:shadow-md">
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-pink-600 px-2.5 py-0.5">
                      <span className="text-xs font-bold text-white">bKash</span>
                    </div>
                    <span className="font-medium">বিকাশ</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-pink-700 dark:text-pink-400" data-testid="text-bkash-number">01827259372</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs border-pink-300 dark:border-pink-800 hover:bg-pink-100 dark:hover:bg-pink-900/30"
                      onClick={() => {
                        navigator.clipboard.writeText("01827259372");
                        toast({ title: "নাম্বার কপি হয়েছে" });
                      }}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-orange-200 dark:border-orange-900/40 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 p-3.5 transition-all hover:shadow-md">
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-orange-600 px-2.5 py-0.5">
                      <span className="text-xs font-bold text-white">Nagad</span>
                    </div>
                    <span className="font-medium">নগদ</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-orange-700 dark:text-orange-400" data-testid="text-nagad-number">01972002118</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs border-orange-300 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/30"
                      onClick={() => {
                        navigator.clipboard.writeText("01972002118");
                        toast({ title: "নাম্বার কপি হয়েছে" });
                      }}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground text-center">শুধুমাত্র সেন্ড মানি করুন</p>
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 p-3.5 text-center">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400" data-testid="text-payment-instruction">
                  অনুগ্রহ করে প্রথমে নিচ থেকে সাবস্ক্রিপশন প্যাকেজ নির্বাচন করুন, তারপর উপরের নাম্বারে Send Money করুন।
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm overflow-hidden" data-testid="card-pricing">
            <div className="h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
            <CardHeader className="text-center pb-3">
              <CardTitle className="text-xl font-bold" data-testid="text-pricing-title">সাবস্ক্রিপশন প্যাকেজ</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {dashboardPackages.map((key) => {
                  const isSelected = selectedDuration === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => form.setValue("duration", key as ApplicationFormValues["duration"], { shouldValidate: true })}
                      className={`rounded-2xl border-2 p-4 text-center transition-all duration-200 cursor-pointer w-full focus:outline-none ${
                        isSelected
                          ? "border-blue-500 dark:border-blue-400 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 shadow-lg ring-2 ring-blue-500/25 dark:ring-blue-400/25 scale-[1.05]"
                          : "border-blue-100 dark:border-blue-900/40 bg-gradient-to-br from-blue-50/60 to-indigo-50/60 dark:from-blue-950/10 dark:to-indigo-950/10 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md hover:scale-[1.02]"
                      }`}
                      data-testid={`pricing-${monthLabels[key]}`}
                    >
                      <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${isSelected ? "text-blue-600 dark:text-blue-300" : "text-muted-foreground"}`}>{monthLabels[key]}</div>
                      <div className={`text-xl font-bold ${isSelected ? "text-blue-700 dark:text-blue-200" : "text-blue-700 dark:text-blue-400"}`}>{currentPricing[key]}</div>
                      {isSelected && (
                        <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-blue-500 px-2 py-0.5">
                          <CheckCircle2 className="h-2.5 w-2.5 text-white" />
                          <span className="text-[10px] font-semibold text-white">নির্বাচিত</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {groupRules && (
            <div className="text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRulesOpen(true)}
                className="rounded-full border-blue-300 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/30"
              >
                <BookOpen className="h-4 w-4 mr-2" />
                গ্রুপ রুলস দেখে নিন
              </Button>
            </div>
          )}

          <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
            <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto" aria-describedby={undefined}>
              <DialogHeader>
                <DialogTitle>গ্রুপ রুলস</DialogTitle>
              </DialogHeader>
              <div className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
                {groupRules}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={emailErrorOpen} onOpenChange={setEmailErrorOpen}>
            <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <TriangleAlert className="h-5 w-5 shrink-0" />
                  ইমেইল সঠিক নয়
                </DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground leading-relaxed">
                আপনি যে ইমেইলটি লিখেছেন তা সঠিক নয়। দয়া করে একটি সঠিক Gmail লিখুন (example@gmail.com)।
              </p>
              <div className="pt-1">
                <Button
                  className="w-full"
                  onClick={() => setEmailErrorOpen(false)}
                  data-testid="button-close-email-error"
                >
                  ঠিক আছে
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Card className="shadow-xl border-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500" />
            <CardHeader className="text-center pb-2 pt-6 px-6">
              <div className="flex justify-center mb-2">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <ClipboardList className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight" data-testid="text-apply-title">সেলার আবেদন</CardTitle>
              <CardDescription className="text-sm mt-1.5 leading-relaxed">
                আমাদের ফেসবুক গ্রুপে সেলার হতে নিচের ফর্মটি পূরণ করুন।
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-8">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit, (errors) => { if (errors.email) setEmailErrorOpen(true); })} className="space-y-5 mt-2">

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-emerald-200 dark:via-emerald-800 to-transparent" />
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest px-1">ব্যক্তিগত তথ্য</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-emerald-200 dark:via-emerald-800 to-transparent" />
                  </div>

                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-foreground/80">নাম</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                            <Input placeholder="আপনার পূর্ণ নাম লিখুন" className="pl-10 h-11 rounded-xl border-border/60 bg-background focus-visible:ring-2 focus-visible:ring-blue-500/25 focus-visible:border-blue-400 transition-all duration-200" {...field} data-testid="input-apply-name" />
                          </div>
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
                        <FormLabel className="text-sm font-semibold text-foreground/80">মোবাইল নাম্বার</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                            <Input placeholder="আপনার মোবাইল নাম্বার লিখুন" className="pl-10 h-11 rounded-xl border-border/60 bg-background focus-visible:ring-2 focus-visible:ring-blue-500/25 focus-visible:border-blue-400 transition-all duration-200" {...field} data-testid="input-apply-phone" />
                          </div>
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
                        <FormLabel className="text-sm font-semibold text-foreground/80">ফেসবুক আইডি / পেজের লিংক</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <SiMeta className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                            <Input placeholder="https://facebook.com/yourprofile" className="pl-10 h-11 rounded-xl border-border/60 bg-background focus-visible:ring-2 focus-visible:ring-blue-500/25 focus-visible:border-blue-400 transition-all duration-200" {...field} data-testid="input-apply-facebook" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex items-center gap-3 pt-1">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-blue-200 dark:via-blue-800 to-transparent" />
                    <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest px-1">সাবস্ক্রিপশন তথ্য</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-blue-200 dark:via-blue-800 to-transparent" />
                  </div>

                  <FormField
                    control={form.control}
                    name="sellerType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-foreground/80">সেলার ধরন নির্বাচন করুন</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-11 rounded-xl border-border/60 focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400 transition-all duration-200" data-testid="select-apply-seller-type">
                              <SelectValue placeholder="সেলার ধরন নির্বাচন করুন" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="personal_facebook_id">পার্সোনাল ফেসবুক আইডি</SelectItem>
                            <SelectItem value="facebook_business_page">ফেসবুক বিজনেস পেজ</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="duration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-foreground/80">মেয়াদ সিলেক্ট করুন</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-11 rounded-xl border-border/60 focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400 transition-all duration-200" data-testid="select-apply-duration">
                              <SelectValue placeholder="আপনার পছন্দের মেয়াদ নির্বাচন করুন" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.keys(monthLabels).map((key) => (
                              <SelectItem key={key} value={key}>{monthLabels[key]} - {currentPricing[key]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex items-center gap-3 pt-1">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-pink-200 dark:via-pink-800 to-transparent" />
                    <span className="text-[11px] font-semibold text-pink-600 dark:text-pink-400 uppercase tracking-widest px-1">পেমেন্ট তথ্য</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-pink-200 dark:via-pink-800 to-transparent" />
                  </div>

                  <FormField
                    control={form.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-foreground/80">পেমেন্টের মাধ্যম নির্বাচন করুন</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-11 rounded-xl border-border/60 focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400 transition-all duration-200" data-testid="select-apply-payment-method">
                              <SelectValue placeholder="পেমেন্ট মাধ্যম নির্বাচন করুন" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="bkash">বিকাশ</SelectItem>
                            <SelectItem value="nagad">নগদ</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="senderNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-foreground/80">যে নাম্বার থেকে টাকা পাঠানো হয়েছে</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                            <Input placeholder="যে নাম্বার থেকে টাকা পাঠিয়েছেন সেই নাম্বার লিখুন" className="pl-10 h-11 rounded-xl border-border/60 bg-background focus-visible:ring-2 focus-visible:ring-blue-500/25 focus-visible:border-blue-400 transition-all duration-200" {...field} data-testid="input-apply-sender-number" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex items-center justify-center gap-1.5 pt-1">
                    <Mail className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                    <p className="text-[13px] font-medium text-indigo-600 dark:text-indigo-400">সেলার কোড এই ইমেইলে পাঠানো হবে</p>
                  </div>

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-foreground/80">ইমেইল / জিমেইল</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                            <Input
                              placeholder="আপনার ইমেইল অথবা জিমেইল লিখুন"
                              className={`pl-10 h-11 rounded-xl bg-background focus-visible:ring-2 transition-all duration-200 ${
                                form.formState.errors.email
                                  ? "border-red-400 focus-visible:ring-red-500/25 focus-visible:border-red-500"
                                  : "border-border/60 focus-visible:ring-blue-500/25 focus-visible:border-blue-400"
                              }`}
                              {...field}
                              data-testid="input-apply-email"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex items-center gap-3 pt-1">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-violet-200 dark:via-violet-800 to-transparent" />
                    <span className="text-[11px] font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-widest px-1">NID / পরিচয়পত্র</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-violet-200 dark:via-violet-800 to-transparent" />
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-foreground/80">NID / জাতীয় পরিচয়পত্র</p>
                    <div
                      className={`relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer ${
                        nidFile
                          ? "border-violet-400 bg-violet-50 dark:bg-violet-950/20"
                          : "border-border/60 hover:border-violet-300 dark:hover:border-violet-700 hover:bg-violet-50/50 dark:hover:bg-violet-950/10"
                      }`}
                      onClick={() => nidInputRef.current?.click()}
                      data-testid="input-nid-upload-area"
                    >
                      <input
                        ref={nidInputRef}
                        type="file"
                        accept="image/png,image/jpeg"
                        className="hidden"
                        data-testid="input-nid-file"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const allowed = ["image/jpeg", "image/png"];
                          if (!allowed.includes(file.type)) {
                            toast({
                              title: "ফাইল গ্রহণযোগ্য নয়",
                              description: "শুধুমাত্র NID এর ছবি আপলোড করা যাবে। PDF গ্রহণযোগ্য নয়।",
                              variant: "destructive",
                            });
                            if (nidInputRef.current) nidInputRef.current.value = "";
                            return;
                          }
                          setNidFile(file);
                          form.setValue("nidFileUrl", "");
                        }}
                      />
                      {nidFile ? (
                        <div className="flex items-center justify-between p-3.5">
                          <div className="flex items-center gap-3">
                            <ImageIcon className="h-8 w-8 text-violet-500 shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-violet-700 dark:text-violet-300 truncate max-w-[180px]">{nidFile.name}</p>
                              <p className="text-xs text-muted-foreground">{(nidFile.size / 1024).toFixed(1)} KB</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="p-1 rounded-full hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setNidFile(null);
                              form.setValue("nidFileUrl", "");
                              if (nidInputRef.current) nidInputRef.current.value = "";
                            }}
                            data-testid="button-remove-nid"
                          >
                            <X className="h-4 w-4 text-violet-500" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2.5 py-2.5 px-4">
                          <Upload className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                          <div className="text-left">
                            <p className="text-xs text-muted-foreground leading-snug">
                              শুধুমাত্র ফোনে তোলা পরিষ্কার NID ছবির আপলোড করুন।
                            </p>
                            <p className="text-[11px] text-muted-foreground/60">PDF ফাইল গ্রহণযোগ্য নয়।</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white font-bold py-6 text-base rounded-xl shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200"
                      disabled={submitMutation.isPending || nidUploading}
                      data-testid="button-submit-application"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {nidUploading ? "NID আপলোড হচ্ছে..." : submitMutation.isPending ? "জমা হচ্ছে..." : "আবেদন জমা দিন"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
