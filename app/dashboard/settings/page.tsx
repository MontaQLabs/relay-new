"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
import { getWalletAddress, encryptWallet } from "@/app/utils/wallet";
import { getUserByWallet } from "@/app/db/supabase";
import { signOut, getAuthToken } from "@/app/utils/auth";
import { validate } from "@/app/utils/password";
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
  disabled?: boolean;
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


  // Change password sheet state
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  
  // Seed phrase sheet state
  const [isSeedPhraseOpen, setIsSeedPhraseOpen] = useState(false);

  // Logout sheet state
  const [isLogoutSheetOpen, setIsLogoutSheetOpen] = useState(false);

  // Terms sheet state
  const [isTermsOpen, setIsTermsOpen] = useState(false);

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

  // Open logout sheet
  const handleLogoutClick = () => {
    setIsLogoutSheetOpen(true);
  };

  // Handle confirm logout (keeps encrypted wallet)
  const handleConfirmLogout = async () => {
    try {
      // Delete all non-auth related storage items except for the encrypted wallet
      if (typeof window !== "undefined") {
        localStorage.removeItem(WALLET_KEY);
        localStorage.removeItem(WALLET_SEED_KEY);
        localStorage.removeItem(IS_ENCRYPTED_KEY);
        localStorage.removeItem(USER_KEY);
        // Remove any app-specific storage items
        localStorage.removeItem("community-draft");
        // Note: ENCRYPTED_WALLET_KEY is preserved
      }
      
      // Then call signOut to handle auth-related cleanup
      await signOut();
      router.push("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Handle delete wallet (deletes everything)
  const handleDeleteWallet = async () => {
    try {
      // Delete ALL relay-related storage items
      if (typeof window !== "undefined") {
        localStorage.removeItem(WALLET_KEY);
        localStorage.removeItem(WALLET_SEED_KEY);
        localStorage.removeItem(ENCRYPTED_WALLET_KEY);
        localStorage.removeItem(IS_ENCRYPTED_KEY);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(IS_BACKED_UP_KEY);
        // Remove any app-specific storage items
        localStorage.removeItem("community-draft");
      }
      
      // Then call signOut to handle auth-related cleanup
      await signOut();
      router.push("/");
    } catch (error) {
      console.error("Delete wallet failed:", error);
    }
  };

  // Check if wallet is backed up
  const isBackedUp = wallet?.isBackedUp ?? false;

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
              if (item.disabled) return;
              if (item.onClick) {
                item.onClick();
              } else if (item.href) {
                router.push(item.href);
              }
            }}
            disabled={item.disabled}
            className={`w-full flex items-center gap-4 px-5 py-4 transition-colors text-left ${
              index !== menuItems.length - 1 ? "border-b border-gray-100/50" : ""
            } ${
              item.disabled
                ? "cursor-not-allowed opacity-50"
                : "hover:bg-white/50"
            }`}
          >
            {/* Icon */}
            <div className={item.disabled ? "text-gray-400" : "text-gray-600"}>{item.icon}</div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className={`font-semibold ${item.disabled ? "text-gray-400" : "text-black"}`}>{item.title}</h3>
                {item.disabled && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 rounded-full">
                    Coming soon
                  </span>
                )}
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
            <ChevronRight className={`w-5 h-5 flex-shrink-0 ${item.disabled ? "text-gray-300" : "text-gray-400"}`} />
          </button>
        ))}
      </div>

      {/* Logout Button */}
      <button
        onClick={handleLogoutClick}
        className="flex items-center gap-3 px-5 py-4 text-red-500 font-semibold hover:bg-red-50 rounded-2xl transition-colors"
      >
        <LogOut className="w-5 h-5" />
        <span>Logout</span>
      </button>

      {/* Change Password Sheet */}
      <ChangePasswordSheet
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />

      {/* Seed Phrase Sheet */}
      <SeedPhraseSheet
        isOpen={isSeedPhraseOpen}
        onClose={() => setIsSeedPhraseOpen(false)}
      />

      {/* Logout Sheet */}
      <LogoutSheet
        isOpen={isLogoutSheetOpen}
        onClose={() => setIsLogoutSheetOpen(false)}
        onConfirmLogout={handleConfirmLogout}
        onDeleteWallet={handleDeleteWallet}
      />

      {/* Terms Sheet */}
      <TermsSheet
        isOpen={isTermsOpen}
        onClose={() => setIsTermsOpen(false)}
      />
    </div>
  );
}

