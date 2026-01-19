"use client";

import { useState, useEffect, useRef } from "react";
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
import { getAuthToken, signOut } from "@/app/utils/auth";
import { WALLET_KEY, WALLET_SEED_KEY, IS_ENCRYPTED_KEY, USER_KEY, IS_BACKED_UP_KEY, ENCRYPTED_WALLET_KEY } from "@/app/types/constants";
import type { User, Wallet } from "@/app/types/frontend_type";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks";
import { truncateAddress } from "@/lib/format";
import { getAvatarUrl } from "@/lib/avatar";
import { ChangePasswordSheet, LogoutSheet, SeedPhraseSheet, TermsSheet } from "./sheets";

interface MenuItem {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: { text: string; variant: "warning" | "error" };
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
}

type ButtonState = "idle" | "processing" | "success" | "error";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Use auth hook
  const { isAuthenticating, authError } = useAuth();

  // Edit profile states
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editAvatar, setEditAvatar] = useState("");
  const [editNickname, setEditNickname] = useState("");
  const [buttonState, setButtonState] = useState<ButtonState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sheet states
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isSeedPhraseOpen, setIsSeedPhraseOpen] = useState(false);
  const [isLogoutSheetOpen, setIsLogoutSheetOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);

  // Load user data after authentication
  useEffect(() => {
    if (isAuthenticating) return;

    const loadUserData = async () => {
      try {
        const walletAddress = getWalletAddress();

        if (walletAddress) {
          const userData = await getUserByWallet(walletAddress);
          if (userData) {
            setUser(userData);
            setWallet(userData.wallet);
          } else {
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
  }, [isAuthenticating]);

  const avatarUrl = getAvatarUrl(user?.avatar, wallet?.address || "anonymous");

  const getDisplayName = () => {
    if (user?.nickname && user.nickname.trim()) return user.nickname;
    return "Anonymous";
  };

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

  const handleConfirmLogout = async () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem(WALLET_KEY);
        localStorage.removeItem(WALLET_SEED_KEY);
        localStorage.removeItem(IS_ENCRYPTED_KEY);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem("community-draft");
      }
      await signOut();
      router.push("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleDeleteWallet = async () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem(WALLET_KEY);
        localStorage.removeItem(WALLET_SEED_KEY);
        localStorage.removeItem(ENCRYPTED_WALLET_KEY);
        localStorage.removeItem(IS_ENCRYPTED_KEY);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(IS_BACKED_UP_KEY);
        localStorage.removeItem("community-draft");
      }
      await signOut();
      router.push("/");
    } catch (error) {
      console.error("Delete wallet failed:", error);
    }
  };

  const isBackedUp = wallet?.isBackedUp ?? false;

  const openEditProfile = () => {
    setEditAvatar(user?.avatar || avatarUrl);
    setEditNickname(user?.nickname || "");
    setButtonState("idle");
    setErrorMessage("");
    setIsEditProfileOpen(true);
  };

  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setEditAvatar(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    if (!wallet?.address) return;

    setButtonState("processing");
    setErrorMessage("");

    try {
      const updates: { avatar?: string; nickname?: string } = {};
      const originalAvatar = user?.avatar || avatarUrl;
      const originalNickname = user?.nickname || "";

      if (editAvatar !== originalAvatar) updates.avatar = editAvatar;
      if (editNickname !== originalNickname) updates.nickname = editNickname;

      if (Object.keys(updates).length === 0) {
        setIsEditProfileOpen(false);
        return;
      }

      const authToken = getAuthToken();
      if (!authToken) throw new Error("Not authenticated. Please log in again.");

      const response = await fetch("/api/user/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to update profile");

      setButtonState("success");

      try {
        const updatedUserData = await getUserByWallet(wallet.address);
        if (updatedUserData) {
          setUser(updatedUserData);
          setWallet(updatedUserData.wallet);
        }
      } catch (refetchError) {
        console.error("Failed to refetch user data:", refetchError);
        setUser((prev) =>
          prev ? { ...prev, avatar: updates.avatar ?? prev.avatar, nickname: updates.nickname ?? prev.nickname } : prev
        );
      }

      setTimeout(() => {
        setIsEditProfileOpen(false);
        setButtonState("idle");
      }, 500);
    } catch (error) {
      console.error("Failed to save profile:", error);
      setButtonState("error");
      setErrorMessage(error instanceof Error ? error.message : "Failed to save profile. Please try again.");
      setTimeout(() => setButtonState("idle"), 2000);
    }
  };

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
      onClick: () => setIsChangePasswordOpen(true),
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
      description: "Recover your account through friends.",
      disabled: true,
    },
    {
      id: "terms",
      icon: <FileText className="w-5 h-5" />,
      title: "Terms and Services",
      description: "",
      onClick: () => setIsTermsOpen(true),
    },
  ];

  if (isAuthenticating) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 px-5 animate-fade-in">
        <div className="animate-pulse">
          <div className="h-4 w-16 bg-gray-200 rounded mb-1" />
          <div className="h-6 w-24 bg-gray-200 rounded" />
        </div>
        <div className="flex items-center gap-4 py-4 animate-pulse">
          <div className="w-16 h-16 rounded-full bg-gray-200" />
          <div className="flex-1">
            <div className="h-5 w-24 bg-gray-200 rounded mb-2" />
            <div className="h-4 w-40 bg-gray-200 rounded" />
          </div>
          <div className="h-8 w-24 bg-gray-200 rounded-full" />
        </div>
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
      {/* Auth Error Banner */}
      {authError && (
        <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-sm text-amber-800">{authError}</p>
        </div>
      )}

      {/* User Profile Header */}
      <div className="flex items-center gap-4 py-2">
        <div className="relative w-16 h-16 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 ring-2 ring-violet-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-black truncate">{getDisplayName()}</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Address:</span>
            <span className="font-mono truncate">{truncateAddress(wallet?.address || "")}</span>
            <button
              onClick={copyAddress}
              className="p-1 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
              aria-label="Copy address"
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-400" />}
            </button>
          </div>
        </div>

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
            <SheetDescription>Update your avatar and display name</SheetDescription>
          </SheetHeader>

          <div className="flex flex-col items-center gap-6 pt-4">
            <div className="relative">
              <div
                onClick={handleAvatarClick}
                className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 cursor-pointer ring-4 ring-violet-100 hover:ring-violet-200 transition-all group"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={editAvatar} alt="Avatar" className="w-full h-full object-cover" />
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
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            </div>

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

            {errorMessage && (
              <div className="w-full max-w-sm flex items-center gap-2 text-red-500 text-sm bg-red-50 p-3 rounded-xl">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

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
              if (item.disabled) return;
              if (item.onClick) item.onClick();
              else if (item.href) router.push(item.href);
            }}
            disabled={item.disabled}
            className={`w-full flex items-center gap-4 px-5 py-4 transition-colors text-left ${
              index !== menuItems.length - 1 ? "border-b border-gray-100/50" : ""
            } ${item.disabled ? "cursor-not-allowed opacity-50" : "hover:bg-white/50"}`}
          >
            <div className={item.disabled ? "text-gray-400" : "text-gray-600"}>{item.icon}</div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className={`font-semibold ${item.disabled ? "text-gray-400" : "text-black"}`}>{item.title}</h3>
                {item.disabled && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 rounded-full">Coming soon</span>
                )}
              </div>
              {item.description && <p className="text-sm text-muted-foreground truncate">{item.description}</p>}
            </div>

            {item.badge && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full border border-red-200 bg-red-50/50">
                <AlertCircle className="w-3 h-3 text-red-500" />
                <span className="text-xs font-medium text-red-500">{item.badge.text}</span>
              </div>
            )}

            <ChevronRight className={`w-5 h-5 flex-shrink-0 ${item.disabled ? "text-gray-300" : "text-gray-400"}`} />
          </button>
        ))}
      </div>

      {/* Logout Button */}
      <button
        onClick={() => setIsLogoutSheetOpen(true)}
        className="flex items-center gap-3 px-5 py-4 text-red-500 font-semibold hover:bg-red-50 rounded-2xl transition-colors"
      >
        <LogOut className="w-5 h-5" />
        <span>Logout</span>
      </button>

      {/* Sheet Components */}
      <ChangePasswordSheet isOpen={isChangePasswordOpen} onClose={() => setIsChangePasswordOpen(false)} />
      <SeedPhraseSheet isOpen={isSeedPhraseOpen} onClose={() => setIsSeedPhraseOpen(false)} />
      <LogoutSheet
        isOpen={isLogoutSheetOpen}
        onClose={() => setIsLogoutSheetOpen(false)}
        onConfirmLogout={handleConfirmLogout}
        onDeleteWallet={handleDeleteWallet}
      />
      <TermsSheet isOpen={isTermsOpen} onClose={() => setIsTermsOpen(false)} />
    </div>
  );
}
