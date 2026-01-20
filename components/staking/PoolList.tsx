"use client";

import { Users, Percent, ChevronRight } from "lucide-react";
import { formatCommission, formatMemberCount, formatPoolBond } from "@/lib/format";
import { planckToDot } from "@/app/utils/staking";
import type { NominationPoolInfo } from "@/app/types/frontend_type";

interface PoolListProps {
  pools: NominationPoolInfo[];
  onPoolSelect: (pool: NominationPoolInfo) => void;
  isLoading?: boolean;
}

export function PoolList({ pools, onPoolSelect, isLoading }: PoolListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (pools.length === 0) {
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
    <div className="divide-y divide-gray-100">
      {pools.map((pool, index) => (
        <PoolRow
          key={pool.id}
          pool={pool}
          index={index}
          onSelect={() => onPoolSelect(pool)}
        />
      ))}
    </div>
  );
}

interface PoolRowProps {
  pool: NominationPoolInfo;
  index: number;
  onSelect: () => void;
}

function PoolRow({ pool, index, onSelect }: PoolRowProps) {
  const bondInDot = planckToDot(pool.bond);

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
              {formatMemberCount(pool.memberCount)}
            </span>
            <span className="flex items-center gap-1">
              <Percent className="w-3 h-3" />
              {formatCommission(pool.commission)}
            </span>
          </div>
        </div>
      </div>

      {/* Bond Amount & Arrow */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="text-right">
          <p className="font-semibold text-black text-sm">
            {formatPoolBond(bondInDot)}
          </p>
          <p className="text-xs text-muted-foreground">Total Staked</p>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400" />
      </div>
    </button>
  );
}
