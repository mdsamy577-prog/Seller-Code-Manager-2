import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useDiscount, personalPrices, formatPrice, discountedAmount } from "@/lib/pricing";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Search, Phone, Hash, CheckCircle2, ShieldCheck, RefreshCw, CalendarCheck, Copy, Camera, Upload, ImageIcon, X, User, Loader2 } from "lucide-react";
import { compressImage, isCompressibleImage } from "@/lib/image-compressor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Footer } from "@/components/footer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Seller = {
  id: number;
  name: string;
  phone: string;
  sellerCode: string;
  expiryDate: string;
  startDate: string;
  profileImage?: string | null;
};

const MONTH_LABELS: Record<string, string> = {
  "1": "১ মাস", "2": "২ মাস", "3": "৩ মাস", "4": "৪ মাস",
  "5": "৫ মাস", "6": "৬ মাস", "7": "৭ মাস", "8": "৮ মাস",
  "9": "৯ মাস", "10": "১০ মাস", "11": "১১ মাস", "12": "১২ মাস",
};

const PAYMENT_METHODS_BASE = [
  { value: "bkash", label: "বিকাশ", color: "pink" },
  { value: "nagad", label: "নগদ", color: "orange" },
] as const;

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("bn-BD", { day: "2-digit", month: "long", year: "numeric" });
}

function isExpired(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = dateStr.split("-").map(Number);
  const expiry = new Date(y, m - 1, d);
  return expiry < today;
}

