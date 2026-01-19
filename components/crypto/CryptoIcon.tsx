"use client";

import { getCoinColors } from "@/lib/constants/colors";

interface CryptoIconProps {
  symbol: string;
  color?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Renders an icon for a cryptocurrency
 * Uses SVG icons for known cryptos, falls back to first letter
 */
export function CryptoIcon({
  symbol,
  color,
  size = "md",
  className = "",
}: CryptoIconProps) {
  const resolvedColor = color || getCoinColors(symbol).color;
  
  const sizeMap = {
    sm: { icon: 16, text: "text-xs" },
    md: { icon: 20, text: "text-sm" },
    lg: { icon: 24, text: "text-base" },
  };
  
  const { icon: iconSize, text: textSize } = sizeMap[size];

  switch (symbol) {
    case "ETH":
    case "ETC":
      return (
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 20 20"
          fill="none"
          style={{ color: resolvedColor }}
          className={className}
        >
          <path
            d="M10 2L4 10L10 13L16 10L10 2Z"
            fill="currentColor"
            opacity={symbol === "ETH" ? 0.6 : 0.8}
          />
          <path d="M10 13L4 10L10 18L16 10L10 13Z" fill="currentColor" />
        </svg>
      );
    case "BTC":
      return (
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 20 20"
          fill="none"
          style={{ color: resolvedColor }}
          className={className}
        >
          <text
            x="50%"
            y="55%"
            dominantBaseline="middle"
            textAnchor="middle"
            fontSize="14"
            fontWeight="bold"
            fill="currentColor"
          >
            ₿
          </text>
        </svg>
      );
    case "ZEC":
      return (
        <span className={`${textSize} font-bold ${className}`} style={{ color: resolvedColor }}>
          ⓩ
        </span>
      );
    case "XMR":
      return (
        <span className={`${textSize} font-bold ${className}`} style={{ color: resolvedColor }}>
          ɱ
        </span>
      );
    default:
      return (
        <span className={`${textSize} font-bold ${className}`} style={{ color: resolvedColor }}>
          {symbol[0]}
        </span>
      );
  }
}

interface CoinAvatarProps {
  ticker: string;
  symbol?: string; // Image URL
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Renders a coin avatar with background color and icon
 * Shows image if available, falls back to CryptoIcon
 */
export function CoinAvatar({
  ticker,
  symbol,
  size = "md",
  className = "",
}: CoinAvatarProps) {
  const colors = getCoinColors(ticker);
  
  const sizeMap = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
  };
  
  const imgSizeMap = {
    sm: "w-5 h-5",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  return (
    <div
      className={`${sizeMap[size]} rounded-full flex items-center justify-center overflow-hidden ${className}`}
      style={{ backgroundColor: colors.bg }}
    >
      {symbol ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={symbol}
          alt={ticker}
          className={`${imgSizeMap[size]} object-contain`}
          onError={(e) => {
            e.currentTarget.style.display = "none";
            e.currentTarget.nextElementSibling?.classList.remove("hidden");
          }}
        />
      ) : null}
      <CryptoIcon
        symbol={ticker}
        color={colors.color}
        size={size}
        className={symbol ? "hidden" : ""}
      />
    </div>
  );
}
