import { useQuery } from "@tanstack/react-query";
import type { SocialCommunityLink } from "@shared/schema";
import { SiFacebook, SiMessenger, SiWhatsapp, SiTelegram } from "react-icons/si";
import { Globe, ExternalLink, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PlatformConfig {
  name: string;
  badgeLabel: string;
  buttonLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  btnBg: string;
  btnHover: string;
  cardBorder: string;
}

const PLATFORM_CONFIGS: Record<string, PlatformConfig> = {
  facebook: {
    name: "Facebook Group",
    badgeLabel: "Facebook Group",
    buttonLabel: "ফেসবুক গ্রুপে যুক্ত হোন",
    icon: SiFacebook,
    iconBg: "bg-blue-50 dark:bg-blue-950/40",
    iconColor: "text-[#1877F2]",
    btnBg: "bg-[#1877F2] hover:bg-[#166fe5]",
    btnHover: "hover:bg-[#166fe5]",
    cardBorder: "border-blue-200/80 dark:border-blue-900/40 hover:border-[#1877F2]/40",
  },
  messenger: {
    name: "Messenger Group",
    badgeLabel: "Messenger",
    buttonLabel: "মেসেঞ্জারে যুক্ত হোন",
    icon: SiMessenger,
    iconBg: "bg-sky-50 dark:bg-sky-950/40",
    iconColor: "text-[#0084FF]",
    btnBg: "bg-[#0084FF] hover:bg-[#0073e6]",
    btnHover: "hover:bg-[#0073e6]",
    cardBorder: "border-sky-200/80 dark:border-sky-900/40 hover:border-[#0084FF]/40",
  },
  whatsapp: {
    name: "WhatsApp Group",
    badgeLabel: "WhatsApp Group",
    buttonLabel: "হোয়াটসঅ্যাপে যুক্ত হোন",
    icon: SiWhatsapp,
    iconBg: "bg-emerald-50 dark:bg-emerald-950/40",
    iconColor: "text-[#25D366]",
    btnBg: "bg-[#25D366] hover:bg-[#20ba59]",
    btnHover: "hover:bg-[#20ba59]",
    cardBorder: "border-emerald-200/80 dark:border-emerald-900/40 hover:border-[#25D366]/40",
  },
  telegram: {
    name: "Telegram Channel",
    badgeLabel: "Telegram Group",
    buttonLabel: "টেলিগ্রামে যুক্ত হোন",
    icon: SiTelegram,
    iconBg: "bg-cyan-50 dark:bg-cyan-950/40",
    iconColor: "text-[#24A1DE]",
    btnBg: "bg-[#24A1DE] hover:bg-[#1f8fc6]",
    btnHover: "hover:bg-[#1f8fc6]",
    cardBorder: "border-cyan-200/80 dark:border-cyan-900/40 hover:border-[#24A1DE]/40",
  },
  other: {
    name: "Community",
    badgeLabel: "Community",
    buttonLabel: "কমিউনিটিতে যুক্ত হোন",
    icon: Globe,
    iconBg: "bg-orange-50 dark:bg-orange-950/40",
    iconColor: "text-orange-600 dark:text-orange-400",
    btnBg: "bg-orange-600 hover:bg-orange-700",
    btnHover: "hover:bg-orange-700",
    cardBorder: "border-orange-200/80 dark:border-orange-900/40 hover:border-orange-500/40",
  },
};

export function SocialCommunitySection() {
  const { data: communityLinks = [], isLoading } = useQuery<SocialCommunityLink[]>({
    queryKey: ["/api/public/community-links"],
    queryFn: async () => {
      const res = await fetch("/api/public/community-links");
      if (!res.ok) throw new Error("Failed to fetch community links");
      return res.json();
    },
    staleTime: 60000,
  });

  // Strict Dynamic Visibility Logic:
  // If no active community links exist, hide the entire section completely.
  if (isLoading || communityLinks.length === 0) {
    return null;
  }

  return (
    <section
      id="community"
      className="py-14 sm:py-20 bg-gradient-to-b from-white via-orange-50/20 to-white dark:from-[#0B132B]/50 dark:via-slate-900/40 dark:to-[#0B132B]/50 border-t border-slate-200/80 dark:border-slate-800 scroll-mt-16"
      data-testid="section-social-community"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 text-xs font-bold uppercase tracking-wider mb-3">
            <Users className="w-3.5 h-3.5" />
            <span>অফিশিয়াল কমিউনিটি</span>
          </div>
          <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            আমাদের কমিউনিটিতে যুক্ত হোন
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2.5 leading-relaxed">
            আমাদের অফিসিয়াল Social Media ও Community Groups-এ যুক্ত হয়ে প্রয়োজনীয় আপডেট, সহযোগিতা এবং গুরুত্বপূর্ণ তথ্য পান।
          </p>
        </div>

        {/* Dynamic Community Cards Grid */}
        <div
          className={`grid gap-5 sm:gap-6 ${
            communityLinks.length === 1
              ? "max-w-md mx-auto grid-cols-1"
              : communityLinks.length === 2
              ? "max-w-2xl mx-auto grid-cols-1 sm:grid-cols-2"
              : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          }`}
          data-testid="grid-community-cards"
        >
          {communityLinks.map((link) => {
            const config = PLATFORM_CONFIGS[link.platform] || PLATFORM_CONFIGS.other;
            const Icon = config.icon;

            return (
              <div
                key={link.id}
                className={`flex flex-col justify-between rounded-2xl bg-white dark:bg-slate-900/80 border p-5 sm:p-6 shadow-sm hover:shadow-md transition-all duration-200 group relative ${config.cardBorder}`}
                data-testid={`card-community-${link.id}`}
              >
                <div>
                  {/* Card Top: Platform Icon & Badge */}
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-xs transition-transform duration-200 group-hover:scale-105 ${config.iconBg} ${config.iconColor}`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {config.badgeLabel}
                    </span>
                  </div>

                  {/* Group Name */}
                  <h3
                    className="font-bold text-base sm:text-lg text-slate-900 dark:text-white mb-1.5 line-clamp-2 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors"
                    data-testid={`text-community-name-${link.id}`}
                  >
                    {link.groupName}
                  </h3>

                  {/* Description (if available) */}
                  {link.description && (
                    <p
                      className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4 line-clamp-3"
                      data-testid={`text-community-desc-${link.id}`}
                    >
                      {link.description}
                    </p>
                  )}
                </div>

                {/* Join Group Button */}
                <div className="pt-3 mt-auto">
                  <a
                    href={link.invitationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-block"
                    data-testid={`link-community-join-${link.id}`}
                  >
                    <Button
                      className={`w-full h-11 rounded-xl text-white font-semibold text-xs sm:text-sm gap-2 shadow-xs transition-all duration-200 active:scale-[0.98] ${config.btnBg}`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{config.buttonLabel}</span>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-80" />
                    </Button>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default SocialCommunitySection;
