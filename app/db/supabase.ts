import { WALLET_KEY } from "../types/constants";
import { User, Friend, Transaction, Community, Wallet } from "../types/frontend_type";

export const fakeFetch = (): User => {
  // Fetch decrypted wallet from localStorage
  const walletData = localStorage.getItem(WALLET_KEY);
  if (!walletData) {
    throw new Error("Wallet not found");
  }
  const wallet = JSON.parse(walletData) as Wallet;

  const friends: Friend[] = [
    {
      nickname: "Alice",
      walletAddress: "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
      network: "Polkadot Asset Hub",
      remark: "College roommate",
    },
    {
      nickname: "Bob",
      walletAddress: "5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy",
      network: "Polkadot Asset Hub",
      remark: "Work colleague",
    },
    {
      nickname: "Charlie",
      walletAddress: "5HGjWAeFDfFCWPsjFQdVV2Msvz2XtMktvgocEZcCj68kUMaw",
      network: "Polkadot Asset Hub",
      remark: "Crypto meetup friend",
    },
  ];

  const transactions: Transaction[] = [
    {
      id: "tx_001",
      sender: "You",
      senderAddress: wallet.address,
      receiver: "Alice",
      receiverAddress: friends[0].walletAddress,
      network: "Polkadot Asset Hub",
      amountFiat: 50.0,
      feesFiat: 0.02,
      timestamp: "2025-12-04T14:30:00Z",
    },
    {
      id: "tx_002",
      sender: "Bob",
      senderAddress: friends[1].walletAddress,
      receiver: "You",
      receiverAddress: wallet.address,
      network: "Polkadot Asset Hub",
      amountFiat: 120.0,
      feesFiat: 0.03,
      timestamp: "2025-12-03T09:15:00Z",
    },
  ];

  const communities: Community[] = [
    {
      owner: "5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y",
      name: "Polkadot Builders",
      avatar: "https://picsum.photos/seed/community1/200",
      communityId: "comm_001",
      activities: ["act_001", "act_002"],
    },
  ];

  return {
    avatar: "https://picsum.photos/seed/user/200",
    nickname: "CryptoExplorer",
    wallet,
    friends,
    socialRecovery: [friends[0], friends[1]],
    transactions,
    communities,
    activities: ["act_001"],
  };
};