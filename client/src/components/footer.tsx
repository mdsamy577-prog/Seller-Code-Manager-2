import { ShieldCheck } from "lucide-react";
import { Link } from "wouter";

interface FooterProps {
  showLinks?: boolean;
}

export function Footer({ showLinks = true }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto py-8 sm:py-10 bg-[#0B132B] text-slate-400 text-xs border-t border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
        {showLinks && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-6 border-b border-slate-800/60">
            <div className="flex items-center gap-2.5 text-white font-semibold">
              <div className="w-7 h-7 rounded-lg bg-orange-500/20 flex items-center justify-center border border-orange-500/30">
                <ShieldCheck className="w-4 h-4 text-orange-500 shrink-0" />
              </div>
              <span>সেলার কোড রেজিস্ট্রি · কমিউনিটি ভেরিফিকেশন সিস্টেম</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 font-medium">
              <a href="/#verify" className="hover:text-orange-400 transition-colors">যাচাই করুন</a>
              <a href="/#directory" className="hover:text-orange-400 transition-colors">সেলার তালিকা</a>
              <Link href="/apply" className="hover:text-orange-400 transition-colors">নতুন আবেদন</Link>
              <Link href="/renew" className="hover:text-orange-400 transition-colors">নবায়ন পোর্টাল</Link>
            </div>
          </div>
        )}

        {/* Responsive Copyright & Developer Credit Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left text-slate-400">
          <p>
            কপিরাইট © {currentYear} SobChina. সর্বস্বত্ব সংরক্ষিত।
          </p>

          <p className="flex items-center gap-1.5 flex-wrap justify-center sm:justify-end">
            <span>Developed &amp; Maintained by</span>
            <a
              href="https://www.facebook.com/share/1FArNChFsL/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-orange-400 hover:text-orange-300 underline underline-offset-4 transition-colors"
            >
              Shahriar Ahmed
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
