// Check if user already has "relay-wallet" in their browser's local storage
export const exists = (): boolean => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("relay-wallet") !== null;
};