// Change Password Sheet Component
function ChangePasswordSheet({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Password validation
  const isPasswordValid = validate(password);
  const doPasswordsMatch = password === confirmPassword;
  const canSubmit = isPasswordValid && doPasswordsMatch && acknowledged;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    
    setIsLoading(true);
    try {
      // Get the wallet from localStorage
      const walletData = localStorage.getItem(WALLET_KEY);
      if (!walletData) {
        throw new Error("Wallet not found");
      }
      const wallet = JSON.parse(walletData) as Wallet;

      // Encrypt the wallet with the password
      const success = await encryptWallet(wallet, password);
      
      if (success) {
        // Navigate to login page on success
        router.push("/login");
      } else {
        throw new Error("Failed to encrypt wallet");
      }
    } catch (error) {
      console.error("Failed to set password:", error);
      setIsLoading(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-md px-6 pb-8 overflow-auto">
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
            Change Password
          </SheetTitle>
          <p 
            className="text-base mt-2"
            style={{ color: '#8e8e93' }}
          >
            Only for this device
          </p>
        </SheetHeader>

        {/* Form content */}
        <div className="space-y-6">
          {/* Create Password field */}
          <div>
            <label 
              className="block text-sm font-medium mb-2"
              style={{ color: '#1a1a1a' }}
            >
              Create Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full h-14 px-4 pr-12 rounded-2xl border text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-200"
                style={{ 
                  backgroundColor: '#ffffff',
                  borderColor: '#e5e5e5',
                  color: '#1a1a1a'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOffIcon className="w-5 h-5" style={{ color: '#8e8e93' }} />
                ) : (
                  <EyeIcon className="w-5 h-5" style={{ color: '#8e8e93' }} />
                )}
              </button>
            </div>
          </div>

          {/* Confirm Password field */}
          <div>
            <label 
              className="block text-sm font-medium mb-2"
              style={{ color: '#1a1a1a' }}
            >
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                className="w-full h-14 px-4 pr-12 rounded-2xl border text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-200"
                style={{ 
                  backgroundColor: '#ffffff',
                  borderColor: '#e5e5e5',
                  color: '#1a1a1a'
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 cursor-pointer"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? (
                  <EyeOffIcon className="w-5 h-5" style={{ color: '#8e8e93' }} />
                ) : (
                  <EyeIcon className="w-5 h-5" style={{ color: '#8e8e93' }} />
                )}
              </button>
            </div>
          </div>

          {/* Acknowledgment checkbox */}
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => setAcknowledged(!acknowledged)}
              className="mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200 cursor-pointer"
              style={{ 
                borderColor: acknowledged ? '#1a1a1a' : '#d1d1d6',
                backgroundColor: acknowledged ? '#1a1a1a' : 'transparent'
              }}
            >
              {acknowledged && (
                <svg 
                  className="w-3.5 h-3.5 text-white" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
            <p 
              className="text-sm leading-relaxed"
              style={{ color: '#1a1a1a' }}
            >
              We don&apos;t store your password, so we cannot recover it if you lose it
            </p>
          </div>
        </div>

        {/* Confirm button */}
        <div className="pt-6 pb-4">
          <button
            onClick={handleConfirm}
            disabled={!canSubmit || isLoading}
            className="w-full h-14 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
            style={{ 
              backgroundColor: canSubmit ? '#1a1a1a' : '#d1d1d6',
            }}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <svg 
                  className="animate-spin h-5 w-5 text-white" 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24"
                >
                  <circle 
                    className="opacity-25" 
                    cx="12" 
                    cy="12" 
                    r="10" 
                    stroke="currentColor" 
                    strokeWidth="4"
                  />
                  <path 
                    className="opacity-75" 
                    fill="currentColor" 
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
            ) : (
              <span className="text-white font-medium">Confirm</span>
            )}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Eye icon component
function EyeIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg 
      className={className} 
      style={style}
      fill="none" 
      viewBox="0 0 24 24" 
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" 
      />
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" 
      />
    </svg>
  );
}

// Eye off icon component
function EyeOffIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg 
      className={className} 
      style={style}
      fill="none" 
      viewBox="0 0 24 24" 
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" 
      />
    </svg>
  );
}

