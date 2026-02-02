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
        console.log("Opening X authorization popup...");
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;

        const popup = window.open(
          data.authUrl,
          "X OAuth",
          `width=${width},height=${height},left=${left},top=${top}`
        );

        if (!popup) {
          throw new Error("Popup blocked. Please allow popups to connect X.");
        }

        const handleMessage = (event: MessageEvent) => {
          if (event.data?.type === "twitter-auth-success") {
            toast({
              title: "X connected",
              description: "Your X account is now connected.",
            });
            window.removeEventListener("message", handleMessage);
            setIsConnecting(false);
          } else if (event.data?.type === "twitter-auth-error") {
            toast({
              title: "X connection failed",
              description: event.data?.error || "Failed to connect X.",
              variant: "destructive",
            });
            window.removeEventListener("message", handleMessage);
            setIsConnecting(false);
          }
        };

        window.addEventListener("message", handleMessage);

        const checkPopup = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkPopup);
            window.removeEventListener("message", handleMessage);
            setIsConnecting(false);
          }
        }, 1000);
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
    // Don't set isConnecting to false here; popup flow will handle it.
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
