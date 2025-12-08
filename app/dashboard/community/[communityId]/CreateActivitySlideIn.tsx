"use client";

import { useState, useRef } from "react";
import { ChevronLeft, ChevronRight, X, Plus, Minus, Loader2, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { createActivity, restoreSupabaseAuth } from "@/app/db/supabase";
import { getSupabaseClient } from "@/app/db/supabase";
import { getWalletAddress } from "@/app/utils/wallet";
import { getAuthToken } from "@/app/utils/auth";
import { setSupabaseAuth } from "@/app/db/supabase";
import type { Community } from "@/app/types/frontend_type";

const MAX_DESCRIPTION_LENGTH = 144;

interface CreateActivitySlideInProps {
  isOpen: boolean;
  onClose: () => void;
  community: Community;
  onActivityCreated: () => void;
}

type ImageUploadState = "idle" | "loading" | "success" | "error";

interface UploadedImage {
  url: string;
  state: ImageUploadState;
}

export default function CreateActivitySlideIn({
  isOpen,
  onClose,
  community,
  onActivityCreated,
}: CreateActivitySlideInProps) {
  const [isExiting, setIsExiting] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPaidTicket, setIsPaidTicket] = useState(false);
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);
  const [selectedType, setSelectedType] = useState<string>("");
  const [maxAttendees, setMaxAttendees] = useState(0);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal states
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [isTypePickerOpen, setIsTypePickerOpen] = useState(false);

  // Temp time picker values
  const [tempDate, setTempDate] = useState("");
  const [tempTime, setTempTime] = useState("");

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBack = () => {
    setIsExiting(true);
    setTimeout(() => {
      resetForm();
      onClose();
    }, 300);
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setIsPaidTicket(false);
    setSelectedTime(null);
    setSelectedType("");
    setMaxAttendees(0);
    setImages([]);
    setIsExiting(false);
    setTempDate("");
    setTempTime("");
  };

  const handleDescriptionChange = (value: string) => {
    if (value.length <= MAX_DESCRIPTION_LENGTH) {
      setDescription(value);
    }
  };

  const handleTimeClick = () => {
    // Initialize with current selection if exists
    if (selectedTime) {
      setTempDate(selectedTime.toISOString().split("T")[0]);
      setTempTime(
        selectedTime.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    } else {
      // Default to today and current time
      const now = new Date();
      setTempDate(now.toISOString().split("T")[0]);
      setTempTime(
        now.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    }
    setIsTimePickerOpen(true);
  };

  const handleConfirmTime = () => {
    if (tempDate && tempTime) {
      const dateTime = new Date(`${tempDate}T${tempTime}`);
      setSelectedTime(dateTime);
    }
    setIsTimePickerOpen(false);
  };

  const handleTypeClick = () => {
    setIsTypePickerOpen(true);
  };

  const handleSelectType = (type: string) => {
    setSelectedType(type);
  };

  const handleConfirmType = () => {
    setIsTypePickerOpen(false);
  };

  const incrementAttendees = () => {
    setMaxAttendees((prev) => prev + 1);
  };

  const decrementAttendees = () => {
    setMaxAttendees((prev) => Math.max(0, prev - 1));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Add new image with loading state
    const tempId = Date.now().toString();
    setImages((prev) => [...prev, { url: tempId, state: "loading" }]);

    try {
      // Upload to Supabase Storage
      const supabase = getSupabaseClient();
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("activity-images")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("activity-images")
        .getPublicUrl(filePath);

      // Update image state to success
      setImages((prev) =>
        prev.map((img) =>
          img.url === tempId ? { url: urlData.publicUrl, state: "success" } : img
        )
      );
    } catch (error) {
      console.error("Failed to upload image:", error);
      // Update image state to error
      setImages((prev) =>
        prev.map((img) =>
          img.url === tempId ? { ...img, state: "error" } : img
        )
      );
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const formatSelectedTime = () => {
    if (!selectedTime) return null;
    return selectedTime.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isFormValid = () => {
    const hasName = name.trim().length > 0;
    const hasTime = selectedTime !== null;
    const hasType = selectedType.trim().length > 0;
    const hasAttendees = maxAttendees > 0;
    // Check all images are successfully uploaded
    const allImagesUploaded = images.every((img) => img.state === "success");
    
    return hasName && hasTime && hasType && hasAttendees && allImagesUploaded;
  };

  const handlePublish = async () => {
    if (!isFormValid()) return;

    const walletAddress = getWalletAddress();
    if (!walletAddress) {
      console.error("No wallet address found");
      return;
    }

    // Ensure auth session is restored
    const authToken = getAuthToken();
    if (authToken) {
      await setSupabaseAuth(authToken);
    } else {
      // Try restoring from localStorage
      restoreSupabaseAuth();
    }

    setIsSubmitting(true);

    try {
      const activityData = {
        communityId: community.communityId,
        title: name,
        description,
        isPaid: isPaidTicket,
        timestamp: selectedTime!.toISOString(),
        type: selectedType,
        maxAttendees,
        pictures: images
          .filter((img) => img.state === "success")
          .map((img) => img.url),
        status: "open" as const,
      };

      const activityId = await createActivity(walletAddress, activityData);

      if (activityId) {
        // Success - close and trigger refetch
        setIsExiting(true);
        setTimeout(() => {
          resetForm();
          onActivityCreated();
          onClose();
        }, 300);
      } else {
        console.error("Failed to create activity");
      }
    } catch (error) {
      console.error("Failed to publish activity:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen && !isExiting) return null;

  return (
    <div
      className={`fixed inset-0 z-[60] bg-white flex flex-col ${
        isExiting ? "animate-slide-out-right" : "animate-slide-in-right"
      }`}
    >
      {/* Header */}
      <header className="flex items-center px-4 py-4">
        <button
          onClick={handleBack}
          className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="Go back"
        >
          <ChevronLeft className="w-6 h-6 text-black" />
        </button>
      </header>

      {/* Title */}
      <div className="px-5 pb-6">
        <h1 className="text-2xl font-bold text-black">Create Activity</h1>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-auto">
        {/* Name Field */}
        <div className="px-5 py-4 border-t border-gray-100">
          <label className="text-sm font-medium text-black block mb-2">
            Name
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Please enter the name of your activity"
            className="border-none shadow-none bg-transparent p-0 h-auto text-base text-gray-400 placeholder:text-gray-400 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        {/* Description Field */}
        <div className="px-5 py-4 border-t border-gray-100">
          <label className="text-sm font-medium text-black block mb-2">
            Description
          </label>
          <Textarea
            value={description}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            placeholder="Please enter the detailed description of your activity"
            className="border-none shadow-none bg-transparent p-0 min-h-[60px] resize-none text-base text-gray-400 placeholder:text-gray-400 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <div className="text-right mt-2">
            <span className="text-sm text-muted-foreground">
              {description.length}/{MAX_DESCRIPTION_LENGTH}
            </span>
          </div>
        </div>

        {/* Paid Ticket Toggle */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
          <span className="text-sm font-medium text-black">Paid ticket coming soon...</span>
          <Switch
            checked={isPaidTicket}
            onCheckedChange={setIsPaidTicket}
            disabled
          />
        </div>

        {/* Time Field */}
        <button
          onClick={handleTimeClick}
          className="flex items-center justify-between px-5 py-4 border-t border-gray-100 hover:bg-gray-50 transition-colors text-left"
        >
          <div className="flex-1">
            <label className="text-sm font-medium text-black block mb-1 pointer-events-none">
              Time
            </label>
            <span className={`text-base ${selectedTime ? "text-black" : "text-gray-400"}`}>
              {formatSelectedTime() || "Select the time of your activity"}
            </span>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 ml-2" />
        </button>

        {/* Type Field */}
        <button
          onClick={handleTypeClick}
          className="flex items-center justify-between px-5 py-4 border-t border-gray-100 hover:bg-gray-50 transition-colors text-left"
        >
          <div className="flex-1">
            <label className="text-sm font-medium text-black block mb-1 pointer-events-none">
              Type
            </label>
            <span className={`text-base ${selectedType ? "text-black" : "text-gray-400"}`}>
              {selectedType || "Choose your activity type"}
            </span>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 ml-2" />
        </button>

        {/* Max Attendees Field */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
          <span className="text-sm font-medium text-black">Max attendees</span>
          <div className="flex items-center gap-2">
            <button
              onClick={decrementAttendees}
              className="w-10 h-10 flex items-center justify-center border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              aria-label="Decrease attendees"
            >
              <Minus className="w-4 h-4 text-gray-600" />
            </button>
            <span className="w-10 text-center text-base font-medium text-black">
              {maxAttendees}
            </span>
            <button
              onClick={incrementAttendees}
              className="w-10 h-10 flex items-center justify-center border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              aria-label="Increase attendees"
            >
              <Plus className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Upload Pictures Field */}
        <div className="px-5 py-4 border-t border-gray-100">
          <label className="text-sm font-medium text-black block mb-3">
            Upload picture
          </label>
          <div className="flex flex-wrap gap-3">
            {/* Uploaded Images */}
            {images.map((image, index) => (
              <div
                key={index}
                className="relative w-24 h-24 rounded-xl overflow-hidden bg-gray-100"
              >
                {image.state === "loading" ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                  </div>
                ) : image.state === "error" ? (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                    <AlertCircle className="w-6 h-6 text-red-500" />
                    <span className="text-xs text-red-500">Failed</span>
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={image.url}
                    alt={`Upload ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                )}
                <button
                  onClick={() => removeImage(index)}
                  className="absolute top-1 right-1 w-5 h-5 bg-gray-500/70 rounded-full flex items-center justify-center hover:bg-gray-600/70 transition-colors"
                  aria-label="Remove image"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}

            {/* Add Image Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center hover:border-gray-300 transition-colors"
              aria-label="Add image"
            >
              <Plus className="w-6 h-6 text-gray-400" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* Bottom Button */}
      <div className="px-5 pb-8 pt-4">
        <Button
          onClick={handlePublish}
          disabled={!isFormValid() || isSubmitting}
          className="w-full h-14 rounded-2xl bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white font-semibold text-base disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Publishing...
            </span>
          ) : (
            "Publish Activity"
          )}
        </Button>
      </div>

      {/* Time Picker Bottom Sheet */}
      <Sheet open={isTimePickerOpen} onOpenChange={setIsTimePickerOpen}>
        <SheetContent side="bottom" hideCloseButton className="px-5 pb-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <SheetTitle className="text-xl font-semibold text-black">
              Select Date & Time
            </SheetTitle>
            <button
              onClick={() => setIsTimePickerOpen(false)}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Date Input */}
          <div className="mb-4">
            <label className="text-sm font-medium text-black block mb-2">
              Date
            </label>
            <input
              type="date"
              value={tempDate}
              onChange={(e) => setTempDate(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base text-black focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {/* Time Input */}
          <div className="mb-8">
            <label className="text-sm font-medium text-black block mb-2">
              Time
            </label>
            <input
              type="time"
              value={tempTime}
              onChange={(e) => setTempTime(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base text-black focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {/* Confirm Button */}
          <Button
            onClick={handleConfirmTime}
            disabled={!tempDate || !tempTime}
            className="w-full h-14 rounded-2xl bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white font-semibold text-base disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Confirm
          </Button>
        </SheetContent>
      </Sheet>

      {/* Type Picker Bottom Sheet */}
      <Sheet open={isTypePickerOpen} onOpenChange={setIsTypePickerOpen}>
        <SheetContent side="bottom" hideCloseButton className="px-5 pb-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <SheetTitle className="text-xl font-semibold text-black">
              Activity Types
            </SheetTitle>
            <button
              onClick={() => setIsTypePickerOpen(false)}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Activity Types Grid */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {community.activityTypes.map((type, index) => (
              <button
                key={index}
                onClick={() => handleSelectType(type)}
                className={`py-3 px-4 rounded-xl text-sm font-medium transition-all ${
                  selectedType === type
                    ? "bg-violet-100 text-violet-700 border-2 border-violet-500"
                    : "bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200"
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Confirm Button */}
          <Button
            onClick={handleConfirmType}
            disabled={!selectedType}
            className="w-full h-14 rounded-2xl bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white font-semibold text-base disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Confirm
          </Button>
        </SheetContent>
      </Sheet>
    </div>
  );
}
