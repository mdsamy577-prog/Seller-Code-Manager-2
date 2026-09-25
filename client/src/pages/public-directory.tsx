import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Copy,
  Check,
  Users,
  Shield,
  Lock,
  ArrowRight,
  FileCheck,
  AlertTriangle,
  Sparkles,
  Calendar,
  X,
  Menu,
  RotateCw,
  Phone,
  ShieldAlert,
  ChevronDown,
  User,
} from "lucide-react";
import { SiMeta } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface PublicSeller {
  id: number;
  name: string;
  sellerCode: string;
  facebookLink: string;
  status: string;
  duration?: string;
  startDate?: string;
  expiryDate?: string;
  maskedPhone?: string;
  isValid?: boolean;
  isVerified?: boolean;
  isExpired?: boolean;
  profileImage?: string | null;
  hideProfilePhoto?: boolean;
}

interface VerificationResult {
  found: boolean;
  isValid?: boolean;
  isVerified?: boolean;
  isExpired?: boolean;
  status?: string;
  message?: string;
  seller?: PublicSeller;
}

export default function PublicDirectory() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [verifyInput, setVerifyInput] = useState("");
  const [activeVerification, setActiveVerification] = useState<VerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);

  // Explicit, immediate public API fetch with no-cache and immediate execution
  const {
    data: verifiedSellers = [],
    isLoading: isLoadingSellers,
    isError,
    refetch,
  } = useQuery<PublicSeller[]>({
    queryKey: ["/api/public/verified-sellers"],
    queryFn: async () => {
      const res = await fetch("/api/public/verified-sellers", {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error("Failed to load verified sellers");
      }
      return res.json();
    },
    staleTime: 1000 * 30,
    refetchOnMount: true,
  });

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast({
      title: "সেলার কোড কপি করা হয়েছে",
      description: code,
    });
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleVerify = async (e?: React.FormEvent, overrideQuery?: string) => {
    if (e) e.preventDefault();
    const query = (overrideQuery ?? verifyInput).trim();
    if (!query) {
      toast({
        title: "অনুগ্রহ করে তথ্য লিখুন",
        description: "সেলার কোড, মোবাইল নম্বর বা সেলারের নাম লিখুন।",
        variant: "destructive",
      });
      return;
    }

    setIsVerifying(true);
    try {
      // 1. Direct code verification endpoint
      const res = await fetch(`/api/public/verify/${encodeURIComponent(query)}`, {
        cache: "no-store",
      });
      const data: VerificationResult = await res.json();

      if (data.found && data.seller) {
        setActiveVerification(data);
      } else {
        // 2. Query search by phone or name
        const searchRes = await fetch(`/api/public/search?q=${encodeURIComponent(query)}`, {
          cache: "no-store",
        });
        const searchData = await searchRes.json();
        if (searchData.results && searchData.results.length > 0) {
          const first = searchData.results[0];
          setActiveVerification({
            found: true,
            isValid: first.isValid,
            isVerified: first.isVerified,
            isExpired: first.isExpired,
            status: first.status,
            seller: first,
          });
        } else {
          setActiveVerification({
            found: false,
            isValid: false,
            isVerified: false,
            isExpired: false,
            message: `"${query}" এর সাথে মিল রয়েছে এমন কোনো অনুমোদিত সেলার পাওয়া যায়নি। অনুগ্রহ করে কোডটি ঠিক আছে কি না তা যাচাই করুন।`,
          });
        }
      }
    } catch {
      setActiveVerification({
        found: false,
        isValid: false,
        isVerified: false,
        isExpired: false,
        message: "ভেরিফিকেশন সার্ভিসে সংযোগ করা যাচ্ছে না। অনুগ্রহ করে একটু পর আবার চেষ্টা করুন।",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Filtered sellers for directory showcase - completely viewport-independent
  const filteredSellers = useMemo(() => {
    if (!Array.isArray(verifiedSellers)) return [];
    if (!searchQuery.trim()) return verifiedSellers;
    const q = searchQuery.toLowerCase().trim();
    return verifiedSellers.filter(
      (s) =>
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.sellerCode && s.sellerCode.toLowerCase().includes(q))
    );
  }, [verifiedSellers, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top Notice Bar */}
      <div className="bg-primary text-primary-foreground py-2 px-3 sm:px-4 text-center text-xs sm:text-sm font-medium flex items-center justify-center gap-2 shadow-sm">
        <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-300" />
        <span className="leading-tight">
          অফিশিয়াল কমিউনিটি রেজিস্ট্রি: যেকোনো লেনদেনের পূর্বে অবশ্যই সেলারের কোড যাচাই করুন।
        </span>
      </div>

      {/* Main Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 font-bold text-lg sm:text-xl tracking-tight text-primary shrink-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary border border-primary/20">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <span className="bg-gradient-to-r from-primary to-emerald-600 bg-clip-text text-transparent font-extrabold">
              সেলার রেজিস্ট্রি
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a href="#verify" className="hover:text-primary transition-colors">
              যাচাই করুন
            </a>
            <a href="#directory" className="hover:text-primary transition-colors flex items-center gap-1.5">
              <span>সেলার তালিকা</span>
              <span className="px-1.5 py-0.2 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                {verifiedSellers.length}
              </span>
            </a>
            <a href="#how-it-works" className="hover:text-primary transition-colors">
              কীভাবে কাজ করে
            </a>
            <Link href="/apply" className="hover:text-primary transition-colors">
              আবেদন করুন
            </Link>
            <Link href="/renew" className="hover:text-primary transition-colors">
              কোড নবায়ন
            </Link>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Link href="/apply">
              <Button size="sm" className="text-xs h-9 font-semibold rounded-lg shadow-xs">
                আবেদন করুন
              </Button>
            </Link>

            {/* Mobile Hamburger Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 h-9 w-9 text-slate-700 dark:text-slate-200"
              aria-label="মেনু খুলুন"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 space-y-2 animate-in slide-in-from-top-2 duration-200 shadow-lg">
            <a
              href="#verify"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 px-3 rounded-lg text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              🔍 সেলার যাচাই করুন
            </a>
            <a
              href="#directory"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 px-3 rounded-lg text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between"
            >
              <span>📋 ভেরিফাইড সেলার তালিকা</span>
              <Badge variant="secondary" className="text-xs">
                {verifiedSellers.length} জন
              </Badge>
            </a>
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 px-3 rounded-lg text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              💡 কীভাবে কাজ করে
            </a>
            <Link
              href="/apply"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 px-3 rounded-lg text-sm font-medium text-primary hover:bg-primary/10"
            >
              ✍️ নতুন সেলার আবেদন
            </Link>
            <Link
              href="/renew"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 px-3 rounded-lg text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              🔄 কোড নবায়ন করুন
            </Link>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-8 pb-12 sm:pt-16 sm:pb-20 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-b from-white via-slate-50 to-slate-100/70 dark:from-slate-900 dark:via-slate-900/60 dark:to-slate-950">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          {/* Trust Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm font-medium mb-4 sm:mb-6 border border-emerald-500/20 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>কমিউনিটি ট্রাস্ট ও গ্রাহক সুরক্ষা প্ল্যাটফর্ম</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-2xl xs:text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.25]">
            আমাদের গ্রুপের ভেরিফাইড সেলারদের থেকে <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 bg-clip-text text-transparent">
              নিরাপদে কেনাকাটা করুন
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-3 sm:mt-4 text-sm sm:text-base md:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed px-2">
            পেমেন্ট পাঠানোর আগে অবশ্যই সেলারের কোড যাচাই করে নিন। প্রতিটি অনুমোদিত সেলারের জাতীয় পরিচয়পত্র ও প্রোফাইল আমাদের টিম কর্তৃক সত্যায়িত।
          </p>

          {/* Trust Metrics */}
          <div className="mt-6 sm:mt-8 flex flex-wrap justify-center items-center gap-3 sm:gap-8 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-2 bg-white/80 dark:bg-slate-900/80 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold text-slate-900 dark:text-white">
                {verifiedSellers.length}+
              </span>{" "}
              <span>সক্রিয় ভেরিফাইড সেলার</span>
            </div>
            <div className="flex items-center gap-2 bg-white/80 dark:bg-slate-900/80 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 shadow-xs">
              <Shield className="w-4 h-4 text-primary" />
              <span>এনআইডি ও প্রোফাইল ভেরিফাইড</span>
            </div>
            <div className="flex items-center gap-2 bg-white/80 dark:bg-slate-900/80 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 shadow-xs">
              <Lock className="w-4 h-4 text-emerald-600" />
              <span>১০০% নিরাপদ লেনদেন</span>
            </div>
          </div>

          {/* Instant Verification Search Box */}
          <div id="verify" className="mt-8 sm:mt-10 max-w-2xl mx-auto scroll-mt-24 px-1">
            <form
              onSubmit={(e) => handleVerify(e)}
              className="relative flex flex-col sm:flex-row gap-2 p-1.5 sm:p-2 bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/60 dark:shadow-black/50 border border-slate-200 dark:border-slate-800"
            >
              <div className="relative flex-1 flex items-center min-h-[48px]">
                <Search className="absolute left-3.5 w-5 h-5 text-slate-400 shrink-0" />
                <Input
                  value={verifyInput}
                  onChange={(e) => setVerifyInput(e.target.value)}
                  placeholder="সেলার কোড, মোবাইল নম্বর বা নাম লিখুন..."
                  className="pl-11 pr-8 h-12 text-sm sm:text-base border-none shadow-none focus-visible:ring-0 bg-transparent placeholder:text-slate-400"
                  data-testid="input-verify-search"
                />
                {verifyInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setVerifyInput("");
                      setActiveVerification(null);
                    }}
                    className="p-1 mr-2 text-slate-400 hover:text-slate-600"
                    aria-label="মুছুন"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <Button
                type="submit"
                disabled={isVerifying}
                className="h-12 px-6 sm:px-8 text-sm sm:text-base font-semibold rounded-xl bg-primary hover:bg-primary/90 text-white shrink-0 shadow-md flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                data-testid="button-verify-submit"
              >
                {isVerifying ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>যাচাই করা হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>যাচাই করুন</span>
                  </>
                )}
              </Button>
            </form>

            <p className="mt-2.5 text-xs text-slate-500 dark:text-slate-400">
              পরামর্শ: যেমন সেলার কোড{" "}
              <button
                type="button"
                className="font-mono text-primary font-bold underline cursor-pointer"
                onClick={() => {
                  setVerifyInput("1103-03812");
                  handleVerify(undefined, "1103-03812");
                }}
              >
                1103-03812
              </button>{" "}
              বা{" "}
              <button
                type="button"
                className="font-mono text-primary font-bold underline cursor-pointer"
                onClick={() => {
                  setVerifyInput("2505-11401");
                  handleVerify(undefined, "2505-11401");
                }}
              >
                2505-11401
              </button>{" "}
              লিখে পরীক্ষা করুন
            </p>
          </div>

          {/* Verification Result Card */}
          {activeVerification && (
            <div className="mt-6 sm:mt-8 max-w-2xl mx-auto text-left animate-in fade-in slide-in-from-top-4 duration-300">
              {activeVerification.found && activeVerification.seller ? (
                activeVerification.isExpired || activeVerification.isValid === false || activeVerification.isVerified === false || activeVerification.seller.status !== "active" ? (
                  /* EXPIRED SELLER - CLEAN MINIMALIST CARD */
                  <div
                    className="p-5 sm:p-6 rounded-2xl border-2 border-red-500/30 bg-red-50/40 dark:bg-red-950/30 dark:border-red-900/50 shadow-md text-slate-900 dark:text-slate-100"
                    data-testid="verification-result-box-expired"
                  >
                    {/* Top Header / Identity & Seller Code */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-4 border-red-200/70 dark:border-red-900/40">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                          <XCircle className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                              {activeVerification.seller.name}
                            </h3>
                            <Badge className="bg-red-600 hover:bg-red-600 text-white font-bold text-xs px-2.5 py-0.5 shadow-xs">
                              ❌ মেয়াদ উত্তীর্ণ সেলার (Expired Seller)
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-medium">
                            এই সেলার কোডটি বর্তমানে সম্পূর্ণ নিষ্ক্রিয় ও অননুমোদিত।
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-center mt-1 sm:mt-0">
                        <div className="font-mono font-bold text-sm bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/50 shadow-xs flex items-center gap-2 text-slate-900 dark:text-slate-100">
                          <span>{activeVerification.seller.sellerCode}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyCode(activeVerification.seller!.sellerCode)}
                            className="text-slate-400 hover:text-red-600 transition-colors p-1"
                            title="কোড কপি করুন"
                          >
                            {copiedCode === activeVerification.seller.sellerCode ? (
                              <Check className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Details Box with Seller Photo */}
                    <div className="my-4 bg-white/80 dark:bg-slate-900/60 p-3.5 sm:p-4 rounded-xl border border-red-200/70 dark:border-red-900/30 flex flex-col-reverse sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 w-full text-sm">
                        {activeVerification.seller.maskedPhone && (
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/60 flex items-center justify-center text-red-500 shrink-0">
                              <Phone className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-xs text-slate-500 dark:text-slate-400 block">নিবন্ধিত মোবাইল:</span>
                              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                                {activeVerification.seller.maskedPhone}
                              </span>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/60 flex items-center justify-center text-red-500 shrink-0">
                            <Calendar className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs text-slate-500 dark:text-slate-400 block">মেয়াদ অবস্থা:</span>
                            <span className="text-red-600 dark:text-red-400 font-bold">
                              মেয়াদ শেষ হয়েছে: {activeVerification.seller.expiryDate}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Seller Profile Photo Box */}
                      <div className="flex flex-col items-center shrink-0 self-center sm:self-auto sm:pl-3 sm:border-l border-red-200/60 dark:border-red-900/40">
                        {!activeVerification.seller.hideProfilePhoto && activeVerification.seller.profileImage ? (
                          <img
                            src={activeVerification.seller.profileImage}
                            alt={activeVerification.seller.name}
                            className="w-[72px] h-[72px] sm:w-[80px] sm:h-[80px] rounded-2xl object-cover border-2 border-red-300 dark:border-red-800 opacity-75 grayscale contrast-125 shadow-sm"
                            data-testid="img-expired-seller-profile-photo"
                          />
                        ) : (
                          <div
                            className="w-[72px] h-[72px] sm:w-[80px] sm:h-[80px] rounded-2xl bg-red-100/60 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex flex-col items-center justify-center text-red-400 shadow-xs"
                            data-testid="avatar-expired-seller-placeholder"
                          >
                            <User className="w-8 h-8 opacity-70" />
                            <span className="text-[10px] font-medium tracking-tight mt-0.5">ছবি নেই</span>
                          </div>
                        )}
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">
                          সেলার ছবি
                        </span>
                      </div>
                    </div>

                    {/* Action Button - Single Renewal Link */}
                    <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-end">
                      <Link
                        href="/renew"
                        className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 active:bg-primary/95 text-white font-semibold text-sm transition-colors shadow-sm min-h-[44px]"
                        data-testid="link-renew-expired-code"
                      >
                        <RotateCw className="w-4 h-4" />
                        <span>কোডটি নবায়ন করতে আবেদন করুন</span>
                      </Link>
                    </div>
                  </div>
                ) : (
                  /* STRICTLY VALID & ACTIVE SELLER - GREEN CARD */
                  <div
                    className="p-4 sm:p-6 rounded-2xl border-2 shadow-lg bg-emerald-50/95 dark:bg-emerald-950/30 border-emerald-500/50"
                    data-testid="verification-result-box"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-4 border-emerald-200 dark:border-emerald-900/50">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                          <CheckCircle2 className="w-7 h-7" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                              {activeVerification.seller.name}
                            </h3>
                            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-semibold text-xs px-2.5 py-0.5">
                              ভেরিফাইড অ্যাক্টিভ
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                            গ্রুপের অনুমোদিত ও সক্রিয় সেলার
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-center mt-1 sm:mt-0">
                        <div className="font-mono font-bold text-sm bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-2">
                          <span>{activeVerification.seller.sellerCode}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyCode(activeVerification.seller!.sellerCode)}
                            className="text-slate-400 hover:text-primary transition-colors p-1"
                            title="কোড কপি করুন"
                          >
                            {copiedCode === activeVerification.seller.sellerCode ? (
                              <Check className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Details Box with Seller Photo */}
                    <div className="my-4 bg-white/80 dark:bg-slate-900/60 p-3.5 sm:p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30 flex flex-col-reverse sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 w-full text-sm">
                        {activeVerification.seller.maskedPhone && (
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 shrink-0">
                              <Phone className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-xs text-slate-500 block">নিবন্ধিত মোবাইল:</span>
                              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                                {activeVerification.seller.maskedPhone}
                              </span>
                            </div>
                          </div>
                        )}
                        {activeVerification.seller.expiryDate && (
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 shrink-0">
                              <Calendar className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-xs text-slate-500 block">বৈধতার মেয়াদ:</span>
                              <span className="text-slate-800 dark:text-slate-200 font-semibold">
                                {activeVerification.seller.expiryDate} পর্যন্ত
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Seller Profile Photo Box */}
                      <div className="flex flex-col items-center shrink-0 self-center sm:self-auto sm:pl-3 sm:border-l border-emerald-200/60 dark:border-emerald-900/40">
                        {!activeVerification.seller.hideProfilePhoto && activeVerification.seller.profileImage ? (
                          <img
                            src={activeVerification.seller.profileImage}
                            alt={activeVerification.seller.name}
                            className="w-[72px] h-[72px] sm:w-[80px] sm:h-[80px] rounded-2xl object-cover border-2 border-emerald-500/40 shadow-sm"
                            data-testid="img-seller-profile-photo"
                          />
                        ) : (
                          <div
                            className="w-[72px] h-[72px] sm:w-[80px] sm:h-[80px] rounded-2xl bg-emerald-100/70 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800/60 flex flex-col items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-xs"
                            data-testid="avatar-seller-placeholder"
                          >
                            <User className="w-8 h-8 opacity-80" />
                            <span className="text-[10px] font-medium tracking-tight mt-0.5">ছবি নেই</span>
                          </div>
                        )}
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">
                          সেলার ছবি
                        </span>
                      </div>
                    </div>

                    {/* Facebook Button & Advice */}
                    <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                      {activeVerification.seller.facebookLink && (
                        <a
                          href={activeVerification.seller.facebookLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm transition-colors shadow-sm min-h-[44px]"
                          data-testid="link-verified-facebook-profile"
                        >
                          <SiMeta className="w-4 h-4" />
                          <span>ফেসবুক প্রোফাইল / পেজ দেখুন</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <span className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5 italic">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        মেসেজ দেওয়া ফেসবুক আইডির সাথে এই লিংকটি মিলিয়ে নিন!
                      </span>
                    </div>
                  </div>
                )
              ) : (
                <div
                  className="p-5 sm:p-6 rounded-2xl border-2 border-rose-500/40 bg-rose-50/95 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 shadow-lg"
                  data-testid="verification-not-found-box"
                >
                  <div className="flex items-start gap-3">
                    <XCircle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-base text-rose-900 dark:text-rose-100">
                        সতর্কতা: সেলার ভেরিফাইড নয়
                      </h4>
                      <p className="mt-1 text-xs sm:text-sm text-rose-700 dark:text-rose-300">
                        {activeVerification.message || "আপনার দেওয়া তথ্যের সাথে কোনো অনুমোদিত সেলার পাওয়া যায়নি।"}
                      </p>
                      <div className="mt-3 p-3 bg-white/80 dark:bg-slate-900/80 rounded-xl text-xs space-y-1.5 text-slate-700 dark:text-slate-300 border border-rose-200 dark:border-rose-900/40">
                        <p className="font-bold text-rose-600 dark:text-rose-400">
                          টাকা পাঠানোর আগে করণীয়:
                        </p>
                        <p>১. সঠিক ও বৈধ সেলার কোড না পাওয়া পর্যন্ত কোনো অগ্রিম টাকা পাঠাবেন না।</p>
                        <p>২. সেলারকে অফিশিয়াল পোর্টাল থেকে আবেদন বা নবায়ন করতে বলুন।</p>
                        <p>৩. সন্দেহজনক লেনদেন বা ব্যক্তির ক্ষেত্রে ফেসবুক গ্রুপ মডারেটরদের জানান।</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Verified Seller Directory Grid */}
      <section id="directory" className="py-12 sm:py-16 max-w-7xl mx-auto px-4 sm:px-6 w-full scroll-mt-16 flex-1">
        {/* Directory Header & Search Filter */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <div className="flex items-center gap-2 text-primary text-xs sm:text-sm font-bold uppercase tracking-wider">
              <Users className="w-4 h-4 text-primary" />
              <span>পাবলিক ডিরেক্টরি</span>
            </div>
            <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-1 flex items-center gap-2.5 flex-wrap">
              <span>অনুমোদিত ভেরিফাইড সেলার তালিকা</span>
              <span className="text-sm sm:text-base font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                {verifiedSellers.length} জন
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
              গ্রুপের বর্তমান অ্যাক্টিভ ও অনুমোদিত সেলারদের বিস্তারিত তালিকা
            </p>
          </div>

          {/* Directory Filter Input */}
          <div className="w-full md:w-80 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="নাম বা কোড দিয়ে খুঁজুন..."
              className="pl-9 pr-8 h-11 text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs"
              data-testid="input-directory-filter"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                aria-label="সার্চ ক্লিয়ার করুন"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Error State */}
        {isError && (
          <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
            <p className="text-sm font-semibold text-rose-800 dark:text-rose-200">
              সেলার তালিকা লোড করা সম্ভব হয়নি।
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
              <RotateCw className="w-4 h-4" />
              <span>পুনরায় চেষ্টা করুন</span>
            </Button>
          </div>
        )}

        {/* Loading State */}
        {isLoadingSellers ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-44 rounded-2xl bg-slate-200/80 dark:bg-slate-800/80 animate-pulse border border-slate-200 dark:border-slate-800"
              />
            ))}
          </div>
        ) : filteredSellers.length === 0 ? (
          <div className="py-14 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900 px-4">
            <Users className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              কোনো সেলার পাওয়া যায়নি
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {searchQuery
                ? `"${searchQuery}" এর সাথে কোনো সেলার মেলেনি।`
                : "বর্তমানে কোনো অ্যাক্টিভ সেলার তালিকাভুক্ত নেই।"}
            </p>
            {searchQuery && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchQuery("")}
                className="mt-4 text-xs rounded-xl"
              >
                সার্চ মুছুন
              </Button>
            )}
          </div>
        ) : (
          /* Responsive Cards: 1 column on mobile (< 768px), 2 on tablet, 3 on desktop */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {filteredSellers.map((seller) => (
              <Card
                key={seller.id}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:shadow-md transition-all duration-200 hover:border-emerald-500/40 flex flex-col justify-between"
                data-testid={`card-seller-${seller.id}`}
              >
                <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full space-y-4">
                  <div>
                    {/* Top Row: Seller Avatar, Name & Code Badge */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {!seller.hideProfilePhoto && seller.profileImage ? (
                          <img
                            src={seller.profileImage}
                            alt={seller.name}
                            className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0 shadow-xs"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                            <User className="w-5 h-5 opacity-80" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-base text-slate-900 dark:text-white truncate">
                            {seller.name}
                          </h3>
                          <div className="mt-1 flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>ভেরিফাইড সেলার</span>
                            </span>
                            <span className="text-[11px] text-slate-500 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span>মেয়াদ: {seller.expiryDate || "সক্রিয়"}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Code Badge with 1-tap Copy */}
                      <button
                        type="button"
                        onClick={() => handleCopyCode(seller.sellerCode)}
                        className="font-mono text-xs font-bold px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300 transition-colors flex items-center gap-1.5 shrink-0 border border-slate-200 dark:border-slate-700 active:scale-95 min-h-[36px]"
                        title="কোড কপি করতে ট্যাপ করুন"
                        data-testid={`button-copy-code-${seller.id}`}
                      >
                        <span>{seller.sellerCode}</span>
                        {copiedCode === seller.sellerCode ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Actions Row: Touch-Friendly Buttons */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <a
                      href={seller.facebookLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 inline-flex items-center gap-1.5 py-1.5 px-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors min-h-[40px]"
                    >
                      <SiMeta className="w-3.5 h-3.5 shrink-0" />
                      <span>ফেসবুক প্রোফাইল দেখুন</span>
                      <ExternalLink className="w-3 h-3 opacity-70" />
                    </a>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setVerifyInput(seller.sellerCode);
                        window.scrollTo({ top: 220, behavior: "smooth" });
                        handleVerify(undefined, seller.sellerCode);
                      }}
                      className="h-9 text-xs text-slate-700 dark:text-slate-300 hover:text-primary px-3 rounded-lg font-medium"
                    >
                      <span>যাচাই করুন</span>
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-14 sm:py-20 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 scroll-mt-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-xl mx-auto mb-10 sm:mb-12">
            <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              ভেরিফিকেশন সিস্টেম কীভাবে কাজ করে?
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2">
              ফেসবুক গ্রুপে নিরাপদ লেনদেন নিশ্চিত করতে ৩টি সহজ ধাপ অনুসরণ করুন।
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <div className="p-5 sm:p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 relative">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary font-extrabold flex items-center justify-center text-lg mb-3">
                ১
              </div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white mb-2">
                সেলার কোড চেয়ে নিন
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                গ্রুপের যেকোনো সেলারের সাথে লেনদেনের শুরুতে তার অফিশিয়াল সেলার কোডটি চেয়ে নিন।
              </p>
            </div>

            <div className="p-5 sm:p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 relative">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary font-extrabold flex items-center justify-center text-lg mb-3">
                ২
              </div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white mb-2">
                রেজিস্ট্রিতে সার্চ করুন
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                এই পোর্টালে কোডটি লিখে সার্চ দিয়ে নিশ্চিত হন তিনি বর্তমানে সক্রিয় ও অনুমোদিত সেলার কিনা।
              </p>
            </div>

            <div className="p-5 sm:p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 relative">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary font-extrabold flex items-center justify-center text-lg mb-3">
                ৩
              </div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white mb-2">
                ফেসবুক লিংক মিলিয়ে নিন
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                সেলার কার্ডের ফেসবুক প্রোফাইল বাটনে ক্লিক করে মেসেজ পাঠানো অ্যাকাউন্টের সাথে মিলিয়ে নিশ্চিত হোন।
              </p>
            </div>
          </div>

          {/* Collapsible Disclaimer & Community Liability Notice Card */}
          <div className="mt-6 sm:mt-8 max-w-4xl mx-auto">
            <div
              onClick={() => setDisclaimerOpen((prev) => !prev)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setDisclaimerOpen((prev) => !prev);
                }
              }}
              className="rounded-2xl border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-800/50 p-4 sm:p-5 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-all cursor-pointer group"
              data-testid="button-toggle-disclaimer"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700/70 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                      দায়মুক্তি ও গ্রাহক সতর্কতা নোটিশ
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate sm:whitespace-normal mt-0.5">
                      লেনদেনের নিরাপত্তা ও প্রশাসনিক নীতি সম্পর্কিত বিস্তারিত জানতে ক্লিক করুন।
                    </p>
                  </div>
                </div>

                <div className="shrink-0 p-1 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors">
                  <ChevronDown
                    className={`w-5 h-5 transition-transform duration-300 ease-in-out ${
                      disclaimerOpen ? "rotate-180 text-primary" : ""
                    }`}
                  />
                </div>
              </div>

              {/* Expandable Inner Content */}
              {disclaimerOpen && (
                <div className="mt-4 pt-4 border-t border-slate-200/70 dark:border-slate-700/60 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-4 sm:p-5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed space-y-4">
                    <div className="space-y-2">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                        📌 গ্রাহক সতর্কতা ও প্রশাসনিক দায়মুক্তি নোটিশ:
                      </h4>
                      <p>
                        আমাদের প্ল্যাটফর্মটি গ্রুপের সম্মানিত সদস্যদের লেনদেনকে আরও স্বচ্ছ ও নিরাপদ করতে একটি ভেরিফিকেশন ব্যবস্থা পরিচালনা করে। প্রতিটি সেলারকে জাতীয় পরিচয়পত্র (NID) এবং ফেসবুক প্রোফাইল পর্যবেক্ষণের মাধ্যমে সর্বোচ্চ সতর্কতা অবলম্বন করে অনুমোদন দেওয়া হয়।
                      </p>
                      <p>
                        তবে মানুষ পরিবর্তনশীল। একজন ব্যক্তি অতীতে শতভাগ সৎ ও বিশ্বস্ত থাকা সত্ত্বেও ভবিষ্যতে কখন তার মানসিকতা পরিবর্তন হবে বা সে কোনো অনাকাঙ্ক্ষিত প্রতারণামূলক কাজে জড়াবে—তা পূর্বানুমান করা কোনো তৃতীয় পক্ষের পক্ষেই সম্ভব নয়।
                      </p>
                      <p className="font-medium text-slate-800 dark:text-slate-200 bg-amber-500/10 dark:bg-amber-500/15 p-3 sm:p-3.5 rounded-lg border border-amber-500/20">
                        অতএব, কোনো সেলারের ব্যক্তিগত অনিয়ম, আর্থিক অসততা বা প্রতারণার জন্য প্ল্যাটফর্ম বা গ্রুপ অ্যাডমিন প্যানেল কোনোভাবেই প্রত্যক্ষ বা পরোক্ষ দায়ভার (আর্থিক বা আইনগত) গ্রহণ করবে না। ক্রেতাদের নিজ দায়িত্বে ও সচেতনভাবে লেনদেন করার বিনীত অনুরোধ করা হচ্ছে।
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 space-y-2">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                        🤝 আমাদের প্রতিশ্রুতি ও সহযোগিতা:
                      </h4>
                      <p>
                        আমরা আপনাদের সুরক্ষায় সবসময় সর্বোচ্চ আন্তরিক। কোনো সেলারের বিরুদ্ধে সুনির্দিষ্ট প্রমাণসহ প্রতারণার অভিযোগ এলে অ্যাডমিন প্যানেল তাৎক্ষণিকভাবে:
                      </p>
                      <ul className="space-y-1.5 pl-1">
                        <li className="flex items-start gap-2">
                          <span className="text-primary font-bold shrink-0">•</span>
                          <span>সংশ্লিষ্ট সেলারের কোড বাতিল ও চিরতরে ব্ল্যাকলিস্ট করবে।</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary font-bold shrink-0">•</span>
                          <span>গ্রুপ ও প্ল্যাটফর্মে তার বিরুদ্ধে প্রকাশ্য সতর্কতা জারি করবে।</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary font-bold shrink-0">•</span>
                          <span>আইনি পদক্ষেপ গ্রহণের সুবিধার্থে ক্ষতিগ্রস্ত ক্রেতাকে প্রয়োজনীয় তথ্যাদি দিয়ে সর্বোচ্চ প্রশাসনিক সহায়তা প্রদান করবে।</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-10 sm:mt-12 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 max-w-md mx-auto sm:max-w-none px-2">
            <Link href="/apply" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto rounded-xl px-7 h-12 text-sm sm:text-base font-semibold gap-2.5 shadow-md bg-primary hover:bg-primary/90 transition-all duration-200" data-testid="button-join-as-seller">
                <FileCheck className="w-5 h-5 shrink-0" />
                <span>সেলার হিসেবে জয়েন করুন</span>
              </Button>
            </Link>
            <Link href="/renew" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto rounded-xl px-7 h-12 text-sm sm:text-base font-semibold gap-2.5 border-2 border-primary/30 text-primary hover:bg-primary/10 hover:border-primary transition-all duration-200" data-testid="button-renew-seller-code">
                <RotateCw className="w-4 h-4 shrink-0" />
                <span>কোড নবায়ন করুন</span>
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto py-8 sm:py-10 bg-slate-900 text-slate-400 text-xs border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 text-white font-semibold">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>সেলার রেজিস্ট্রি কমিউনিটি ভেরিফিকেশন সিস্টেম</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            <a href="#verify" className="hover:text-white transition-colors">যাচাই করুন</a>
            <a href="#directory" className="hover:text-white transition-colors">সেলার তালিকা</a>
            <Link href="/apply" className="hover:text-white transition-colors">নতুন আবেদন</Link>
            <Link href="/renew" className="hover:text-white transition-colors">নবায়ন পোর্টাল</Link>
          </div>

          <p className="text-slate-500 text-center sm:text-right">
            কপিরাইট © {new Date().getFullYear()} সর্বস্বত্ব সংরক্ষিত।
          </p>
        </div>
      </footer>
    </div>
  );
}
