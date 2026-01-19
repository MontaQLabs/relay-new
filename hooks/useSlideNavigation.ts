"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface UseSlideNavigationOptions {
  animationDuration?: number;
}

/**
 * Hook for handling slide-in/slide-out page navigation
 * Manages the exit animation state and navigation timing
 */
export function useSlideNavigation(options: UseSlideNavigationOptions = {}) {
  const { animationDuration = 300 } = options;
  const router = useRouter();
  const [isExiting, setIsExiting] = useState(false);

  const handleBack = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      router.back();
    }, animationDuration);
  }, [router, animationDuration]);

  const navigateTo = useCallback(
    (path: string) => {
      setIsExiting(true);
      setTimeout(() => {
        router.push(path);
      }, animationDuration);
    },
    [router, animationDuration]
  );

  const navigateWithoutAnimation = useCallback(
    (path: string) => {
      router.push(path);
    },
    [router]
  );

  return {
    isExiting,
    setIsExiting,
    handleBack,
    navigateTo,
    navigateWithoutAnimation,
    router,
  };
}
