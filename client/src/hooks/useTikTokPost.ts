import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useTikTokPost() {
  const [isPosting, setIsPosting] = useState(false);
  const { toast } = useToast();

  const postToTikTok = async (videoUrl: string, caption?: string, connectionId?: string) => {
    setIsPosting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("You must be logged in to post to TikTok");
      }

      console.log("[useTikTokPost] Posting to TikTok:", { videoUrl, caption });

      const { data, error } = await supabase.functions.invoke("tiktok-post", {
        body: { videoUrl, caption, connectionId },
      });

      if (error) {
        console.error("Edge function error:", error);
        throw error;
      }

      console.log("TikTok post response:", data);

      toast({
        title: "Posted to TikTok",
        description: "Your video has been successfully uploaded to TikTok",
      });

      return { success: true, data };
    } catch (error: any) {
      console.error("Error posting to TikTok:", error);
      toast({
        title: "Failed to post to TikTok",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
      return { success: false, error };
    } finally {
      setIsPosting(false);
    }
  };

  return {
    postToTikTok,
    isPosting,
  };
}
