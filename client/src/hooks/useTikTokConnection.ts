import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useTikTokConnection() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const { toast } = useToast();

  const connectTikTok = async () => {
    setIsConnecting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("You must be logged in to connect your TikTok account");
      }

      console.log("[useTikTokConnection] Initiating TikTok OAuth flow for user:", user.id);

      const clientKey = import.meta.env.VITE_TIKTOK_CLIENT_KEY;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const redirectUri = `${supabaseUrl}/functions/v1/tiktok-oauth-callback`;

      if (!clientKey) {
        throw new Error("TikTok Client Key not configured");
      }

      // Pass user ID in state for callback to identify user
      const state = `tiktok_${user.id}`;
      
      const authUrl = `https://www.tiktok.com/v2/auth/authorize?` +
        `client_key=${clientKey}&` +
        `response_type=code&` +
        `scope=user.info.basic,video.publish&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `state=${state}`;

      console.log("Redirecting to TikTok authorization page...");
      window.location.href = authUrl;
    } catch (error: any) {
      console.error("Error connecting TikTok:", error);
      toast({
        title: "Failed to connect TikTok account",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
      setIsConnecting(false);
      return false;
    }
  };

  const disconnectTikTok = async () => {
    setIsDisconnecting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Not authenticated");
      }

      console.log("[useTikTokConnection] Disconnecting TikTok account for user:", user.id);

      const { error } = await supabase
        .from("social_connections")
        .update({ is_active: false })
        .eq("user_id", user.id)
        .eq("platform", "tiktok");

      if (error) {
        console.error("Database error:", error);
        throw error;
      }

      toast({
        title: "TikTok Account Disconnected",
        description: "Your TikTok account has been successfully disconnected",
      });

      setTimeout(() => {
        window.location.reload();
      }, 1000);

      return true;
    } catch (error: any) {
      console.error("Error disconnecting TikTok:", error);
      toast({
        title: "Failed to disconnect TikTok account",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsDisconnecting(false);
    }
  };

  return {
    connectTikTok,
    disconnectTikTok,
    isConnecting,
    isDisconnecting,
  };
}
