"use client";

import Image from "next/image";

export default function WelcomePage() {
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

      {/* Button area placeholder - to be implemented */}
      <div className="px-6 pb-10 space-y-3">
        {/* Create Account button placeholder */}
        <div 
          className="w-full h-14 rounded-full flex items-center justify-center animate-slide-up animation-delay-200"
          style={{ backgroundColor: '#1a1a1a' }}
        >
          <span className="text-white font-medium">Create Account</span>
        </div>
        
        {/* Already have an Account button placeholder */}
        <div 
          className="w-full h-14 rounded-full flex items-center justify-center border animate-slide-up animation-delay-300"
          style={{ backgroundColor: '#f5f5f5', borderColor: '#e5e5e5' }}
        >
          <span style={{ color: '#1a1a1a' }} className="font-medium">
            Already have an Account
          </span>
        </div>
      </div>
    </div>
  );
}
