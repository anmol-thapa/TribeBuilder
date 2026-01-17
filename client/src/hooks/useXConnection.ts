import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useXConnection() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const { toast } = useToast();

  const connectX = async () => {
    setIsConnecting(true);
    try {
      // Check if user is authenticated
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("You must be logged in to connect your X account");
      }

      console.log("[useXConnection] Initiating X OAuth flow for user:", user.id, user.email);

      // Call the Edge Function to initiate OAuth
      const { data, error } = await supabase.functions.invoke("x-oauth-callback", {
        body: { action: "initiate" },
      });

      if (error) {
        console.error("Edge function error:", error);
        throw error;
      }

      if (data?.authUrl) {
        console.log("Redirecting to X authorization page...");
        // Redirect user to X authorization page
        // User will authorize the app and be redirected back
        window.location.href = data.authUrl;
      } else {
        console.error("No authUrl in response:", data);
        throw new Error("Failed to get authorization URL from server");
      }
    } catch (error: any) {
      console.error("Error connecting X:", error);
      toast({
        title: "Failed to connect X account",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
      setIsConnecting(false);
      return false;
    }
    // Don't set isConnecting to false here - user is being redirected
  };

  const disconnectX = async () => {
    setIsDisconnecting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Not authenticated");
      }

      console.log("[useXConnection] Disconnecting X account for user:", user.id, user.email);

      // Mark connection as inactive instead of deleting
      // This preserves history and allows easy reconnection
      const { error } = await supabase
        .from("social_connections")
        .update({ is_active: false })
        .eq("user_id", user.id)
        .eq("platform", "twitter");

      if (error) {
        console.error("Database error:", error);
        throw error;
      }

      toast({
        title: "X Account Disconnected",
        description: "Your X account has been successfully disconnected",
      });

      // Refresh the page to update the UI
      setTimeout(() => {
        window.location.reload();
      }, 1000);

      return true;
    } catch (error: any) {
      console.error("Error disconnecting X:", error);
      toast({
        title: "Failed to disconnect X account",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsDisconnecting(false);
    }
  };

  return {
    connectX,
    disconnectX,
    isConnecting,
    isDisconnecting,
  };
}
