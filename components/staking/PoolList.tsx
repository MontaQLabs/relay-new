"use client";

import { Users, ChevronRight, ChevronLeft } from "lucide-react";
import { formatMemberCount } from "@/lib/format";
import type { PoolSummary } from "@/app/types/frontend_type";

interface PoolListProps {
  pools: PoolSummary[];
  onPoolSelect: (poolId: number) => void;
  isLoading?: boolean;
  // Pagination props
  currentPage?: number;
  totalPages?: number;
  totalPools?: number;
  onNextPage?: () => void;
  onPreviousPage?: () => void;
  onGoToPage?: (page: number) => void;
}

export function PoolList({
  pools,
  onPoolSelect,
  isLoading,
  currentPage = 1,
  totalPages = 1,
  totalPools = 0,
  onNextPage,
  onPreviousPage,
  // onGoToPage is available for page number buttons if needed in the future
}: PoolListProps) {
  const hasPagination = totalPages > 1;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (pools.length === 0 && totalPools === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-5">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <Users className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-base font-semibold text-black mb-1">No pools available</h3>
        <p className="text-sm text-muted-foreground max-w-[240px]">
          There are no open nomination pools at the moment. Please check back later.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Pool list */}
      <div className="divide-y divide-gray-100">
        {pools.map((pool, index) => (
          <PoolRow
            key={pool.id}
            pool={pool}
            index={index}
            onSelect={() => onPoolSelect(pool.id)}
          />
        ))}
      </div>

      {/* Pagination controls */}
      {hasPagination && (
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 bg-gray-50">
          {/* Previous button */}
          <button
            onClick={onPreviousPage}
            disabled={currentPage <= 1}
            className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>

          {/* Page indicator */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
            <span className="text-xs text-gray-400">
              ({totalPools} pools)
            </span>
          </div>

          {/* Next button */}
          <button
            onClick={onNextPage}
            disabled={currentPage >= totalPages}
            className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

interface PoolRowProps {
  pool: PoolSummary;
  index: number;
  onSelect: () => void;
}

function PoolRow({ pool, index, onSelect }: PoolRowProps) {
  return (
    <button
      onClick={onSelect}
      className="flex items-center justify-between w-full px-5 py-4 hover:bg-gray-50 transition-colors text-left animate-slide-up"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Pool Icon */}
        <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
          <span className="text-violet-600 font-bold text-sm">
            #{pool.id}
          </span>
        </div>

        {/* Pool Info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-black truncate">{pool.name}</p>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {formatMemberCount(pool.memberCount)} members
            </span>
          </div>
        </div>
      </div>

      {/* Arrow - details loaded on click */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-muted-foreground">Tap for details</span>
        <ChevronRight className="w-5 h-5 text-gray-400" />
      </div>
    </button>
  );
}
