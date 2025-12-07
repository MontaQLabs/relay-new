"use client";

import { useState } from "react";
import Image from "next/image";
import { decryptWallet } from "../utils/wallet";
import { useRouter } from "next/navigation";
import { IS_ENCRYPTED_KEY, USER_KEY } from "../types/constants";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isAlreadyUnlocked] = useState(() => {
    if (typeof window === "undefined") return false;
    const isEncrypted = localStorage.getItem(IS_ENCRYPTED_KEY);
    const relayUser = localStorage.getItem(USER_KEY);
    return isEncrypted === "false" && relayUser !== null;
  });

  const handleUnlock = async () => {
    // Check if user has already unlocked the wallet and is logged in
    const isEncrypted = localStorage.getItem(IS_ENCRYPTED_KEY);
    const relayUser = localStorage.getItem(USER_KEY);

    if (isEncrypted === "false" && relayUser !== null) {
      router.push("/dashboard/wallet");
      return;
    } else {
      const success = await decryptWallet(password);
      if (success) {
        router.push("/dashboard/wallet");
      } else {
        alert("Wrong password");
      }
    }
  };
  const handleForgotPassword = () => {
    // Template: Add forgot password functionality here
    console.log("Forgot password clicked");
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Logo and Welcome section */}
      <div className="flex-1 flex flex-col items-center justify-center pt-16 px-6">
        {/* Logo */}
        <div className="mb-8 animate-fade-in">
          <div className="w-40 h-40 rounded-lg overflow-hidden bg-gray-200 flex items-center justify-center">
            <Image
              src="/icons/icon.svg"
              alt="Relay Logo"
              width={160}
              height={160}
              className="object-cover"
            />
          </div>
        </div>

        {/* Welcome text */}
        <h1
          className="text-3xl font-semibold tracking-tight animate-slide-up"
          style={{ color: "#1a1a1a" }}
        >
          Welcome Back
        </h1>
      </div>

      {/* Form content - only show password field if wallet is not already unlocked */}
      {!isAlreadyUnlocked && (
        <div className="px-6 pb-6">
          {/* Password field */}
          <div className="animate-slide-up animation-delay-100">
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: "#1a1a1a" }}
            >
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full h-14 px-4 pr-12 rounded-2xl border text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-200"
                style={{
                  backgroundColor: "#ffffff",
                  borderColor: "#e5e5e5",
                  color: "#1a1a1a",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOffIcon className="w-5 h-5" style={{ color: "#8e8e93" }} />
                ) : (
                  <EyeIcon className="w-5 h-5" style={{ color: "#8e8e93" }} />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unlock button and Forgot password */}
      <div className="px-6 pb-10 pt-6 space-y-4">
        <button
          onClick={handleUnlock}
          disabled={!isAlreadyUnlocked && !password}
          className="w-full h-14 rounded-full flex items-center justify-center transition-all duration-200 animate-slide-up animation-delay-200 cursor-pointer disabled:cursor-not-allowed"
          style={{
            backgroundColor: isAlreadyUnlocked || password ? "#1a1a1a" : "#d1d1d6",
          }}
        >
          <span className="text-white font-medium">Unlock</span>
        </button>

        <button
          onClick={handleForgotPassword}
          className="w-full text-center py-2 transition-colors duration-200 animate-slide-up animation-delay-300 cursor-pointer"
        >
          <span className="text-base font-medium" style={{ color: "#7c3aed" }}>
            Forgot your password?
          </span>
        </button>
      </div>
    </div>
  );
}

// Eye icon component
function EyeIcon({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
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
function EyeOffIcon({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
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
