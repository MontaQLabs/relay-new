"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, Heart, MessageCircle, X, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getActivityComments,
  joinActivity,
  leaveActivity,
  createComment,
  likeActivity,
  subscribeToComments,
  unsubscribe,
  restoreSupabaseAuth,
  setSupabaseAuth,
} from "@/app/db/supabase";
import { getWalletAddress } from "@/app/utils/wallet";
import { getAuthToken } from "@/app/utils/auth";
import type { Activity, Comment } from "@/app/types/frontend_type";

// Generate a random avatar URL using DiceBear
const getRandomAvatar = (seed: string): string => {
  return `https://api.dicebear.com/7.x/shapes/svg?seed=${seed}`;
};

// Format timestamp to display date
const formatDate = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

// Format activity date for display in status badge
const formatActivityDate = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
  });
};

interface ActivityDetailSlideInProps {
  isOpen: boolean;
  onClose: () => void;
  activity: Activity;
  onActivityUpdated: () => void;
}

type CommentTabType = "comments" | "my_posts";

export default function ActivityDetailSlideIn({
  isOpen,
  onClose,
  activity,
  onActivityUpdated,
}: ActivityDetailSlideInProps) {
  const [isExiting, setIsExiting] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const [isAttending, setIsAttending] = useState(false);
  const [isProcessingAttend, setIsProcessingAttend] = useState(false);
  const [likes, setLikes] = useState(activity.likes);
  const [activeTab, setActiveTab] = useState<CommentTabType>("comments");
  const [isCommentSheetOpen, setIsCommentSheetOpen] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  
  const walletAddress = getWalletAddress();
  const subscriptionRef = useRef<ReturnType<typeof subscribeToComments> | null>(null);

  // Check if user is attending (excluding owner)
  useEffect(() => {
    if (walletAddress) {
      const attending = activity.attendees.includes(walletAddress) && activity.owner !== walletAddress;
      setIsAttending(attending);
    }
  }, [walletAddress, activity.attendees, activity.owner]);

  // Fetch comments
  const fetchComments = useCallback(async () => {
    setIsLoadingComments(true);
    try {
      const fetchedComments = await getActivityComments(activity.activityId);
      setComments(fetchedComments);
    } catch (error) {
      console.error("Failed to fetch comments:", error);
    } finally {
      setIsLoadingComments(false);
    }
  }, [activity.activityId]);

  useEffect(() => {
    if (isOpen) {
      fetchComments();
      
      // Subscribe to new comments
      subscriptionRef.current = subscribeToComments(activity.activityId, (newComment) => {
        setComments((prev) => [...prev, newComment]);
      });
    }

    return () => {
      if (subscriptionRef.current) {
        unsubscribe(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [isOpen, activity.activityId, fetchComments]);

  // Reset exit state when opening
  useEffect(() => {
    if (isOpen) {
      setIsExiting(false);
    }
  }, [isOpen]);

  const handleBack = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const ensureAuth = async () => {
    const authToken = getAuthToken();
    if (authToken) {
      await setSupabaseAuth(authToken);
    } else {
      restoreSupabaseAuth();
    }
  };

  const handleAttend = async () => {
    if (!walletAddress || isProcessingAttend) return;

    await ensureAuth();
    setIsProcessingAttend(true);

    try {
      if (isAttending) {
        // Leave activity
        const success = await leaveActivity(activity.activityId, walletAddress);
        if (success) {
          setIsAttending(false);
          onActivityUpdated();
        }
      } else {
        // Join activity
        const success = await joinActivity(activity.activityId, walletAddress);
        if (success) {
          setIsAttending(true);
          onActivityUpdated();
        }
      }
    } catch (error) {
      console.error("Failed to update attendance:", error);
    } finally {
      setIsProcessingAttend(false);
    }
  };

  const handleLike = async () => {
    try {
      await ensureAuth();
      const success = await likeActivity(activity.activityId);
      if (success) {
        setLikes((prev) => prev + 1);
      }
    } catch (error) {
      console.error("Failed to like activity:", error);
    }
  };

  const handleSubmitComment = async () => {
    if (!walletAddress || !commentInput.trim() || isSubmittingComment) return;

    await ensureAuth();
    setIsSubmittingComment(true);

    try {
      const commentId = await createComment(walletAddress, activity.activityId, commentInput.trim());
      if (commentId) {
        setCommentInput("");
        setIsCommentSheetOpen(false);
        // The real-time subscription will add the comment
      }
    } catch (error) {
      console.error("Failed to submit comment:", error);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Calculate attendees count excluding host
  const attendeesCount = activity.attendees.filter((addr) => addr !== activity.owner).length;

  // Filter comments based on active tab
  const filteredComments = activeTab === "my_posts" && walletAddress
    ? comments.filter((c) => c.publisher === walletAddress)
    : comments;

  if (!isOpen && !isExiting) return null;

  return (
    <div
      className={`fixed inset-0 z-[60] bg-white flex flex-col ${
        isExiting ? "animate-slide-out-right" : "animate-slide-in-right"
      }`}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
        <button
          onClick={handleBack}
          className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="Go back"
        >
          <ChevronLeft className="w-6 h-6 text-black" />
        </button>
        <h1 className="text-lg font-semibold text-black">Activity Name</h1>
        <div className="w-10" /> {/* Spacer for centering */}
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto pb-24">
        {/* Activity Owner Info */}
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getRandomAvatar(activity.owner)}
                alt="Owner avatar"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="font-semibold text-black text-sm">Username</p>
              <p className="text-xs text-muted-foreground">
                Posted at {formatDate(activity.timestamp)}
              </p>
            </div>
          </div>
          
          {/* Status Badge */}
          <div className="flex items-center gap-1 px-3 py-1 rounded-full border border-green-500 text-green-500">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs font-medium">
              Open {attendeesCount}/{activity.maxAttendees}
            </span>
          </div>
        </div>

        {/* Activity Title */}
        <div className="px-5 pb-3">
          <h2 className="text-xl font-bold text-black">{activity.title}</h2>
        </div>

        {/* Activity Description/Rules */}
        {activity.description && (
          <div className="px-5 pb-4">
            <p className="text-sm text-black font-medium mb-1">Rules:</p>
            <p className="text-sm text-muted-foreground whitespace-pre-line">
              {activity.description}
            </p>
          </div>
        )}

        {/* Activity Images */}
        {activity.pictures && activity.pictures.length > 0 && (
          <div className="px-5 pb-4 space-y-2">
            {activity.pictures.map((picture, index) => (
              <div
                key={index}
                className="w-full aspect-[4/3] bg-gray-200 rounded-xl overflow-hidden"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={picture}
                  alt={`Activity image ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        )}

        {/* Comments Section */}
        <div className="px-5 pt-4 border-t border-gray-100">
          {/* Tabs */}
          <div className="flex items-center gap-6 mb-4">
            <button
              onClick={() => setActiveTab("comments")}
              className={`relative pb-2 font-semibold transition-colors ${
                activeTab === "comments" ? "text-black" : "text-muted-foreground"
              }`}
            >
              Comments
              {activeTab === "comments" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black rounded-full" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("my_posts")}
              className={`relative pb-2 font-semibold transition-colors ${
                activeTab === "my_posts" ? "text-black" : "text-muted-foreground"
              }`}
            >
              My Posts
              {activeTab === "my_posts" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black rounded-full" />
              )}
            </button>
          </div>

          {/* Comments List */}
          {isLoadingComments ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
          ) : filteredComments.length === 0 ? (
            <EmptyCommentsState />
          ) : (
            <div className="space-y-4">
              {filteredComments.map((comment) => (
                <CommentItem key={comment.commentId} comment={comment} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 py-4 z-10">
        <div className="flex items-center gap-4">
          {/* Comment Input Trigger */}
          <button
            onClick={() => setIsCommentSheetOpen(true)}
            className="flex-1 h-10 px-4 bg-gray-100 rounded-full text-left text-sm text-muted-foreground"
          >
            Comment...
          </button>

          {/* Like Button */}
          <button
            onClick={handleLike}
            className="flex items-center gap-1 text-muted-foreground hover:text-red-500 transition-colors"
          >
            <Heart className="w-5 h-5" />
            <span className="text-sm">{likes}</span>
          </button>

          {/* Comment Count */}
          <div className="flex items-center gap-1 text-muted-foreground">
            <MessageCircle className="w-5 h-5" />
            <span className="text-sm">{comments.length}</span>
          </div>

          {/* Attend/Cancel Button */}
          <Button
            onClick={handleAttend}
            disabled={isProcessingAttend || activity.owner === walletAddress}
            className={`h-10 px-6 rounded-full font-semibold text-sm transition-all ${
              isAttending
                ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                : "bg-violet-500 text-white hover:bg-violet-600"
            }`}
          >
            {isProcessingAttend ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isAttending ? (
              "Cancel"
            ) : (
              "Attend"
            )}
          </Button>
        </div>
      </div>

      {/* Comment Input Bottom Sheet */}
      <Sheet open={isCommentSheetOpen} onOpenChange={setIsCommentSheetOpen}>
        <SheetContent side="bottom" hideCloseButton className="px-5 pb-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <SheetTitle className="text-lg font-semibold text-black">
              Add Comment
            </SheetTitle>
            <button
              onClick={() => setIsCommentSheetOpen(false)}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Comment Input */}
          <div className="flex items-center gap-3">
            <Input
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              placeholder="Write your comment..."
              className="flex-1 h-12 rounded-xl border-gray-200"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmitComment();
                }
              }}
            />
            <Button
              onClick={handleSubmitComment}
              disabled={!commentInput.trim() || isSubmittingComment}
              className="h-12 px-6 rounded-xl bg-violet-500 hover:bg-violet-600 text-white font-semibold"
            >
              {isSubmittingComment ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Send"
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Comment Item Component
function CommentItem({ comment }: { comment: Comment }) {
  return (
    <div className="flex gap-3">
      <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getRandomAvatar(comment.publisher)}
          alt="Commenter avatar"
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-1">
        <p className="font-semibold text-black text-sm">Username</p>
        <p className="text-sm text-gray-700">{comment.content}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatDate(comment.timestamp)}
        </p>
      </div>
    </div>
  );
}

// Empty Comments State
function EmptyCommentsState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <MessageCircle className="w-8 h-8 text-gray-300" />
      </div>
      <h3 className="text-base font-semibold text-black mb-1">No comments yet</h3>
      <p className="text-sm text-muted-foreground">
        Be the first to share your thoughts!
      </p>
    </div>
  );
}
