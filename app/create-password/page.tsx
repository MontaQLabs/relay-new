"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { validate } from "../utils/password";
import { encryptWallet } from "../utils/wallet";
import { WALLET_KEY } from "../types/constants";
import { Wallet } from "../types/frontend_type";

export default function CreatePasswordPage() {
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
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header */}
      <div className="pt-16 px-6 pb-8">
        <h1 
          className="text-3xl font-semibold tracking-tight animate-fade-in"
          style={{ color: '#1a1a1a' }}
        >
          Create Password
        </h1>
        <p 
          className="text-base mt-2 animate-slide-up"
          style={{ color: '#8e8e93' }}
        >
          Only for this device
        </p>
      </div>

      {/* Form content */}
      <div className="flex-1 px-6 space-y-6">
        {/* Create Password field */}
        <div className="animate-slide-up animation-delay-100">
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
        <div className="animate-slide-up animation-delay-200">
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
        <div className="flex items-start gap-3 animate-slide-up animation-delay-300">
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
      <div className="px-6 pb-10 pt-6">
        <button
          onClick={handleConfirm}
          disabled={!canSubmit || isLoading}
          className="w-full h-14 rounded-full flex items-center justify-center transition-all duration-200 animate-slide-up animation-delay-400 cursor-pointer disabled:cursor-not-allowed"
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
    </div>
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
