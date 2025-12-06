"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  activeIcon: React.ReactNode;
}

export default function BottomNav() {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    {
      label: "Home",
      href: "/dashboard/wallet",
      icon: <WalletIcon className="w-6 h-6" />,
      activeIcon: <WalletActiveIcon className="w-6 h-6" />,
    },
    {
      label: "Community",
      href: "/dashboard/community",
      icon: <CommunityIcon className="w-6 h-6" />,
      activeIcon: <CommunityActiveIcon className="w-6 h-6" />,
    },
    {
      label: "My",
      href: "/dashboard/settings",
      icon: <ProfileIcon className="w-6 h-6" />,
      activeIcon: <ProfileIcon className="w-6 h-6" />,
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
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 py-2 px-4 min-w-[72px] transition-all duration-200 ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <div className="relative">
                {active ? item.activeIcon : item.icon}
                {active && (item.label === "Home" || item.label === "Community") && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-violet-500" />
                )}
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

// Wallet Icon (House/Home style as shown in design)
function WalletIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M3 9.5L12 4L21 9.5"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 8.5V18C5 18.5523 5.44772 19 6 19H18C18.5523 19 19 18.5523 19 18V8.5"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Wallet Active Icon (Filled)
function WalletActiveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M3 9.5L12 4L21 9.5"
        stroke="#8B5CF6"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 8.5V18C5 18.5523 5.44772 19 6 19H18C18.5523 19 19 18.5523 19 18V8.5"
        stroke="#8B5CF6"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="rgba(139, 92, 246, 0.15)"
      />
    </svg>
  );
}

// Community Icon (Paper plane style)
function CommunityIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M22 2L11 13"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M22 2L15 22L11 13L2 9L22 2Z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Community Active Icon (Filled paper plane)
function CommunityActiveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M22 2L11 13"
        stroke="#8B5CF6"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M22 2L15 22L11 13L2 9L22 2Z"
        stroke="#8B5CF6"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="rgba(139, 92, 246, 0.15)"
      />
    </svg>
  );
}

// Profile Icon (Circle with user)
function ProfileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth={1.5}
      />
      <circle
        cx="12"
        cy="10"
        r="3"
        stroke="currentColor"
        strokeWidth={1.5}
      />
      <path
        d="M6.168 18.849C6.584 16.622 9.067 15 12 15C14.933 15 17.416 16.622 17.832 18.849"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </svg>
  );
}

