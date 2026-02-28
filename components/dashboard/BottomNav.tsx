"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { House, Trophy, CircleUser, Coins, Spade } from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

export default function BottomNav() {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    {
      label: "Home",
      href: "/dashboard/wallet",
      Icon: House,
    },
    {
      label: "Stake",
      href: "/dashboard/staking",
      Icon: Coins,
    },
    {
      label: "Arena",
      href: "/dashboard/championship",
      Icon: Trophy,
    },
    {
      label: "Poker",
      href: "/dashboard/poker",
      Icon: Spade,
    },
    {
      label: "My",
      href: "/dashboard/settings",
      Icon: CircleUser,
    },
  ];

  const isActive = (href: string) => {
    if (href === "/dashboard/wallet") {
      return pathname === "/dashboard" || pathname === "/dashboard/wallet";
    }
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-20 max-w-lg mx-auto px-4">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const { Icon } = item;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 py-2 px-4 min-w-[72px] transition-all duration-200 ${
                active ? "text-violet-500" : "text-muted-foreground"
              }`}
            >
              <div className="relative">
                <Icon className="w-6 h-6" strokeWidth={active ? 2 : 1.5} />
              </div>
              <span
                className={`text-xs font-medium ${
                  active ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
