import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, Phone, Hash, CheckCircle2, ShieldCheck, RefreshCw, CalendarCheck, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
};

const DURATION_OPTIONS = [
  { value: "1",  label: "১ মাস - ২০০ টাকা" },
  { value: "2",  label: "২ মাস - ৩৮০ টাকা" },
  { value: "3",  label: "৩ মাস - ৫৫০ টাকা" },
  { value: "4",  label: "৪ মাস - ৭০০ টাকা" },
  { value: "5",  label: "৫ মাস - ৮৫০ টাকা" },
  { value: "6",  label: "৬ মাস - ১০০০ টাকা" },
  { value: "7",  label: "৭ মাস - ১১০০ টাকা" },
  { value: "8",  label: "৮ মাস - ১২০০ টাকা" },
  { value: "9",  label: "৯ মাস - ১৩০০ টাকা" },
  { value: "10", label: "১০ মাস - ১৪০০ টাকা" },
  { value: "11", label: "১১ মাস - ১৫০০ টাকা" },
  { value: "12", label: "১২ মাস - ১৬০০ টাকা" },
];

const PAYMENT_METHODS = [
  { value: "bkash", label: "বিকাশ", number: "01827259372", color: "pink" },
  { value: "nagad", label: "নগদ", number: "01972002118", color: "orange" },
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
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/renewals", {
        phone: seller!.phone,
        duration,
        paymentMethod,
        senderNumber: senderNumber.trim(),
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
      toast({ title: "আবেদন সফলভাবে জমা হয়েছে!" });
    },
    onError: () => {
      toast({ title: "ত্রুটি", description: "আবেদন জমা দেওয়া সম্ভব হয়নি। আবার চেষ্টা করুন।", variant: "destructive" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!senderNumber.trim()) {
      setSenderError("সেন্ডার নাম্বার লিখুন");
      return;
    }
    setSenderError("");
    renewMutation.mutate();
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center p-6">
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
                className="w-full py-2.5 px-6 rounded-xl text-white text-sm font-semibold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 shadow-md shadow-indigo-200/50 dark:shadow-indigo-900/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              >
                আবার আবেদন করুন
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

          {/* Search Card */}
          <Card className="shadow-lg border-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
            <CardHeader className="text-center pb-3 pt-6">
              <div className="mx-auto rounded-full bg-blue-500/10 p-2.5 w-fit mb-2">
                <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400" />
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
                    className="pl-10 h-11 rounded-xl border-border/60 bg-background focus-visible:ring-2 focus-visible:ring-blue-500/25 focus-visible:border-blue-400 transition-all duration-200"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setSearchError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    data-testid="input-renew-search"
                  />
                </div>
                <Button
                  onClick={handleSearch}
                  disabled={searching || !query.trim()}
                  className="h-11 px-5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-indigo-200/40 dark:shadow-indigo-900/30 transition-all duration-200"
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
                  <span className="text-sm font-semibold text-muted-foreground">সেলারের তথ্য</span>
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
                        {DURATION_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} data-testid={`option-duration-${opt.value}`}>
                            {opt.label}
                          </SelectItem>
                        ))}
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

                  <Button
                    type="submit"
                    disabled={renewMutation.isPending}
                    className="w-full h-12 rounded-xl text-white font-semibold text-base bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-600 hover:via-teal-600 hover:to-cyan-600 shadow-lg shadow-teal-200/50 dark:shadow-teal-900/30 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
                    data-testid="button-submit-renew"
                  >
                    {renewMutation.isPending ? "জমা হচ্ছে..." : "রিনিউ আবেদন জমা দিন"}
                  </Button>
                  {renewMutation.isPending && (
                    <p className="text-center text-xs text-muted-foreground mt-1">সার্ভার চালু হচ্ছে, একটু অপেক্ষা করুন...</p>
                  )}
                </form>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}
