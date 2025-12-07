"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Search,
  ChevronDown,
  Check,
  Loader2,
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import {
  fetchPolkadotTransactions,
  filterTransactionsByMonth,
  calculateTransactionTotals,
} from "@/app/utils/crypto";
import type { Transaction } from "@/app/types/frontend_type";

type TabType = "all" | "received" | "sent";

// Transaction icon component
function TransactionIcon({ type }: { type: "sent" | "received" }) {
  return (
    <div className="w-12 h-12 rounded-full bg-white border border-gray-200 flex items-center justify-center">
      <div className="relative">
        {/* Dollar sign with circular arrow */}
        <Coins className="w-5 h-5 text-black" />
        {/* Direction arrow indicator */}
        <div
          className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center ${
            type === "received" ? "bg-gray-800" : "bg-gray-800"
          }`}
        >
          {type === "received" ? (
            <ArrowDownLeft className="w-2.5 h-2.5 text-white" />
          ) : (
            <ArrowUpRight className="w-2.5 h-2.5 text-white" />
          )}
        </div>
      </div>
    </div>
  );
}

// Format address for display
function truncateAddress(address: string): string {
  if (!address || address.length <= 20) return address;
  return `${address.slice(0, 10)}...${address.slice(-10)}`;
}

// Format date for transaction list
function formatTransactionDate(timestamp: string): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// Format amount with appropriate decimals
function formatAmount(amount: number): string {
  if (amount < 0.0001) {
    return amount.toFixed(8);
  } else if (amount < 1) {
    return amount.toFixed(6);
  } else if (amount < 1000) {
    return amount.toFixed(4);
  } else {
    return amount.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
}

// Month names in English
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MONTHS_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function TransactionHistoryPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(
    () => new Date().getMonth() + 1
  );
  const [selectedYear, setSelectedYear] = useState(() =>
    new Date().getFullYear()
  );
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);

  // Temp state for month picker
  const [tempMonth, setTempMonth] = useState(selectedMonth);
  const [tempYear, setTempYear] = useState(selectedYear);

  // Fetch transactions on mount
  useEffect(() => {
    const loadTransactions = async () => {
      setIsLoading(true);
      try {
        const txs = await fetchPolkadotTransactions();
        setTransactions(txs);
      } catch (error) {
        console.error("Failed to fetch transactions:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTransactions();
  }, []);

  // Filter transactions based on tab, month, and search
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;

    // Filter by month
    filtered = filterTransactionsByMonth(filtered, selectedYear, selectedMonth);

    // Filter by tab
    if (activeTab === "received") {
      filtered = filtered.filter((tx) => tx.type === "received");
    } else if (activeTab === "sent") {
      filtered = filtered.filter((tx) => tx.type === "sent");
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (tx) =>
          tx.senderAddress.toLowerCase().includes(query) ||
          tx.receiverAddress.toLowerCase().includes(query) ||
          tx.ticker.toLowerCase().includes(query) ||
          tx.id.toLowerCase().includes(query)
      );
    }

    // Sort by timestamp (newest first)
    return filtered.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [transactions, activeTab, selectedMonth, selectedYear, searchQuery]);

  // Calculate totals for the current month
  const monthlyTotals = useMemo(() => {
    const monthTransactions = filterTransactionsByMonth(
      transactions,
      selectedYear,
      selectedMonth
    );
    return calculateTransactionTotals(monthTransactions);
  }, [transactions, selectedMonth, selectedYear]);

  // Get primary ticker for display (most common in current transactions)
  const primaryTicker = useMemo(() => {
    const monthTransactions = filterTransactionsByMonth(
      transactions,
      selectedYear,
      selectedMonth
    );
    if (monthTransactions.length === 0) return "DOT";

    const tickerCounts: Record<string, number> = {};
    for (const tx of monthTransactions) {
      tickerCounts[tx.ticker] = (tickerCounts[tx.ticker] || 0) + 1;
    }

    return (
      Object.entries(tickerCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "DOT"
    );
  }, [transactions, selectedMonth, selectedYear]);

  // Handle month picker confirmation
  const handleConfirmMonth = () => {
    setSelectedMonth(tempMonth);
    setSelectedYear(tempYear);
    setIsMonthPickerOpen(false);
  };

  // Open month picker
  const openMonthPicker = () => {
    setTempMonth(selectedMonth);
    setTempYear(selectedYear);
    setIsMonthPickerOpen(true);
  };

  // Generate years for picker (last 7 years)
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 7 }, (_, i) => currentYear - 3 + i);
  }, []);

  return (
    <div className="flex flex-col h-full bg-gray-50 min-h-screen">
      {/* Header with back button and search */}
      <div className="bg-white px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Go back"
          >
            <ChevronLeft className="w-6 h-6 text-gray-800" />
          </button>

          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search history"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-gray-100 border-0 rounded-full h-10"
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white px-6 pt-3 pb-2 border-b border-gray-100">
        <div className="flex items-center gap-8">
          {(["all", "received", "sent"] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2 text-sm font-medium capitalize transition-colors relative ${
                activeTab === tab
                  ? "text-violet-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab === "all"
                ? "All"
                : tab.charAt(0).toUpperCase() + tab.slice(1)}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-600 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {/* Month Summary Card */}
        <div className="mx-4 mt-4 bg-white rounded-3xl p-4 shadow-sm">
          {/* Month selector */}
          <button
            onClick={openMonthPicker}
            className="flex items-center gap-1 mb-3"
          >
            <span className="text-lg font-bold text-gray-900">
              {MONTHS[selectedMonth - 1]}
            </span>
            <ChevronDown className="w-5 h-5 text-gray-500" />
          </button>

          {/* Totals */}
          <div className="flex items-center gap-8">
            <div>
              <p className="text-xs text-gray-500 mb-1">Sent</p>
              <p className="text-lg font-bold text-gray-900">
                {formatAmount(monthlyTotals.sent)}{" "}
                <span className="text-sm font-normal text-gray-500">
                  {primaryTicker}
                </span>
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Received</p>
              <p className="text-lg font-bold text-gray-900">
                {formatAmount(monthlyTotals.received)}{" "}
                <span className="text-sm font-normal text-gray-500">
                  {primaryTicker}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Transaction List */}
        <div className="mx-4 mt-4 bg-white rounded-3xl overflow-hidden shadow-sm">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">No transactions found</p>
              <p className="text-sm text-gray-400 mt-1">
                {searchQuery
                  ? "Try a different search term"
                  : `No ${
                      activeTab === "all" ? "" : activeTab + " "
                    }transactions in ${
                      MONTHS_FULL[selectedMonth - 1]
                    } ${selectedYear}`}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredTransactions.map((tx, index) => (
                <button
                  key={tx.id}
                  onClick={() => setSelectedTransaction(tx)}
                  className="w-full flex items-center gap-3 px-4 py-4 hover:bg-gray-50 transition-colors text-left animate-fade-in"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <TransactionIcon type={tx.type} />

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 capitalize">
                      {tx.type === "received" ? "Received" : "Sent"}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {tx.type === "received" ? "From: " : "To: "}
                      {truncateAddress(
                        tx.type === "received"
                          ? tx.senderAddress
                          : tx.receiverAddress
                      )}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatTransactionDate(tx.timestamp)}
                    </p>
                  </div>

                  <div className="text-right">
                    <p
                      className={`font-semibold ${
                        tx.type === "received"
                          ? "text-green-600"
                          : "text-gray-900"
                      }`}
                    >
                      {tx.type === "received" ? "+" : "-"}
                      {formatAmount(tx.amount)}{" "}
                      <span className="text-sm font-normal text-gray-500">
                        {tx.ticker}
                      </span>
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bottom spacer */}
        <div className="h-8" />
      </div>

      {/* Month Picker Bottom Sheet */}
      <Sheet open={isMonthPickerOpen} onOpenChange={setIsMonthPickerOpen}>
        <SheetContent side="bottom" className="px-0 pb-8 pt-4" hideCloseButton>
          <SheetTitle className="sr-only">Choose Month</SheetTitle>
          <SheetDescription className="sr-only">
            Select a year and month to filter transactions
          </SheetDescription>

          {/* Header */}
          <div className="flex items-center justify-between px-5 mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Choose Month
            </h3>
            <button
              onClick={handleConfirmMonth}
              className="text-violet-600 font-semibold hover:text-violet-700 transition-colors"
            >
              Confirm
            </button>
          </div>

          {/* Picker */}
          <div className="flex">
            {/* Year Picker */}
            <div className="flex-1 overflow-auto max-h-64">
              {years.map((year) => (
                <button
                  key={year}
                  onClick={() => setTempYear(year)}
                  className={`w-full py-3 text-center transition-colors ${
                    tempYear === year
                      ? "text-gray-900 font-bold text-lg"
                      : "text-gray-400"
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>

            {/* Month Picker */}
            <div className="flex-1 overflow-auto max-h-64">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <button
                  key={month}
                  onClick={() => setTempMonth(month)}
                  className={`w-full py-3 text-center transition-colors ${
                    tempMonth === month
                      ? "text-gray-900 font-bold text-lg"
                      : "text-gray-400"
                  }`}
                >
                  {month}月
                </button>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Transaction Details Sheet */}
      <Sheet
        open={selectedTransaction !== null}
        onOpenChange={(open) => !open && setSelectedTransaction(null)}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-md px-5 pb-8 overflow-auto"
        >
          {selectedTransaction && (
            <>
              {/* Header */}
              <div className="flex items-center gap-3 mb-6">
                <button
                  onClick={() => setSelectedTransaction(null)}
                  className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="Go back"
                >
                  <ChevronLeft className="w-6 h-6 text-gray-800" />
                </button>
                <SheetTitle className="text-lg font-semibold text-gray-900">
                  Transaction Details
                </SheetTitle>
              </div>

              <SheetDescription className="sr-only">
                Details of the selected transaction
              </SheetDescription>

              {/* Transaction Icon and Status */}
              <div className="flex flex-col items-center mb-8">
                <div className="mb-4">
                  <TransactionIcon type={selectedTransaction.type} />
                </div>

                {/* Status Badge */}
                <div
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${
                    selectedTransaction.status === "completed"
                      ? "bg-violet-50 border-violet-200"
                      : selectedTransaction.status === "pending"
                      ? "bg-yellow-50 border-yellow-200"
                      : "bg-red-50 border-red-200"
                  }`}
                >
                  {selectedTransaction.status === "completed" && (
                    <Check className="w-4 h-4 text-violet-600" />
                  )}
                  <span
                    className={`text-sm font-medium capitalize ${
                      selectedTransaction.status === "completed"
                        ? "text-violet-600"
                        : selectedTransaction.status === "pending"
                        ? "text-yellow-600"
                        : "text-red-600"
                    }`}
                  >
                    {selectedTransaction.status}
                  </span>
                </div>

                {/* Amount */}
                <p className="text-4xl font-bold text-gray-900 mt-6">
                  {formatAmount(selectedTransaction.amount)}
                  <span className="text-lg font-normal text-gray-500 ml-2">
                    {selectedTransaction.ticker}
                  </span>
                </p>
              </div>

              {/* Details List */}
              <div className="space-y-0 divide-y divide-gray-100">
                {/* Sender/Receiver */}
                <div className="py-4">
                  <p className="text-sm text-gray-500 mb-1">
                    {selectedTransaction.type === "received"
                      ? "Sender"
                      : "Receiver"}
                  </p>
                  <p className="text-gray-900 font-medium">
                    {selectedTransaction.type === "received"
                      ? selectedTransaction.sender || "Unknown"
                      : selectedTransaction.receiver || "Unknown"}
                  </p>
                </div>

                {/* Address */}
                <div className="py-4">
                  <p className="text-sm text-gray-500 mb-1">
                    {selectedTransaction.type === "received"
                      ? "Sender Address"
                      : "Receiver Address"}
                  </p>
                  <p className="text-gray-900 font-mono text-sm break-all">
                    {selectedTransaction.type === "received"
                      ? selectedTransaction.senderAddress
                      : selectedTransaction.receiverAddress}
                  </p>
                </div>

                {/* Network */}
                <div className="py-4">
                  <p className="text-sm text-gray-500 mb-1">Network</p>
                  <p className="text-gray-900 font-medium">
                    {selectedTransaction.network}
                  </p>
                </div>

                {/* Network Fee */}
                <div className="py-4">
                  <p className="text-sm text-gray-500 mb-1">Network Fee</p>
                  <p className="text-gray-900 font-medium">
                    {selectedTransaction.fee.toFixed(6)} DOT
                  </p>
                </div>

                {/* Transaction ID */}
                <div className="py-4">
                  <p className="text-sm text-gray-500 mb-1">Transaction ID</p>
                  <p className="text-gray-900 font-mono text-sm break-all">
                    {selectedTransaction.id}
                  </p>
                </div>

                {/* Time */}
                <div className="py-4">
                  <p className="text-sm text-gray-500 mb-1">Time</p>
                  <p className="text-gray-900 font-medium">
                    {formatTransactionDate(selectedTransaction.timestamp)}
                  </p>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