// Seed Phrase Sheet Component
type SeedPhraseStep = "reveal" | "verify1" | "verify2" | "error" | "success";

function SeedPhraseSheet({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [seedPhrase, setSeedPhrase] = useState<string[]>([]);
  const [step, setStep] = useState<SeedPhraseStep>("reveal");
  const [isRevealed, setIsRevealed] = useState(false);
  const [seedCopied, setSeedCopied] = useState(false);
  const [verificationFields, setVerificationFields] = useState<{
    [key: number]: string;
  }>({});
  const [activeField, setActiveField] = useState<number | null>(null);
  const [lastVerifyStep, setLastVerifyStep] = useState<"verify1" | "verify2">("verify1");

  // Compute available words based on current step and seed phrase
  const availableWords = useMemo(() => {
    if (seedPhrase.length === 0) return [];
    const emptyFields = step === "verify1" ? [9, 10, 12] : [2, 6, 11];
    const wordsToFill = emptyFields.map((n) => seedPhrase[n - 1]);
    return [...new Set(wordsToFill)];
  }, [step, seedPhrase]);

  // Initialize seed phrase when sheet opens
  const initializeSeedPhrase = useCallback(() => {
    const mnemonic = localStorage.getItem(WALLET_SEED_KEY);
    if (mnemonic) {
      const words = mnemonic.trim().split(/\s+/);
      setSeedPhrase(words);
    }
  }, []);

  // Handle sheet open change
  const handleOpenChange = (open: boolean) => {
    if (open) {
      // Reset all state when opening
      setStep("reveal");
      setIsRevealed(false);
      setVerificationFields({});
      setActiveField(null);
      setLastVerifyStep("verify1");
      initializeSeedPhrase();
    } else {
      onClose();
    }
  };

  const handleClose = () => {
    localStorage.setItem(IS_BACKED_UP_KEY, "true");
    handleOpenChange(false);
  };

  // Initialize seed phrase when isOpen becomes true
  const prevIsOpenRef = useRef(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      initializeSeedPhrase();
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen]);

  const handleReveal = () => {
    setIsRevealed(true);
  };

  const handleNextFromReveal = () => {
    if (isRevealed) {
      setStep("verify1");
      setActiveField(9);
      setVerificationFields({});
    }
  };

  const handleCopy = async () => {
    try {
      const phrase = seedPhrase.join(" ");
      await navigator.clipboard.writeText(phrase);
      setSeedCopied(true);
      setTimeout(() => setSeedCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  const handleWordSelect = (word: string) => {
    if (activeField !== null) {
      setVerificationFields((prev) => ({
        ...prev,
        [activeField]: word,
      }));

      const emptyFields = step === "verify1" ? [9, 10, 12] : [2, 6, 11];
      const currentIndex = emptyFields.indexOf(activeField);
      if (currentIndex < emptyFields.length - 1) {
        setActiveField(emptyFields[currentIndex + 1]);
      } else {
        setActiveField(null);
      }
    }
  };

  const handleVerify = () => {
    const emptyFields = step === "verify1" ? [9, 10, 12] : [2, 6, 11];
    
    const allFilled = emptyFields.every((field) => verificationFields[field]);
    if (!allFilled) return;

    const isCorrect = emptyFields.every(
      (field) => verificationFields[field] === seedPhrase[field - 1]
    );

    if (isCorrect) {
      if (step === "verify1") {
        setLastVerifyStep("verify1");
        setStep("verify2");
        setActiveField(2);
        setVerificationFields({});
      } else if (step === "verify2") {
        setLastVerifyStep("verify2");
        setStep("success");
      }
    } else {
      if (step === "verify1") {
        setLastVerifyStep("verify1");
      } else {
        setLastVerifyStep("verify2");
      }
      setStep("error");
    }
  };

  const handleTryAgain = () => {
    setStep(lastVerifyStep);
    setVerificationFields({});
    const emptyFields = lastVerifyStep === "verify1" ? [9, 10, 12] : [2, 6, 11];
    setActiveField(emptyFields[0]);
  };

  const getStepNumber = () => {
    switch (step) {
      case "reveal": return 1;
      case "verify1": return 2;
      case "verify2": return 3;
      case "error": return lastVerifyStep === "verify1" ? 2 : 3;
      case "success": return 3;
      default: return 1;
    }
  };

  const renderProgressIndicator = () => {
    const currentStep = getStepNumber();
    return (
      <div className="flex gap-2 mb-4">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full ${
              s <= currentStep ? "bg-purple-600" : "bg-gray-200"
            }`}
          />
        ))}
      </div>
    );
  };

  const renderRevealStep = () => (
    <>
      <SheetHeader className="text-left pb-6">
        <button
          onClick={handleClose}
          className="mb-4 -ml-2 p-2 cursor-pointer"
        >
          <svg className="w-6 h-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        {renderProgressIndicator()}
        <SheetTitle className="text-3xl font-semibold tracking-tight text-left text-black">
          Export Seed Phrase
        </SheetTitle>
        <p className="text-sm text-gray-600 mt-2">
          If the seed phrase is lost, all of your assets would be lost. Please back it up in a secure place, and do not share it with anyone.
        </p>
      </SheetHeader>

      <div className="mb-4 flex flex-col justify-center">
        {!isRevealed ? (
          <div className="bg-gray-100 rounded-2xl p-8 flex flex-col items-center justify-center">
            <button
              onClick={handleReveal}
              className="flex flex-col items-center gap-2 cursor-pointer"
            >
              <EyeOffIcon className="w-8 h-8 text-black" />
              <span className="text-base font-medium text-black">Click to Reveal</span>
              <span className="text-sm text-gray-600">Make sure nobody is looking</span>
            </button>
            <div className="mt-8 grid grid-cols-3 gap-3 w-full">
              {Array.from({ length: 12 }).map((_, index) => (
                <div
                  key={index}
                  className="h-12 rounded-xl bg-gray-200 blur-sm"
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {seedPhrase.map((word, index) => (
              <div
                key={index}
                className="h-12 rounded-xl border flex items-center px-3 bg-gray-50 border-gray-200"
              >
                <span className="text-sm font-medium mr-2 text-gray-500">
                  {index + 1}.
                </span>
                <span className="text-base font-medium flex-1 text-black">
                  {word}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mb-4 h-[52px] flex justify-center items-center">
        {isRevealed && (
          <button
            onClick={handleCopy}
            className={`font-medium text-sm transition-colors ${
              seedCopied
                ? "text-green-600 hover:text-green-700"
                : "text-purple-600 hover:text-purple-700"
            }`}
          >
            {seedCopied ? "Copied!" : "Copy"}
          </button>
        )}
      </div>

      <button
        onClick={handleNextFromReveal}
        disabled={!isRevealed}
        className="w-full h-14 rounded-full bg-black text-white font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Next
      </button>
    </>
  );

  const renderVerifyStep = () => {
    const emptyFields = step === "verify1" ? [9, 10, 12] : [2, 6, 11];
    const allFields = Array.from({ length: 12 }, (_, i) => i + 1);

    return (
      <>
        <SheetHeader className="text-left pb-6">
          <button
            onClick={() => {
              if (step === "verify1") {
                setStep("reveal");
              } else {
                setStep("verify1");
                setActiveField(9);
                setVerificationFields({});
              }
            }}
            className="mb-4 -ml-2 p-2 cursor-pointer"
          >
            <svg className="w-6 h-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          {renderProgressIndicator()}
          <SheetTitle className="text-3xl font-semibold tracking-tight text-left text-black">
            Verify
          </SheetTitle>
          <p className="text-sm text-gray-600 mt-2">
            Fill in the word in correct order.
          </p>
        </SheetHeader>

        <div className="mb-4 h-[300px] flex flex-col justify-center">
          <div className="grid grid-cols-3 gap-3 bg-gray-50 rounded-2xl p-4">
            {allFields.map((fieldNum) => {
              const isEmpty = emptyFields.includes(fieldNum);
              const isActive = activeField === fieldNum;
              const value = verificationFields[fieldNum] || "";

              return (
                <div
                  key={fieldNum}
                  className={`h-12 rounded-xl border flex items-center px-3 ${
                    isEmpty
                      ? isActive
                        ? "bg-white border-purple-600 border-2"
                        : "bg-white border-gray-200"
                      : "bg-gray-50 border-gray-200"
                  }`}
                  onClick={() => {
                    if (isEmpty) {
                      setActiveField(fieldNum);
                    }
                  }}
                >
                  <span className="text-sm font-medium mr-2 text-gray-500">
                    {fieldNum}.
                  </span>
                  {isEmpty ? (
                    <input
                      type="text"
                      value={value}
                      readOnly
                      className="flex-1 text-base font-medium text-black bg-transparent outline-none cursor-pointer"
                      placeholder=""
                    />
                  ) : (
                    <span className="text-base font-medium flex-1 text-black">
                      • • • •
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mb-4 h-[52px] flex gap-3 justify-center flex-wrap items-center">
          {availableWords.map((word, index) => {
            const usedInField = Object.entries(verificationFields).find(
              ([, value]) => value === word
            );
            const isUsed = !!usedInField;
            
            return (
              <button
                key={index}
                onClick={() => !isUsed && activeField !== null && handleWordSelect(word)}
                disabled={isUsed || activeField === null}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  isUsed
                    ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-white border-purple-600 text-purple-600 hover:bg-purple-50 active:bg-purple-100"
                }`}
              >
                {word}
              </button>
            );
          })}
        </div>

        <button
          onClick={handleVerify}
          disabled={!emptyFields.every((field) => verificationFields[field])}
          className="w-full h-14 rounded-full bg-black text-white font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </>
    );
  };

  const renderErrorStep = () => (
    <>
      <SheetHeader className="text-left pb-6">
        <div className="mb-4 h-10" /> {/* Spacer for consistent height */}
        {renderProgressIndicator()}
      </SheetHeader>

      <div className="h-[300px] flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <AlertCircle className="w-10 h-10 text-red-600" />
        </div>
        <h3 className="text-2xl font-semibold text-black mb-2">
          Incorrect Order
        </h3>
        <p className="text-gray-600">
          Please re-check your seed phrase and try again.
        </p>
      </div>

      <div className="mb-4 h-[52px]" /> {/* Spacer for consistent height */}

      <button
        onClick={handleTryAgain}
        className="w-full h-14 rounded-full bg-black text-white font-medium hover:bg-gray-800"
      >
        Try Again
      </button>
    </>
  );

  const renderSuccessStep = () => (
    <>
      <SheetHeader className="text-left pb-6">
        <div className="mb-4 h-10" /> {/* Spacer for consistent height */}
        {renderProgressIndicator()}
      </SheetHeader>

      <div className="h-[300px] flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mb-4">
          <Check className="w-10 h-10 text-purple-600" />
        </div>
        <h3 className="text-2xl font-semibold text-black mb-2">
          Perfect!
        </h3>
        <p className="text-gray-600">
          Do not share it with anyone.
        </p>
      </div>

      <div className="mb-4 h-[52px]" /> {/* Spacer for consistent height */}

      <button
        onClick={handleClose}
        className="w-full h-14 rounded-full bg-purple-600 text-white font-medium hover:bg-purple-700"
      >
        Confirm
      </button>
    </>
  );

  if (seedPhrase.length === 0 && isOpen) {
    return (
      <Sheet open={isOpen} onOpenChange={handleClose}>
        <SheetContent side="bottom" className="rounded-t-3xl px-6 pb-8 max-h-[90vh] overflow-y-auto">
          <SheetHeader className="text-left pb-4">
            <button
              onClick={handleClose}
              className="mb-4 -ml-2 p-2 cursor-pointer"
              aria-label="Go back"
            >
              <svg className="w-6 h-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <SheetTitle className="text-3xl font-semibold tracking-tight text-left text-black">
              Export Seed Phrase
            </SheetTitle>
          </SheetHeader>
          <div className="py-8 text-center">
            <p className="text-gray-600">No seed phrase found. Please create or import a wallet first.</p>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="rounded-t-3xl px-6 pb-8 max-h-[90vh] overflow-y-auto">
        {step === "reveal" && renderRevealStep()}
        {(step === "verify1" || step === "verify2") && renderVerifyStep()}
        {step === "error" && renderErrorStep()}
        {step === "success" && renderSuccessStep()}
      </SheetContent>
    </Sheet>
  );
}