export default function RenewalPage() {
  useEffect(() => {
    fetch("/health").catch(() => {});
  }, []);

  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [seller, setSeller] = useState<Seller | null>(null);
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);

  const [duration, setDuration] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState<"bkash" | "nagad">("bkash");
  const [senderNumber, setSenderNumber] = useState("");
  const [senderError, setSenderError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Conditional Profile Photo state when seller has no photo
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoCompressing, setPhotoCompressing] = useState(false);
  const [photoInfo, setPhotoInfo] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);

  const { data: paymentSettings } = useQuery<{ bkashNumber: string; nagadNumber: string }>({
    queryKey: ["/api/settings/payment"],
    staleTime: 60_000,
  });
  const bkashNumber = paymentSettings?.bkashNumber ?? "01827259372";
  const nagadNumber = paymentSettings?.nagadNumber ?? "01972002118";
  const PAYMENT_METHODS = [
    { value: "bkash" as const, label: "বিকাশ", number: bkashNumber, color: "pink" },
    { value: "nagad" as const, label: "নগদ", number: nagadNumber, color: "orange" },
  ];

  const discount = useDiscount();
  const selectedPayment = PAYMENT_METHODS.find((p) => p.value === paymentMethod)!;

  async function fetchWithRetry(url: string, retries = 2): Promise<Response> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** (attempt - 1), 5000)));
      }
      try {
        const res = await fetch(url);
        return res;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr;
  }

  async function handleSearch() {
    const q = query.trim();
    if (!q) return;
    setSearchError("");
    setSeller(null);
    setSubmitted(false);
    setPhotoFile(null);
    if (photoPreview && photoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoPreview(null);
    setPhotoError("");
    setSearching(true);
    try {
      const res = await fetchWithRetry(`/api/sellers/lookup?q=${encodeURIComponent(q)}`);
      if (res.status === 404) {
        setSearchError("কোনো সেলার পাওয়া যায়নি।");
      } else if (!res.ok) {
        setSearchError("অনুসন্ধানে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
      } else {
        const data = await res.json();
        setSeller(data);
      }
    } catch {
      setSearchError("সার্ভার চালু হচ্ছে, একটু অপেক্ষা করুন...");
    } finally {
      setSearching(false);
    }
  }

  const renewMutation = useMutation({
    mutationFn: async (variables?: { profileImage?: string }) => {
      const res = await apiRequest("POST", "/api/renewals", {
        phone: seller!.phone,
        duration,
        paymentMethod,
        senderNumber: senderNumber.trim(),
        profileImage: variables?.profileImage,
      });
      return res.json();
    },
    retry: (failureCount, error) => {
      if (failureCount >= 2) return false;
      const msg = (error as Error).message || "";
      return msg.startsWith("5") || !msg.includes(":");
    },
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    onSuccess: () => {
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ["/api/sellers"] });
      toast({ title: "আবেদন সফলভাবে জমা হয়েছে!" });
    },
    onError: () => {
      toast({ title: "ত্রুটি", description: "আবেদন জমা দেওয়া সম্ভব হয়নি। আবার চেষ্টা করুন।", variant: "destructive" });
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!senderNumber.trim()) {
      setSenderError("সেন্ডার নাম্বার লিখুন");
      return;
    }
    setSenderError("");

    if (photoCompressing) {
      toast({
        title: "ছবি প্রসেস হচ্ছে",
        description: "ছবি কম্প্রেস হওয়া সম্পন্ন হওয়া পর্যন্ত অনুগ্রহ করে এক মুহূর্ত অপেক্ষা করুন।",
      });
      return;
    }

    const hasPhoto = Boolean(seller?.profileImage && seller.profileImage.trim());
    if (!hasPhoto && !photoFile) {
      setPhotoError("নিজের ছবি আপলোড করা বাধ্যতামূলক");
      return;
    }
    setPhotoError("");

    let uploadedPhotoUrl = "";
    if (!hasPhoto && photoFile) {
      try {
        setPhotoUploading(true);
        const formData = new FormData();
        formData.append("photo", photoFile);
        formData.append("phone", seller!.phone);
        const res = await fetch("/api/applications/upload-photo", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || "ছবি আপলোড করতে সমস্যা হয়েছে");
        }
        const data = await res.json();
        uploadedPhotoUrl = data.url;
      } catch (err: any) {
        setPhotoUploading(false);
        toast({ title: "ছবি আপলোড ব্যর্থ", description: err.message, variant: "destructive" });
        return;
      } finally {
        setPhotoUploading(false);
      }
    }

    renewMutation.mutate(uploadedPhotoUrl ? { profileImage: uploadedPhotoUrl } : undefined);
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col justify-between bg-[#F8FAFC] dark:bg-[#070C1B]">
        {/* Navbar */}
        <header className="sticky top-0 z-10 bg-[#0B132B] text-white border-b border-slate-800/80 shadow-xs">
          <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 font-bold text-base tracking-tight text-white hover:opacity-90 transition-opacity">
              <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-500 border border-orange-500/30">
                <ShieldCheck className="h-4 w-4 text-orange-500" />
              </div>
              <span className="font-bold text-sm sm:text-base">
                সেলার কোড <span className="text-orange-500">রেজিস্ট্রি</span>
              </span>
            </Link>
            <Link href="/" className="text-xs text-slate-300 hover:text-orange-400 transition-colors font-medium">
              হোম পেজ
            </Link>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 flex items-center justify-center p-4 sm:p-6 w-full my-auto">
          <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl shadow-indigo-100/60 dark:shadow-black/40 border border-slate-100 dark:border-gray-800 overflow-hidden">
              <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400 via-teal-500 to-green-400" />
              <div className="px-8 pt-8 pb-9 flex flex-col items-center text-center space-y-5">
                <div className="rounded-full bg-emerald-50 dark:bg-emerald-950/60 p-5 ring-8 ring-emerald-50 dark:ring-emerald-950/30">
                  <CheckCircle2 className="h-12 w-12 text-emerald-500 dark:text-emerald-400" strokeWidth={1.75} />
                </div>
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight" data-testid="text-renew-success-title">
                    ধন্যবাদ!
                  </h2>
                </div>
                <div className="space-y-3 w-full" data-testid="text-renew-success-message">
                  <p className="text-[15px] text-gray-700 dark:text-gray-300 leading-relaxed">
                    আপনার রিনিউ আবেদন সফলভাবে গ্রহণ করা হয়েছে।
                  </p>
                  <p className="text-[14px] text-gray-500 dark:text-gray-400 leading-relaxed">
                    পেমেন্ট যাচাইয়ের পর আপনার সাবস্ক্রিপশন নবায়ন করা হবে।
                  </p>
                </div>
                <button
                  onClick={() => { setSeller(null); setSubmitted(false); setQuery(""); setSenderNumber(""); }}
                  data-testid="button-renew-again"
                  className="w-full py-2.5 px-6 rounded-xl text-white text-sm font-semibold bg-orange-600 hover:bg-orange-700 shadow-md shadow-orange-600/20 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  আবার আবেদন করুন
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <Footer showLinks={false} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#F8FAFC] dark:bg-[#070C1B]">
      {/* Navbar */}
      <header className="sticky top-0 z-10 bg-[#0B132B] text-white border-b border-slate-800/80 shadow-xs">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-bold text-base tracking-tight text-white hover:opacity-90 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-500 border border-orange-500/30">
              <ShieldCheck className="h-4 w-4 text-orange-500" />
            </div>
            <span className="font-bold text-sm sm:text-base">
              সেলার কোড <span className="text-orange-500">রেজিস্ট্রি</span>
            </span>
          </Link>
          <Link href="/" className="text-xs text-slate-300 hover:text-orange-400 transition-colors font-medium">
            হোম পেজ
          </Link>
        </div>
      </header>

      {/* Main Renewal Content */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 pb-12 w-full">
        <div className="w-full max-w-md space-y-5 my-auto">

          {/* Search Card */}
          <Card className="shadow-lg border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#0B132B]/90 backdrop-blur-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600" />
            <CardHeader className="text-center pb-3 pt-6">
              <div className="mx-auto rounded-full bg-orange-500/10 p-2.5 w-fit mb-2">
                <RefreshCw className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <CardTitle className="text-2xl font-bold" data-testid="text-renew-title">সাবস্ক্রিপশন রিনিউ</CardTitle>
              <CardDescription className="text-sm mt-1 leading-relaxed">
                ফোন নাম্বার অথবা সেলার কোড দিয়ে অনুসন্ধান করুন।
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6 space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                  <Input
                    placeholder="ফোন নাম্বার বা সেলার কোড"
                    className="pl-10 h-11 rounded-xl border-border/60 bg-background focus-visible:ring-2 focus-visible:ring-orange-500/25 focus-visible:border-orange-400 transition-all duration-200"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setSearchError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    data-testid="input-renew-search"
                  />
                </div>
                <Button
                  onClick={handleSearch}
                  disabled={searching || !query.trim()}
                  className="h-11 px-5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white shadow-md shadow-orange-600/20 transition-all duration-200"
                  data-testid="button-renew-search"
                >
                  {searching ? "..." : "খুঁজুন"}
                </Button>
              </div>
              {searchError && (
                <p className="text-sm text-red-600 dark:text-red-400 text-center" data-testid="text-search-error">{searchError}</p>
              )}
            </CardContent>
          </Card>

          {/* Seller Info */}
          {seller && (
            <Card className="shadow-lg border-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="h-1 bg-gradient-to-r from-teal-400 via-emerald-500 to-green-400" />
              <CardContent className="px-6 py-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {seller.profileImage ? (
                      <img
                        src={seller.profileImage}
                        alt={seller.name}
                        className="w-9 h-9 rounded-full object-cover border border-emerald-400 shrink-0 shadow-xs"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-500 shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                    <span className="text-sm font-semibold text-muted-foreground">সেলারের তথ্য</span>
                  </div>
                  <Badge
                    className={isExpired(seller.expiryDate)
                      ? "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800"
                      : "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                    }
                    data-testid="badge-seller-status"
                  >
                    {isExpired(seller.expiryDate) ? "মেয়াদ শেষ" : "সক্রিয়"}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5"><Hash className="h-3.5 w-3.5" /> নাম</span>
                    <span className="font-semibold" data-testid="text-seller-name">{seller.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5"><Hash className="h-3.5 w-3.5" /> সেলার কোড</span>
                    <span className="font-bold font-mono text-blue-700 dark:text-blue-400" data-testid="text-seller-code">{seller.sellerCode}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> ফোন</span>
                    <span className="font-medium" data-testid="text-seller-phone">{seller.phone}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5"><CalendarCheck className="h-3.5 w-3.5" /> মেয়াদ শেষ</span>
                    <span className={`font-semibold ${isExpired(seller.expiryDate) ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`} data-testid="text-seller-expiry">
                      {formatDate(seller.expiryDate)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment Info */}
          {seller && (
            <Card className="shadow-lg border-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="h-1 bg-gradient-to-r from-pink-500 via-rose-500 to-orange-500" />
              <CardContent className="px-6 py-5 space-y-3">
                <p className="text-sm font-semibold text-muted-foreground text-center">পেমেন্ট নাম্বার</p>
                <div className="space-y-2">
                  {PAYMENT_METHODS.map((pm) => (
                    <div
                      key={pm.value}
                      className={`flex items-center justify-between rounded-xl border p-3.5 ${
                        pm.color === "pink"
                          ? "border-pink-200 dark:border-pink-900/40 bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-950/20 dark:to-rose-950/20"
                          : "border-orange-200 dark:border-orange-900/40 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`rounded-full px-2.5 py-0.5 ${pm.color === "pink" ? "bg-pink-600" : "bg-orange-600"}`}>
                          <span className="text-xs font-bold text-white">{pm.value === "bkash" ? "bKash" : "Nagad"}</span>
                        </div>
                        <span className="font-medium">{pm.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-mono font-bold text-sm ${pm.color === "pink" ? "text-pink-700 dark:text-pink-400" : "text-orange-700 dark:text-orange-400"}`} data-testid={`text-${pm.value}-number`}>
                          {pm.number}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className={`h-7 px-2 text-xs ${pm.color === "pink" ? "border-pink-300 dark:border-pink-800 hover:bg-pink-100 dark:hover:bg-pink-900/30" : "border-orange-300 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/30"}`}
                          onClick={() => { navigator.clipboard.writeText(pm.number); toast({ title: "নাম্বার কপি হয়েছে" }); }}
                        >
                          <Copy className="h-3 w-3 mr-1" />Copy
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground text-center">শুধুমাত্র সেন্ড মানি করুন</p>
              </CardContent>
            </Card>
          )}

          {/* Renewal Form */}
          {seller && (
            <Card className="shadow-xl border-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="h-1.5 bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500" />
              <CardHeader className="text-center pb-2 pt-6 px-6">
                <CardTitle className="text-xl font-bold" data-testid="text-renew-form-title">রিনিউ আবেদন</CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-8">
                <form onSubmit={handleSubmit} className="space-y-5 mt-2">

                  {/* Duration Dropdown */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground/80">মেয়াদ বেছে নিন</label>
                    <Select value={duration} onValueChange={setDuration}>
                      <SelectTrigger className="h-11 rounded-xl border-border/60 focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400" data-testid="select-duration">
                        <SelectValue placeholder="মেয়াদ নির্বাচন করুন" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(MONTH_LABELS).map((key) => {
                          const base = personalPrices[key];
                          const label = discount > 0
                            ? `${MONTH_LABELS[key]} - ${formatPrice(discountedAmount(base, discount))} (${discount}% ছাড়)`
                            : `${MONTH_LABELS[key]} - ${formatPrice(base)}`;
                          return (
                            <SelectItem key={key} value={key} data-testid={`option-duration-${key}`}>
                              {label}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Payment Method */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground/80">পেমেন্ট পদ্ধতি</label>
                    <div className="grid grid-cols-2 gap-2">
                      {PAYMENT_METHODS.map((pm) => (
                        <button
                          key={pm.value}
                          type="button"
                          onClick={() => setPaymentMethod(pm.value)}
                          className={`rounded-xl border-2 py-3 text-center font-semibold text-sm transition-all duration-200 focus:outline-none ${
                            paymentMethod === pm.value
                              ? pm.color === "pink"
                                ? "border-pink-500 bg-pink-50 dark:bg-pink-950/30 text-pink-700 dark:text-pink-300 shadow-md scale-[1.03]"
                                : "border-orange-500 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 shadow-md scale-[1.03]"
                              : "border-border/50 bg-background hover:border-border hover:shadow-sm hover:scale-[1.01]"
                          }`}
                          data-testid={`button-payment-${pm.value}`}
                        >
                          {pm.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sender Number */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground/80">
                      সেন্ডার নাম্বার ({selectedPayment.label})
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                      <Input
                        placeholder={`যে নাম্বার থেকে ${selectedPayment.label} করেছেন`}
                        className="pl-10 h-11 rounded-xl border-border/60 bg-background focus-visible:ring-2 focus-visible:ring-blue-500/25 focus-visible:border-blue-400 transition-all duration-200"
                        value={senderNumber}
                        onChange={(e) => { setSenderNumber(e.target.value); setSenderError(""); }}
                        data-testid="input-sender-number"
                      />
                    </div>
                    {senderError && <p className="text-sm text-red-600 dark:text-red-400">{senderError}</p>}
                  </div>

                  {/* Conditional Profile Photo Upload Field */}
                  {!seller.profileImage ? (
                    <div className="space-y-2 pt-1 border-t border-dashed border-border/80">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                          <Camera className="h-4 w-4 text-red-500" />
                          নিজের ছবি আপলোড করুন
                        </label>
                        <span className="text-xs font-bold text-red-500 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-800">
                          বাধ্যতামূলক
                        </span>
                      </div>

                      <div
                        className={`relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer ${
                          photoFile || photoPreview
                            ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20"
                            : "border-border/60 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/10"
                        }`}
                        onClick={() => photoInputRef.current?.click()}
                        data-testid="input-renew-photo-upload-area"
                      >
                        <input
                          ref={photoInputRef}
                          type="file"
                          accept="image/*,.jpg,.jpeg,.png,.webp"
                          className="hidden"
                          data-testid="input-renew-profile-photo-file"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (!isCompressibleImage(file)) {
                              toast({
                                title: "ফাইল গ্রহণযোগ্য নয়",
                                description: "শুধুমাত্র ছবি (JPG, JPEG, PNG, WEBP) আপলোড করা যাবে।",
                                variant: "destructive",
                              });
                              if (photoInputRef.current) photoInputRef.current.value = "";
                              return;
                            }
                            const tempUrl = URL.createObjectURL(file);
                            setPhotoPreview(tempUrl);
                            setPhotoError("");
                            setPhotoCompressing(true);
                            setPhotoInfo("প্রস্তুত হচ্ছে...");
                            try {
                              const result = await compressImage(file, {
                                minSizeKB: 50,
                                maxSizeKB: 100,
                                maxWidth: 1200,
                                maxHeight: 1200,
                              });
                              setPhotoFile(result.file);
                              setPhotoPreview(result.previewUrl);
                              setPhotoInfo("ছবি প্রস্তুত হয়েছে");
                            } catch (err: any) {
                              toast({
                                title: "ছবি প্রসেস ব্যর্থ",
                                description: err.message || "ছবিটি কম্প্রেস করা সম্ভব হয়নি।",
                                variant: "destructive",
                              });
                              setPhotoFile(null);
                              setPhotoPreview(null);
                              setPhotoInfo(null);
                            } finally {
                              setPhotoCompressing(false);
                            }
                          }}
                        />
                        {photoFile || photoPreview ? (
                          <div className="flex items-center justify-between p-3.5">
                            <div className="flex items-center gap-3">
                              {photoPreview ? (
                                <img
                                  src={photoPreview}
                                  alt="Profile Preview"
                                  className="w-12 h-12 rounded-xl object-cover border border-emerald-500/50 shrink-0"
                                />
                              ) : (
                                <ImageIcon className="h-8 w-8 text-emerald-500 shrink-0" />
                              )}
                              <div>
                                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300 truncate max-w-[180px]">
                                  {photoFile ? photoFile.name : "নিজের ছবি"}
                                </p>
                                {photoCompressing ? (
                                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    প্রস্তুত হচ্ছে...
                                  </p>
                                ) : photoInfo ? (
                                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                    {photoInfo}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                            <button
                              type="button"
                              className="p-1 rounded-full hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (photoPreview && photoPreview.startsWith("blob:")) {
                                  URL.revokeObjectURL(photoPreview);
                                }
                                setPhotoFile(null);
                                setPhotoPreview(null);
                                setPhotoInfo(null);
                                if (photoInputRef.current) photoInputRef.current.value = "";
                              }}
                              data-testid="button-remove-renew-photo"
                            >
                              <X className="h-4 w-4 text-emerald-600" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2.5 py-3.5 px-4">
                            <Upload className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                            <div className="text-left">
                              <p className="text-xs text-muted-foreground leading-snug">
                                আপনার পরিষ্কার সাম্প্রতিক ছবি আপলোড করুন (শুধুমাত্র JPG ফরম্যাট গ্রহণযোগ্য)।
                              </p>
                              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                                এনআইডির (NID) সাথে ছবির মিল থাকা আবশ্যক।
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                      {photoError && <p className="text-xs text-red-600 dark:text-red-400 font-medium">{photoError}</p>}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-emerald-200/70 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20">
                      <img
                        src={seller.profileImage}
                        alt={seller.name}
                        className="w-10 h-10 rounded-full object-cover border border-emerald-400 shrink-0 shadow-xs"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">প্রোফাইল ছবি সংরক্ষিত আছে</p>
                        <p className="text-[11px] text-muted-foreground">আপনার প্রোফাইল ছবি ইতোমধ্যে সিস্টেমে সংযুক্ত রয়েছে।</p>
                      </div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={renewMutation.isPending || photoUploading || photoCompressing}
                    className="w-full h-12 rounded-xl text-white font-semibold text-base bg-orange-600 hover:bg-orange-700 active:bg-orange-800 shadow-lg shadow-orange-600/25 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
                    data-testid="button-submit-renew"
                  >
                    {photoCompressing
                      ? "ছবি প্রস্তুত হচ্ছে..."
                      : photoUploading
                      ? "ছবি আপলোড হচ্ছে..."
                      : renewMutation.isPending
                      ? "জমা হচ্ছে..."
                      : "রিনিউ আবেদন জমা দিন"}
                  </Button>
                  {renewMutation.isPending && (
                    <p className="text-center text-xs text-muted-foreground mt-1">সার্ভার চালু হচ্ছে, একটু অপেক্ষা করুন...</p>
                  )}
                </form>
              </CardContent>
            </Card>
          )}

        </div>
      </main>
      <Footer showLinks={false} />
    </div>
  );
}
