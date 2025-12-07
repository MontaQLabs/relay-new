"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  Copy,
  Check,
  History,
  Key,
  Lock,
  Users,
  Shield,
  FileText,
  LogOut,
  AlertCircle,
  Camera,
  Loader2,
} from "lucide-react";
import { getWalletAddress } from "@/app/utils/wallet";
import { getUserByWallet } from "@/app/db/supabase";
import { signOut, getAuthToken } from "@/app/utils/auth";
import { WALLET_KEY } from "@/app/types/constants";
import type { User, Wallet } from "@/app/types/frontend_type";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import SeedPhraseDisplay from "@/components/SeedPhraseDisplay";
import { WALLET_SEED_KEY } from "@/app/types/constants";

interface MenuItem {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: {
    text: string;
    variant: "warning" | "error";
  };
  href?: string;
  onClick?: () => void;
}

type ButtonState = "idle" | "processing" | "success" | "error";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Edit profile states
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editAvatar, setEditAvatar] = useState("");
  const [editNickname, setEditNickname] = useState("");
  const [buttonState, setButtonState] = useState<ButtonState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Seed phrase modal state
  const [isSeedPhraseOpen, setIsSeedPhraseOpen] = useState(false);

  useEffect(() => {
    const loadUserData = async () => {
      try {
        // Get wallet address from localStorage
        const walletAddress = getWalletAddress();
        
        if (walletAddress) {
          // Try to get user from Supabase
          const userData = await getUserByWallet(walletAddress);
          if (userData) {
            setUser(userData);
            setWallet(userData.wallet);
          } else {
            // Fallback to localStorage wallet data
            const walletData = localStorage.getItem(WALLET_KEY);
            if (walletData) {
              const parsedWallet = JSON.parse(walletData) as Wallet;
              setWallet(parsedWallet);
            }
          }
        }
      } catch (error) {
        console.error("Failed to load user data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, []);

  // Generate DiceBear avatar URL using the wallet address as seed
  const getAvatarUrl = () => {
    if (user?.avatar) return user.avatar;
    const seed = wallet?.address || "anonymous";
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;
  };

  // Get display nickname
  const getDisplayName = () => {
    if (user?.nickname && user.nickname.trim()) return user.nickname;
    return "Anonymous";
  };

  // Truncate address for display
  const truncateAddress = (address: string) => {
    if (!address) return "";
    if (address.length <= 16) return address;
    return `${address.slice(0, 8)}....${address.slice(-8)}`;
  };

  // Copy address to clipboard
  const copyAddress = async () => {
    if (!wallet?.address) return;
    try {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy address:", error);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await signOut();
      router.push("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Check if wallet is backed up
  const isBackedUp = wallet?.isBackedUp ?? false;

  // Check if social recovery is configured
  const hasSocialRecovery = user?.socialRecovery && user.socialRecovery.length > 0;

  // Open edit profile sheet
  const openEditProfile = () => {
    setEditAvatar(user?.avatar || getAvatarUrl());
    setEditNickname(user?.nickname || "");
    setButtonState("idle");
    setErrorMessage("");
    setIsEditProfileOpen(true);
  };

  // Handle avatar change
  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // For now, create a local URL preview
      // In production, you'd upload to a storage service
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle save profile
  const handleSaveProfile = async () => {
    if (!wallet?.address) return;

    setButtonState("processing");
    setErrorMessage("");

    try {
      // Only update changed values
      const updates: { avatar?: string; nickname?: string } = {};
      
      const originalAvatar = user?.avatar || getAvatarUrl();
      const originalNickname = user?.nickname || "";

      if (editAvatar !== originalAvatar) {
        updates.avatar = editAvatar;
      }
      if (editNickname !== originalNickname) {
        updates.nickname = editNickname;
      }

      // If nothing changed, just close
      if (Object.keys(updates).length === 0) {
        setIsEditProfileOpen(false);
        return;
      }

      // Get auth token
      const authToken = getAuthToken();
      if (!authToken) {
        throw new Error("Not authenticated. Please log in again.");
      }

      // Call the API route
      const response = await fetch("/api/user/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      setButtonState("success");
      
      // Refetch user data from database to ensure sync
      try {
        const updatedUserData = await getUserByWallet(wallet.address);
        if (updatedUserData) {
          setUser(updatedUserData);
          setWallet(updatedUserData.wallet);
        } else {
          // Fallback to local state update if refetch fails
          setUser((prev) =>
            prev
              ? {
                  ...prev,
                  avatar: updates.avatar ?? prev.avatar,
                  nickname: updates.nickname ?? prev.nickname,
                }
              : prev
          );
        }
      } catch (refetchError) {
        console.error("Failed to refetch user data:", refetchError);
        // Fallback to local state update
        setUser((prev) =>
          prev
            ? {
                ...prev,
                avatar: updates.avatar ?? prev.avatar,
                nickname: updates.nickname ?? prev.nickname,
              }
            : prev
        );
      }

      // Close after 0.5 second
      setTimeout(() => {
        setIsEditProfileOpen(false);
        setButtonState("idle");
      }, 500);
    } catch (error) {
      console.error("Failed to save profile:", error);
      setButtonState("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to save profile. Please try again."
      );
      
      // Reset button state after showing error
      setTimeout(() => {
        setButtonState("idle");
      }, 2000);
    }
  };

  // Get button content based on state
  const getButtonContent = () => {
    switch (buttonState) {
      case "processing":
        return (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Saving...</span>
          </>
        );
      case "success":
        return (
          <>
            <Check className="w-4 h-4" />
            <span>Saved!</span>
          </>
        );
      case "error":
        return <span>Try Again</span>;
      default:
        return <span>Confirm</span>;
    }
  };

  // Get button styles based on state
  const getButtonStyles = () => {
    switch (buttonState) {
      case "processing":
        return "bg-gray-400 cursor-not-allowed";
      case "success":
        return "bg-green-500 hover:bg-green-600";
      case "error":
        return "bg-red-500 hover:bg-red-600";
      default:
        return "bg-gray-700 hover:bg-gray-800";
    }
  };

  const menuItems: MenuItem[] = [
    {
      id: "transaction-history",
      icon: <History className="w-5 h-5" />,
      title: "Transaction History",
      description: "Check details of your transactions",
      href: "/dashboard/settings/transaction-history",
    },
    {
      id: "seed-phrase",
      icon: <Key className="w-5 h-5" />,
      title: "Seed Phrase",
      description: "Check your seed phrase",
      badge: !isBackedUp ? { text: "not backed up", variant: "error" } : undefined,
      onClick: () => setIsSeedPhraseOpen(true),
    },
    {
      id: "change-password",
      icon: <Lock className="w-5 h-5" />,
      title: "Change Password",
      description: "Only used on your local device",
      href: "/dashboard/settings/change-password",
    },
    {
      id: "friends",
      icon: <Users className="w-5 h-5" />,
      title: "Friends",
      description: "Add, edit, delete, and manage your friends",
      href: "/dashboard/settings/friends",
    },
    {
      id: "social-recovery",
      icon: <Shield className="w-5 h-5" />,
      title: "Social Recovery",
      description: "Recovery account through friends",
      badge: !hasSocialRecovery ? { text: "not configured", variant: "error" } : undefined,
      href: "/dashboard/settings/social-recovery",
    },
    {
      id: "terms",
      icon: <FileText className="w-5 h-5" />,
      title: "Terms and Services",
      description: "",
      href: "/dashboard/settings/terms",
    },
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 px-5 animate-fade-in">
        {/* Skeleton for header */}
        <div className="animate-pulse">
          <div className="h-4 w-16 bg-gray-200 rounded mb-1" />
          <div className="h-6 w-24 bg-gray-200 rounded" />
        </div>

        {/* Skeleton for user card */}
        <div className="flex items-center gap-4 py-4 animate-pulse">
          <div className="w-16 h-16 rounded-full bg-gray-200" />
          <div className="flex-1">
            <div className="h-5 w-24 bg-gray-200 rounded mb-2" />
            <div className="h-4 w-40 bg-gray-200 rounded" />
          </div>
          <div className="h-8 w-24 bg-gray-200 rounded-full" />
        </div>

        {/* Skeleton for menu items */}
        <div className="bg-gradient-to-br from-violet-50/50 to-pink-50/50 rounded-3xl p-4 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-4 py-4">
              <div className="w-5 h-5 bg-gray-200 rounded" />
              <div className="flex-1">
                <div className="h-5 w-32 bg-gray-200 rounded mb-1" />
                <div className="h-4 w-48 bg-gray-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-5 animate-fade-in">
      {/* User Profile Header */}
      <div className="flex items-center gap-4 py-2">
        {/* Avatar */}
        <div className="relative w-16 h-16 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 ring-2 ring-violet-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getAvatarUrl()}
            alt="Avatar"
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback if DiceBear fails
              e.currentTarget.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${wallet?.address || "default"}`;
            }}
          />
        </div>

        {/* User Info */}
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-black truncate">
            {getDisplayName()}
          </h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Address:</span>
            <span className="font-mono truncate">
              {truncateAddress(wallet?.address || "")}
            </span>
            <button
              onClick={copyAddress}
              className="p-1 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
              aria-label="Copy address"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4 text-gray-400" />
              )}
            </button>
          </div>
        </div>

        {/* Edit Profile Button */}
        <button
          onClick={openEditProfile}
          className="px-4 py-2 bg-gray-700 text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors flex-shrink-0"
        >
          Edit Profile
        </button>
      </div>

      {/* Edit Profile Sheet */}
      <Sheet open={isEditProfileOpen} onOpenChange={setIsEditProfileOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-6 pb-8">
          <SheetHeader className="text-center pb-4">
            <SheetTitle className="text-xl font-bold">Edit Profile</SheetTitle>
            <SheetDescription>
              Update your avatar and display name
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col items-center gap-6 pt-4">
            {/* Avatar Editor */}
            <div className="relative">
              <div
                onClick={handleAvatarClick}
                className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 cursor-pointer ring-4 ring-violet-100 hover:ring-violet-200 transition-all group"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={editAvatar}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${wallet?.address || "default"}`;
                  }}
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                  <Camera className="w-6 h-6 text-white" />
                </div>
              </div>
              <button
                onClick={handleAvatarClick}
                className="absolute -bottom-1 -right-1 w-8 h-8 bg-violet-500 rounded-full flex items-center justify-center shadow-lg hover:bg-violet-600 transition-colors"
              >
                <Camera className="w-4 h-4 text-white" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Nickname Input */}
            <div className="w-full max-w-sm">
              <label htmlFor="nickname" className="block text-sm font-medium text-gray-700 mb-2">
                Display Name
              </label>
              <Input
                id="nickname"
                type="text"
                value={editNickname}
                onChange={(e) => setEditNickname(e.target.value)}
                placeholder="Enter your display name"
                className="w-full h-12 px-4 rounded-xl border-gray-200 focus:border-violet-500 focus:ring-violet-500 text-black"
              />
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="w-full max-w-sm flex items-center gap-2 text-red-500 text-sm bg-red-50 p-3 rounded-xl">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="w-full max-w-sm flex gap-3 pt-2">
              <button
                onClick={() => setIsEditProfileOpen(false)}
                disabled={buttonState === "processing"}
                className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 font-medium rounded-full hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={buttonState === "processing" || buttonState === "success"}
                className={`flex-1 py-3 px-4 text-white font-medium rounded-full transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed ${getButtonStyles()}`}
              >
                {getButtonContent()}
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Menu Items */}
      <div className="bg-gradient-to-br from-violet-50/50 to-pink-50/50 rounded-3xl overflow-hidden">
        {menuItems.map((item, index) => (
          <button
            key={item.id}
            onClick={() => {
              if (item.onClick) {
                item.onClick();
              } else if (item.href) {
                router.push(item.href);
              }
            }}
            className={`w-full flex items-center gap-4 px-5 py-4 hover:bg-white/50 transition-colors text-left ${
              index !== menuItems.length - 1 ? "border-b border-gray-100/50" : ""
            }`}
          >
            {/* Icon */}
            <div className="text-gray-600">{item.icon}</div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-black">{item.title}</h3>
              </div>
              {item.description && (
                <p className="text-sm text-muted-foreground truncate">
                  {item.description}
                </p>
              )}
            </div>

            {/* Badge */}
            {item.badge && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full border border-red-200 bg-red-50/50">
                <AlertCircle className="w-3 h-3 text-red-500" />
                <span className="text-xs font-medium text-red-500">
                  {item.badge.text}
                </span>
              </div>
            )}

            {/* Chevron */}
            <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
          </button>
        ))}
      </div>

      {/* Logout Button */}
      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-5 py-4 text-red-500 font-semibold hover:bg-red-50 rounded-2xl transition-colors"
      >
        <LogOut className="w-5 h-5" />
        <span>Logout</span>
      </button>

      {/* Seed Phrase Sheet */}
      <SeedPhraseSheet
        isOpen={isSeedPhraseOpen}
        onClose={() => setIsSeedPhraseOpen(false)}
      />
    </div>
  );
}

// Seed Phrase Sheet Component
function SeedPhraseSheet({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  // Compute seed phrase from localStorage when sheet is open
  const seedPhrase = useMemo(() => {
    if (!isOpen || typeof window === "undefined") {
      return null; // null means not loaded yet
    }
    const mnemonic = localStorage.getItem(WALLET_SEED_KEY);
    return mnemonic ? mnemonic.trim().split(/\s+/) : [];
  }, [isOpen]);

  const isLoading = seedPhrase === null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="rounded-t-3xl px-6 pb-8 max-h-[90vh] overflow-y-auto">
        <SheetHeader className="text-left pb-6">
          {/* Back button */}
          <button
            onClick={onClose}
            className="mb-4 -ml-2 p-2 cursor-pointer"
            aria-label="Go back"
          >
            <svg
              className="w-6 h-6"
              style={{ color: "#1a1a1a" }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          {/* Title */}
          <SheetTitle className="text-3xl font-semibold tracking-tight text-left" style={{ color: "#1a1a1a" }}>
            View Seed Phrase
          </SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="py-8 text-center">
            <div className="inline-block w-8 h-8 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
          </div>
        ) : seedPhrase === null || seedPhrase.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-gray-600">No seed phrase found. Please create or import a wallet first.</p>
          </div>
        ) : (
          <>
            {/* Seed Phrase Display */}
            <div className="mb-8">
              <SeedPhraseDisplay words={seedPhrase} />
            </div>

            {/* Finish Button */}
            <button
              onClick={onClose}
              className="w-full h-14 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer"
              style={{
                backgroundColor: "#1a1a1a",
              }}
            >
              <span className="text-white font-medium">Finish</span>
            </button>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