// Logout Sheet Component
function LogoutSheet({
  isOpen,
  onClose,
  onConfirmLogout,
  onDeleteWallet,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirmLogout: () => Promise<void>;
  onDeleteWallet: () => Promise<void>;
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingAction, setProcessingAction] = useState<"logout" | "delete" | null>(null);

  const handleConfirmLogout = async () => {
    setIsProcessing(true);
    setProcessingAction("logout");
    await onConfirmLogout();
    setIsProcessing(false);
    setProcessingAction(null);
    onClose();
  };

  const handleDeleteWallet = async () => {
    setIsProcessing(true);
    setProcessingAction("delete");
    await onDeleteWallet();
    setIsProcessing(false);
    setProcessingAction(null);
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="rounded-t-3xl px-6 pb-8">
        <SheetHeader className="text-center pb-6">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <LogOut className="w-8 h-8 text-red-500" />
          </div>
          <SheetTitle className="text-2xl font-bold text-black">
            Leaving?
          </SheetTitle>
          <SheetDescription className="text-gray-600">
            Choose how you want to sign out
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3">
          {/* Confirm Logout Button */}
          <button
            onClick={handleConfirmLogout}
            disabled={isProcessing}
            className="w-full py-4 px-5 bg-gray-100 hover:bg-gray-200 rounded-2xl transition-colors flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                <LogOut className="w-5 h-5 text-gray-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-black">Confirm Logout</p>
                <p className="text-sm text-gray-500">Keep wallet for next login</p>
              </div>
            </div>
            {processingAction === "logout" ? (
              <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {/* Delete Wallet Button */}
          <button
            onClick={handleDeleteWallet}
            disabled={isProcessing}
            className="w-full py-4 px-5 bg-red-50 hover:bg-red-100 rounded-2xl transition-colors flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-red-600">Delete Wallet</p>
                <p className="text-sm text-red-400">Remove all local data</p>
              </div>
            </div>
            {processingAction === "delete" ? (
              <Loader2 className="w-5 h-5 animate-spin text-red-500" />
            ) : (
              <ChevronRight className="w-5 h-5 text-red-400" />
            )}
          </button>
        </div>

        {/* Cancel Button */}
        <button
          onClick={onClose}
          disabled={isProcessing}
          className="w-full mt-4 py-3 text-gray-600 font-medium hover:text-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
      </SheetContent>
    </Sheet>
  );
}

// Terms and Services Sheet Component
function TermsSheet({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const lastUpdated = "December 8, 2024";

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-lg px-0 pb-0 overflow-hidden flex flex-col">
        <SheetHeader className="text-left px-6 pb-4 border-b border-gray-100 flex-shrink-0">
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

          <SheetTitle className="text-2xl font-bold tracking-tight text-left text-black">
            Terms of Service
          </SheetTitle>
          <p className="text-sm text-gray-500 mt-1">
            Last updated: {lastUpdated}
          </p>
        </SheetHeader>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-8 text-gray-700 text-sm leading-relaxed pb-8">
            
            {/* Introduction */}
            <section>
              <h2 className="text-lg font-semibold text-black mb-3">1. Acceptance of Terms</h2>
              <p className="mb-3">
                Welcome to Relay (&quot;Company,&quot; &quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). By accessing or using our 
                non-custodial digital wallet application and related services (collectively, the &quot;Services&quot;), 
                you agree to be bound by these Terms of Service (&quot;Terms&quot;).
              </p>
              <p>
                If you do not agree to these Terms, you may not access or use our Services. We reserve 
                the right to modify these Terms at any time. Your continued use of the Services after 
                any such changes constitutes your acceptance of the new Terms.
              </p>
            </section>

            {/* Description of Services */}
            <section>
              <h2 className="text-lg font-semibold text-black mb-3">2. Description of Services</h2>
              <p className="mb-3">
                Relay provides a non-custodial digital wallet that enables you to:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Generate and manage cryptographic key pairs</li>
                <li>Store, send, and receive digital assets on supported blockchain networks</li>
                <li>Create and participate in community-based activities</li>
                <li>Interact with decentralized applications (dApps)</li>
                <li>View transaction history and account balances</li>
              </ul>
              <p className="mt-3">
                As a non-custodial wallet, <strong>you maintain complete control over your private keys 
                and seed phrase</strong>. We do not have access to, and cannot recover, your private keys 
                or seed phrase.
              </p>
            </section>

            {/* Eligibility */}
            <section>
              <h2 className="text-lg font-semibold text-black mb-3">3. Eligibility</h2>
              <p>
                You must be at least 18 years old and capable of forming a binding contract to use 
                our Services. By using the Services, you represent and warrant that you meet these 
                requirements and that you are not prohibited from using the Services under any 
                applicable laws.
              </p>
            </section>

            {/* Wallet Security */}
            <section>
              <h2 className="text-lg font-semibold text-black mb-3">4. Wallet Security & Self-Custody</h2>
              <p className="mb-3">
                <strong>Your responsibility:</strong> You are solely responsible for maintaining the 
                security of your wallet, including:
              </p>
              <ul className="list-disc pl-5 space-y-2 mb-3">
                <li>
                  <strong>Seed Phrase:</strong> Your 12-word seed phrase is the master key to your 
                  wallet. Store it securely offline. Never share it with anyone. We will never ask 
                  for your seed phrase.
                </li>
                <li>
                  <strong>Password:</strong> Your local password encrypts your wallet on this device. 
                  We cannot recover forgotten passwords.
                </li>
                <li>
                  <strong>Device Security:</strong> Keep your device secure with up-to-date software 
                  and strong device-level authentication.
                </li>
              </ul>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-4">
                <p className="text-amber-800 font-medium">
                  ⚠️ Warning: Loss of your seed phrase means permanent loss of access to your 
                  digital assets. We cannot recover your wallet or funds under any circumstances.
                </p>
              </div>
            </section>

            {/* Private Keys */}
            <section>
              <h2 className="text-lg font-semibold text-black mb-3">5. Private Keys & Digital Assets</h2>
              <p className="mb-3">
                You acknowledge and agree that:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  Private keys are generated locally on your device and are never transmitted to 
                  our servers
                </li>
                <li>
                  You are solely responsible for all activities that occur through your wallet
                </li>
                <li>
                  Blockchain transactions are irreversible once confirmed on the network
                </li>
                <li>
                  Digital asset values are highly volatile and can lose all value
                </li>
                <li>
                  We do not provide investment, tax, or financial advice
                </li>
              </ul>
            </section>

            {/* Transactions */}
            <section>
              <h2 className="text-lg font-semibold text-black mb-3">6. Transactions</h2>
              <p className="mb-3">
                When you initiate a transaction through our Services:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  You are responsible for verifying the recipient address and transaction details
                </li>
                <li>
                  Transactions broadcast to blockchain networks are irreversible
                </li>
                <li>
                  Network fees (gas fees) are determined by the blockchain network, not by us
                </li>
                <li>
                  We do not guarantee transaction confirmation times or success
                </li>
                <li>
                  Sending assets to an incorrect address may result in permanent loss
                </li>
              </ul>
            </section>

            {/* Fees */}
            <section>
              <h2 className="text-lg font-semibold text-black mb-3">7. Fees</h2>
              <p>
                Using our wallet is free. However, blockchain networks charge transaction fees 
                (gas fees) for processing transactions. These fees are paid directly to network 
                validators/miners and are not collected by us. Fee amounts vary based on network 
                congestion and transaction complexity.
              </p>
            </section>

            {/* Third Party */}
            <section>
              <h2 className="text-lg font-semibold text-black mb-3">8. Third-Party Services</h2>
              <p className="mb-3">
                Our Services may integrate with or link to third-party services, including:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Decentralized applications (dApps)</li>
                <li>Token swap protocols</li>
                <li>Price data providers</li>
                <li>Blockchain explorers</li>
              </ul>
              <p className="mt-3">
                We are not responsible for the availability, accuracy, or actions of any 
                third-party services. Your use of third-party services is at your own risk and 
                subject to their respective terms.
              </p>
            </section>

            {/* Prohibited Activities */}
            <section>
              <h2 className="text-lg font-semibold text-black mb-3">9. Prohibited Activities</h2>
              <p className="mb-3">
                You agree not to use our Services to:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Violate any applicable laws or regulations</li>
                <li>Engage in money laundering, terrorist financing, or other illegal activities</li>
                <li>Circumvent sanctions or export controls</li>
                <li>Infringe on intellectual property rights</li>
                <li>Attempt to compromise the security of our Services</li>
                <li>Interfere with other users&apos; access to the Services</li>
                <li>Distribute malware or harmful code</li>
              </ul>
            </section>

            {/* Disclaimers */}
            <section>
              <h2 className="text-lg font-semibold text-black mb-3">10. Disclaimers</h2>
              <p className="mb-3 uppercase text-xs tracking-wide text-gray-500">
                THE SERVICES ARE PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF 
                ANY KIND, EXPRESS OR IMPLIED.
              </p>
              <p className="mb-3">
                We disclaim all warranties, including but not limited to:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Merchantability and fitness for a particular purpose</li>
                <li>Uninterrupted or error-free operation</li>
                <li>Accuracy of blockchain data or price information</li>
                <li>Security against all potential threats</li>
                <li>Compatibility with all devices or networks</li>
              </ul>
            </section>

            {/* Limitation of Liability */}
            <section>
              <h2 className="text-lg font-semibold text-black mb-3">11. Limitation of Liability</h2>
              <p className="mb-3">
                To the maximum extent permitted by law, we shall not be liable for:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Loss of digital assets due to user error, lost keys, or forgotten passwords</li>
                <li>Unauthorized access resulting from compromised devices or credentials</li>
                <li>Blockchain network failures, forks, or congestion</li>
                <li>Smart contract bugs or vulnerabilities</li>
                <li>Market volatility or changes in digital asset values</li>
                <li>Any indirect, incidental, special, or consequential damages</li>
              </ul>
            </section>

            {/* Indemnification */}
            <section>
              <h2 className="text-lg font-semibold text-black mb-3">12. Indemnification</h2>
              <p>
                You agree to indemnify, defend, and hold harmless the Company and its officers, 
                directors, employees, and agents from any claims, damages, losses, or expenses 
                arising from your use of the Services, violation of these Terms, or infringement 
                of any rights of third parties.
              </p>
            </section>

            {/* Governing Law */}
            <section>
              <h2 className="text-lg font-semibold text-black mb-3">13. Governing Law</h2>
              <p>
                These Terms shall be governed by and construed in accordance with the laws of 
                the jurisdiction in which the Company is incorporated, without regard to its 
                conflict of law provisions. Any disputes arising from these Terms or your use 
                of the Services shall be resolved through binding arbitration.
              </p>
            </section>

            {/* Termination */}
            <section>
              <h2 className="text-lg font-semibold text-black mb-3">14. Termination</h2>
              <p>
                You may stop using our Services at any time. Since this is a non-custodial wallet, 
                your digital assets remain accessible through your seed phrase on any compatible 
                wallet application. We reserve the right to suspend or discontinue the Services 
                at any time with reasonable notice.
              </p>
            </section>

            {/* Changes */}
            <section>
              <h2 className="text-lg font-semibold text-black mb-3">15. Changes to Terms</h2>
              <p>
                We may update these Terms from time to time. We will notify you of material changes 
                through the application or other reasonable means. Your continued use of the Services 
                after changes become effective constitutes acceptance of the modified Terms.
              </p>
            </section>

            {/* Contact */}
            <section>
              <h2 className="text-lg font-semibold text-black mb-3">16. Contact Us</h2>
              <p className="mb-3">
                If you have questions about these Terms or our Services, please contact us at:
              </p>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="font-medium text-black">Relay Support</p>
                <p className="text-gray-600">support@montaq.org</p>
              </div>
            </section>

            {/* Final acknowledgment */}
            <section className="pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center">
                By using Relay, you acknowledge that you have read, understood, and agree to 
                be bound by these Terms of Service.
              </p>
            </section>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
