"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { getEcosystemProjects } from "@/app/db/supabase";
import { fetchProtocolsTvl } from "@/app/utils/defillama";
import type { EcosystemProject, ProjectWithStats } from "@/app/types/frontend_type";
import type { ChainId } from "@/app/chains/types";

interface UseEcosystemProjectsOptions {
  autoFetch?: boolean;
}

interface UseEcosystemProjectsReturn {
  projects: ProjectWithStats[];
  isLoading: boolean;
  error: string | null;
  selectedChain: ChainId | "all";
  setSelectedChain: (chain: ChainId | "all") => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  filteredProjects: ProjectWithStats[];
  featuredProjects: ProjectWithStats[];
  refetch: () => Promise<void>;
}

export const PROJECT_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "dex", label: "DeFi" },
  { id: "lending", label: "Lending" },
  { id: "nft", label: "NFT" },
  { id: "bridge", label: "Bridge" },
  { id: "staking", label: "Staking" },
  { id: "infra", label: "Infra" },
  { id: "gaming", label: "Gaming" },
] as const;

/**
 * Hook for fetching and managing ecosystem projects (multi-chain Explore).
 * Fetches curated projects from Supabase and enriches them with live TVL
 * data from DeFiLlama.
 */
export function useEcosystemProjects(
  options: UseEcosystemProjectsOptions = {}
): UseEcosystemProjectsReturn {
  const { autoFetch = true } = options;

  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChain, setSelectedChain] = useState<ChainId | "all">("all");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const dbProjects: EcosystemProject[] = await getEcosystemProjects();
      const projectsWithStats: ProjectWithStats[] = dbProjects.map((p) => ({ ...p }));
      setProjects(projectsWithStats);
      setIsLoading(false);
      const slugs = dbProjects.map((p) => p.defillamaSlug).filter((s): s is string => !!s);
      if (slugs.length > 0) {
        try {
          const tvlMap = await fetchProtocolsTvl(slugs);
          const enriched = projectsWithStats.map((p) => {
            if (p.defillamaSlug) {
              const tvlInfo = tvlMap.get(p.defillamaSlug);
              if (tvlInfo) {
                return { ...p, tvl: tvlInfo.tvl, tvlChange24h: tvlInfo.change_1d ?? undefined };
              }
            }
            return p;
          });
          setProjects(enriched);
        } catch (tvlError) {
          console.error("Failed to fetch TVL data:", tvlError);
        }
      }
    } catch (err) {
      console.error("Failed to fetch ecosystem projects:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch projects");
      setProjects([]);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!autoFetch) return;
    let cancelled = false;
    (async () => {
      try {
        const dbProjects: EcosystemProject[] = await getEcosystemProjects();
        if (cancelled) return;

        const projectsWithStats: ProjectWithStats[] = dbProjects.map((p) => ({ ...p }));
        setProjects(projectsWithStats);
        setIsLoading(false);

        const slugs = dbProjects.map((p) => p.defillamaSlug).filter((s): s is string => !!s);

        if (slugs.length > 0) {
          try {
            const tvlMap = await fetchProtocolsTvl(slugs);
            if (cancelled) return;
            const enriched = projectsWithStats.map((p) => {
              if (p.defillamaSlug) {
                const tvlInfo = tvlMap.get(p.defillamaSlug);
                if (tvlInfo) {
                  return {
                    ...p,
                    tvl: tvlInfo.tvl,
                    tvlChange24h: tvlInfo.change_1d ?? undefined,
                  };
                }
              }
              return p;
            });
            setProjects(enriched);
          } catch (tvlError) {
            console.error("Failed to fetch TVL data:", tvlError);
          }
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to fetch ecosystem projects:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch projects");
        setProjects([]);
        setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [autoFetch]);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const chainMatch = selectedChain === "all" || p.chainId === selectedChain;
      const categoryMatch = selectedCategory === "all" || p.category === selectedCategory;
      return chainMatch && categoryMatch;
    });
  }, [projects, selectedChain, selectedCategory]);

  const featuredProjects = useMemo(() => {
    return projects.filter((p) => {
      const chainMatch = selectedChain === "all" || p.chainId === selectedChain;
      return p.featured && chainMatch;
    });
  }, [projects, selectedChain]);

  return {
    projects,
    isLoading,
    error,
    selectedChain,
    setSelectedChain,
    selectedCategory,
    setSelectedCategory,
    filteredProjects,
    featuredProjects,
    refetch: fetchProjects,
  };
}
