"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createWallet, isCreated } from "../utils/wallet";

export default function WelcomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateAccount = async () => {
    setIsLoading(true);
    try {
      await createWallet();
      
      // Verify wallet was created successfully
      if (isCreated()) {
        router.push("/create-password");
      } else {
        console.error("Wallet creation verification failed");
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Failed to create wallet:", error);
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col justify-between bg-white"> 
      {/* Main content area */}
      <div className="flex flex-col items-center justify-center px-6 pb-32 flex-1">
        {/* Logo */}
        <div className="w-40 h-40 mb-10 animate-fade-in">
          <Image
            src="/icons/icon.svg"
            alt="Relay Logo"
            width={160}
            height={160}
            priority
          />
        </div>

        {/* Welcome text */}
        <h1 
          className="text-3xl font-semibold tracking-tight mb-3 animate-slide-up"
          style={{ color: '#1a1a1a' }}
        >
          Welcome to Relay
        </h1>
        
        <p 
          className="text-base animate-slide-up animation-delay-100"
          style={{ color: '#8e8e93' }}
        >
          Build your community here
        </p>
      </div>

      {/* Button area */}
      <div className="px-6 pb-10 space-y-3">
        {/* Create Account button */}
        <button 
          onClick={handleCreateAccount}
          disabled={isLoading}
          className="w-full h-14 rounded-full flex items-center justify-center animate-slide-up animation-delay-200 transition-all duration-200 disabled:opacity-70 cursor-pointer disabled:cursor-not-allowed"
          style={{ backgroundColor: '#1a1a1a' }}
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
              <span className="text-white font-medium">Creating Wallet...</span>
            </div>
          ) : (
            <span className="text-white font-medium">Create Account</span>
          )}
        </button>
        
        {/* Already have an Account button */}
        <button 
          disabled={isLoading}
          className="w-full h-14 rounded-full flex items-center justify-center border animate-slide-up animation-delay-300 transition-all duration-200 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          style={{ backgroundColor: '#f5f5f5', borderColor: '#e5e5e5' }}
        >
          <span style={{ color: '#1a1a1a' }} className="font-medium">
            Already have an Account
          </span>
        </button>
      </div>
    </div>
  );
}
