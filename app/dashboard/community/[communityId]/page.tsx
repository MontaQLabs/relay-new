"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Search, Bell, Plus, MessageCircle, Heart, Check } from "lucide-react";
import { getCommunity, getCommunityActivities, getUserNicknames } from "@/app/db/supabase";
import { getWalletAddress } from "@/app/utils/wallet";
import type { Community, Activity } from "@/app/types/frontend_type";
import { PageHeader } from "@/components/layout/PageHeader";
import { SlideInPage } from "@/components/layout/SlideInPage";
import { TabButton, TabGroup } from "@/components/ui/tab-button";
import { useSlideNavigation } from "@/hooks";
import { formatTime } from "@/lib/format";
import { getRandomAvatar } from "@/lib/avatar";
import CreateActivitySlideIn from "./CreateActivitySlideIn";
import ActivityDetailSlideIn from "./ActivityDetailSlideIn";

type MainTabType = "Activities" | "Joined";
type SubTabType = "View" | "Post";

export default function CommunityDetailPage() {
  const params = useParams();
  const communityId = params.communityId as string;
  const { isExiting, handleBack } = useSlideNavigation();

  const [isLoading, setIsLoading] = useState(true);
  const [community, setCommunity] = useState<Community | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [mainTab, setMainTab] = useState<MainTabType>("Activities");
  const [subTab, setSubTab] = useState<SubTabType>("View");
  const [isCreateActivityOpen, setIsCreateActivityOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [isActivityDetailOpen, setIsActivityDetailOpen] = useState(false);
  const [ownerNicknames, setOwnerNicknames] = useState<Record<string, string>>({});

  const walletAddress = getWalletAddress();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [communityData, activitiesData] = await Promise.all([
        getCommunity(communityId),
        getCommunityActivities(communityId),
      ]);
      setCommunity(communityData);
      setActivities(activitiesData);

      if (activitiesData.length > 0) {
        const ownerAddresses = activitiesData.map((a) => a.owner);
        const nicknames = await getUserNicknames(ownerAddresses);
        setOwnerNicknames(nicknames);
      }
    } catch (error) {
      console.error("Failed to fetch community data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [communityId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateActivity = () => setIsCreateActivityOpen(true);
  const handleActivityCreated = () => fetchData();

  const handleActivityClick = (activity: Activity) => {
    setSelectedActivity(activity);
    setIsActivityDetailOpen(true);
  };

  const handleActivityDetailClose = () => {
    setIsActivityDetailOpen(false);
    setSelectedActivity(null);
  };

  const handleActivityUpdated = () => fetchData();

  const filteredActivities = activities.filter((activity) => {
    if (mainTab === "Joined") {
      if (!walletAddress || !activity.attendees.includes(walletAddress)) {
        return false;
      }
    }

    if (subTab === "Post") {
      if (!walletAddress || activity.owner !== walletAddress) {
        return false;
      }
    }

    return true;
  });

  const displayId = community?.communityId?.replace(/^comm_/, "").slice(0, 7) || "";

  if (isLoading) {
    return (
      <SlideInPage isExiting={isExiting}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
        </div>
      </SlideInPage>
    );
  }

  if (!community) {
    return (
      <SlideInPage isExiting={isExiting}>
        <PageHeader title="" onBack={handleBack} />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Community not found</p>
        </div>
      </SlideInPage>
    );
  }

  return (
    <SlideInPage isExiting={isExiting}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-4 bg-[#f8f5ff]">
        <button
          onClick={handleBack}
          className="p-2 -ml-2 hover:bg-white/50 rounded-full transition-colors"
          aria-label="Go back"
        >
          <svg className="w-6 h-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-white/50 rounded-full transition-colors">
            <Search className="w-5 h-5 text-black" />
          </button>
          <button className="p-2 hover:bg-white/50 rounded-full transition-colors relative">
            <Bell className="w-5 h-5 text-black" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          </button>
        </div>
      </header>

      {/* Community Info Banner */}
      <div className="bg-[#f8f5ff] px-5 pb-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 bg-gray-200">
            {community.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={community.avatar} alt={community.name} className="w-full h-full object-cover" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={getRandomAvatar(community.communityId)} alt={community.name} className="w-full h-full object-cover" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-black truncate">{community.name}</h1>
            <p className="text-sm text-muted-foreground">ID: {displayId}</p>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-6">
          <TabButton
            label="Activities"
            isActive={mainTab === "Activities"}
            onClick={() => setMainTab("Activities")}
            activeColor="black"
          />
          <TabButton
            label="Joined"
            isActive={mainTab === "Joined"}
            onClick={() => setMainTab("Joined")}
            activeColor="black"
          />
        </div>

        <TabGroup
          tabs={["View", "Post"]}
          activeTab={subTab}
          onTabChange={(tab) => setSubTab(tab as SubTabType)}
          variant="pill"
        />
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto px-5 pb-24">
        {filteredActivities.length === 0 ? (
          <EmptyActivityState mainTab={mainTab} subTab={subTab} />
        ) : (
          <div className="space-y-6">
            {filteredActivities.map((activity) => (
              <ActivityCard
                key={activity.activityId}
                activity={activity}
                walletAddress={walletAddress}
                ownerNickname={ownerNicknames[activity.owner]}
                onClick={() => handleActivityClick(activity)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <button
        onClick={handleCreateActivity}
        className="fixed bottom-24 right-5 w-14 h-14 bg-violet-500 hover:bg-violet-600 text-white rounded-full shadow-lg flex items-center justify-center transition-colors z-10"
        aria-label="Create activity"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Create Activity Slide-in */}
      {community && (
        <CreateActivitySlideIn
          isOpen={isCreateActivityOpen}
          onClose={() => setIsCreateActivityOpen(false)}
          community={community}
          onActivityCreated={handleActivityCreated}
        />
      )}

      {/* Activity Detail Slide-in */}
      {selectedActivity && (
        <ActivityDetailSlideIn
          isOpen={isActivityDetailOpen}
          onClose={handleActivityDetailClose}
          activity={selectedActivity}
          onActivityUpdated={handleActivityUpdated}
          ownerNickname={ownerNicknames[selectedActivity.owner]}
        />
      )}
    </SlideInPage>
  );
}

// Empty State Component
function EmptyActivityState({ mainTab, subTab }: { mainTab: MainTabType; subTab: SubTabType }) {
  let title = "No activities yet";
  let description = "Be the first to create an activity in this community!";

  if (mainTab === "Joined") {
    if (subTab === "Post") {
      title = "No activities posted";
      description = "You haven't posted any activities that you've joined yet.";
    } else {
      title = "No joined activities";
      description = "You haven't joined any activities in this community yet.";
    }
  } else {
    if (subTab === "Post") {
      title = "No activities posted";
      description = "You haven't posted any activities in this community yet.";
    }
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="relative mb-8">
        <EmptyBoxIllustration />
      </div>
      <h3 className="text-lg font-semibold text-black mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-[280px]">{description}</p>
    </div>
  );
}

// Activity Card Component
function ActivityCard({
  activity,
  walletAddress,
  ownerNickname,
  onClick,
}: {
  activity: Activity;
  walletAddress: string | null;
  ownerNickname?: string;
  onClick: () => void;
}) {
  const isAttending = walletAddress && activity.attendees.includes(walletAddress);
  const isFinished = activity.status === "finished";

  const getStatusDisplay = () => {
    if (isFinished && isAttending) return { label: "Attended", color: "text-violet-500 border-violet-500" };
    if (isAttending) return { label: "Attending", color: "text-green-500 border-green-500" };
    if (activity.status === "full") return { label: "Full", color: "text-red-500 border-red-500" };
    return { label: "Open", color: "text-gray-500 border-gray-500" };
  };

  const status = getStatusDisplay();

  return (
    <button
      onClick={onClick}
      className="bg-white w-full text-left cursor-pointer hover:bg-gray-50 transition-colors rounded-xl p-3 -mx-3"
    >
      {/* Activity Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={getRandomAvatar(activity.owner)} alt="User avatar" className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="font-semibold text-black text-sm">
              {ownerNickname || `${activity.owner.slice(0, 6)}...${activity.owner.slice(-4)}`}
            </p>
            <p className="text-xs text-muted-foreground">Posted at {formatTime(activity.timestamp)}</p>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full border flex items-center gap-1 ${status.color}`}>
          {isAttending && <Check className="w-3 h-3" />}
          <span className="text-xs font-medium">{status.label}</span>
        </div>
      </div>

      {/* Activity Title */}
      <h3 className="font-bold text-black mb-2">{activity.title}</h3>

      {/* Activity Description */}
      {activity.description && (
        <div className="mb-3">
          <p className="text-sm text-black font-medium">Rules:</p>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{activity.description}</p>
        </div>
      )}

      {/* Activity Images */}
      {activity.pictures && activity.pictures.length > 0 && (
        <div className="grid grid-cols-3 gap-1 rounded-xl overflow-hidden mb-3">
          {activity.pictures.slice(0, 6).map((picture, index) => (
            <div key={index} className="aspect-square bg-gray-200 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={picture} alt={`Activity image ${index + 1}`} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}

      {/* Activity Stats */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <div className="flex items-center gap-1 text-muted-foreground">
          <MessageCircle className="w-4 h-4" />
          <span className="text-sm">{activity.comments.length}</span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <Heart className="w-4 h-4" />
          <span className="text-sm">{activity.likes}</span>
        </div>
      </div>
    </button>
  );
}

// Empty Box Illustration
function EmptyBoxIllustration() {
  return (
    <svg width="160" height="120" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="100" cy="145" rx="60" ry="8" fill="#F3F4F6" />
      <path d="M40 80 L100 110 L160 80 L160 130 L100 150 L40 130 Z" fill="white" stroke="#1a1a1a" strokeWidth="1.5" />
      <path d="M40 80 L40 60 L70 40 L100 60 L100 80 L70 100 Z" fill="white" stroke="#1a1a1a" strokeWidth="1.5" />
      <path d="M160 80 L160 60 L130 40 L100 60 L100 80 L130 100 Z" fill="white" stroke="#1a1a1a" strokeWidth="1.5" />
      <path d="M50 85 L100 110 L150 85" stroke="#E5E7EB" strokeWidth="1" />
      <path d="M55 75 L100 95 L145 75 L145 85 L100 105 L55 85 Z" fill="#1a1a1a" />
      <path d="M115 50 Q 130 30 140 35 Q 155 42 150 25" stroke="#9CA3AF" strokeWidth="1.5" strokeDasharray="4 3" fill="none" />
      <circle cx="152" cy="22" r="4" fill="#8B5CF6" />
      <ellipse cx="152" cy="22" rx="2" ry="3" fill="#A78BFA" />
    </svg>
  );
}
