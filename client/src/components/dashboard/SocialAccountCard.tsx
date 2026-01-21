import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Instagram,
  Twitter,
  Facebook,
  Linkedin,
  Youtube,
  MessageCircle,
  Video,
  Plus,
  Settings,
  TrendingUp,
  CheckCircle2,
  Shield,
  Unlink,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useXConnection } from "@/hooks/useXConnection";
import { useFacebookConnection } from "@/hooks/useFacebookConnection";
import { useRedditConnection } from "@/hooks/useRedditConnection";
import { useTikTokConnection } from "@/hooks/useTikTokConnection";
import { socialApiConfig } from "@/config/socialApis";
import { supabase } from "@/integrations/supabase/client";

interface SocialAccountCardProps {
  platform: string;
  username: string;
  followers: number;
  connected: boolean;
  color: string;
  connectionId?: string;
  onSync?: () => void;
  activeConnectPlatform: string | null;
  onConnectStart: () => void;
  onConnectEnd: () => void;
}

const platformIcons = {
  Instagram,
  Twitter,
  Facebook,
  LinkedIn: Linkedin,
  YouTube: Youtube,
  Reddit: MessageCircle,
  TikTok: Video,
};

export const SocialAccountCard = ({
  platform,
  username,
  followers,
  connected,
  color,
  connectionId,
  onSync,
  activeConnectPlatform,
  onConnectStart,
  onConnectEnd,
}: SocialAccountCardProps) => {
  const Icon = platformIcons[platform as keyof typeof platformIcons];
  const { toast } = useToast();
  const { connectX, disconnectX, isConnecting, isDisconnecting } = useXConnection();
  const { connectFacebook, disconnectFacebook, isConnecting: isFbConnecting, isDisconnecting: isFbDisconnecting } = useFacebookConnection();
  const { connectReddit, isConnecting: isRedditConnecting } = useRedditConnection();
  const { connectTikTok, disconnectTikTok, isConnecting: isTikTokConnecting, isDisconnecting: isTikTokDisconnecting } = useTikTokConnection();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    if (!onSync) return;

    setIsSyncing(true);
    try {
      await onSync();
      toast({
        title: "Sync Complete",
        description: `Successfully synced ${platform} analytics data!`,
      });
    } catch (error: any) {
      console.error('Sync error:', error);
      toast({
        title: "Sync Failed",
        description: error.message || `Failed to sync ${platform} data. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  
  const handleConnect = async () => {
    const anotherInProgress =
      activeConnectPlatform !== null && activeConnectPlatform !== platform;
    if (anotherInProgress) {
      toast({
        title: "Please wait",
        description: "Another connection is already in progress.",
        variant: "destructive",
      });
      return;
    }

    onConnectStart();

    // X/Twitter (redirect flow)
    if (platform === "Twitter") {
      toast({
        title: "Connecting Your X Account",
        description: "You'll be redirected to X. Make sure to log in with YOUR X account.",
        duration: 5000,
      });
      await connectX();
      return;
    }

    // YouTube (redirect flow)
    if (platform === "YouTube") {
      const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "VITE_GOOGLE_CLIENT_ID";
      if (!googleClientId || googleClientId === "VITE_GOOGLE_CLIENT_ID") {
        toast({
          title: "YouTube not configured",
          description: "Set VITE_GOOGLE_CLIENT_ID to enable YouTube OAuth.",
          variant: "destructive",
        });
        onConnectEnd();
        return;
      }
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
      if (!supabaseUrl) {
        toast({
          title: "Missing Supabase URL",
          description: "Set VITE_SUPABASE_URL to your Supabase project to enable YouTube OAuth.",
          variant: "destructive",
        });
        onConnectEnd();
        return;
      }
      toast({
        title: "Connecting YouTube",
        description: "You'll be redirected to Google to authorize YouTube access.",
        duration: 3000,
      });
      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${supabaseUrl}/functions/v1/social-auth&response_type=code&scope=https://www.googleapis.com/auth/youtube.readonly%20https://www.googleapis.com/auth/youtube.upload&access_type=offline&state=youtube&prompt=consent`;
      return;
    }

    // Facebook
    if (platform === "Facebook") {
      if (!import.meta.env.VITE_FACEBOOK_APP_ID) {
        toast({
          title: "Facebook not configured",
          description: "Set VITE_FACEBOOK_APP_ID to enable Facebook OAuth.",
          variant: "destructive",
        });
        onConnectEnd();
        return;
      }
      await connectFacebook();
      onConnectEnd();
      return;
    }

    // Instagram
    if (platform === "Instagram") {
      toast({
        title: "Instagram not configured",
        description: "Instagram OAuth is not configured yet. Please use another platform.",
        variant: "destructive",
        duration: 4000,
      });
      onConnectEnd();
      return;
    }

    // Reddit (redirect flow)
    if (platform === "Reddit") {
      if (!import.meta.env.VITE_REDDIT_CLIENT_ID) {
        toast({
          title: "Reddit not configured",
          description: "Set VITE_REDDIT_CLIENT_ID to enable Reddit OAuth.",
          variant: "destructive",
        });
        onConnectEnd();
        return;
      }
      await connectReddit();
      return;
    }

    // TikTok (redirect flow)
    if (platform === "TikTok") {
      if (!import.meta.env.VITE_TIKTOK_CLIENT_KEY) {
        toast({
          title: "TikTok not configured",
          description: "Set VITE_TIKTOK_CLIENT_KEY to enable TikTok OAuth.",
          variant: "destructive",
        });
        onConnectEnd();
        return;
      }
      toast({
        title: "Connecting TikTok",
        description: "You'll be redirected to TikTok to authorize access.",
        duration: 3000,
      });
      await connectTikTok();
      return;
    }

    toast({
      title: `${platform} Connection`,
      description: `${platform} OAuth integration is coming soon! Configure your API keys in Supabase Edge Functions.`,
      variant: "default",
    });
    onConnectEnd();
  };


  const handleDisconnect = async () => {
    if (!connectionId && platform !== "Twitter") return;

    const confirmed = window.confirm(`Are you sure you want to disconnect your ${platform} account?`);

    if (!confirmed) return;

    if (platform === "Twitter") {
      await disconnectX();
    } else if (platform === "Facebook" && connectionId) {
      await disconnectFacebook(connectionId);
    } else if (platform === "TikTok") {
      await disconnectTikTok();
    } else if ((platform === "Reddit" || platform === "Instagram") && connectionId) {
      // For Reddit and Instagram, use direct Supabase update
      try {
        const { error } = await supabase
          .from('social_connections')
          .update({ is_active: false })
          .eq('id', connectionId);

        if (error) throw error;

        toast({
          title: "Disconnected",
          description: `Your ${platform} account has been disconnected.`,
        });

        // Reload to refresh connections
        window.location.reload();
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to disconnect account.",
          variant: "destructive",
        });
      }
    } else {
      // For other platforms
      toast({
        title: "Disconnect feature",
        description: `${platform} disconnect is coming soon!`,
      });
    }
  };

  return (
    <Card
      className={`border-border/20 hover-glow card-interactive relative overflow-hidden ${connected ? "glass" : "border-dashed border-2"
        }`}
    >
      {connected && (
        <div
          className={`absolute inset-0 opacity-5 ${color === "instagram" ? "gradient-instagram" : `bg-social-${color}`
            }`}
        ></div>
      )}

      <CardHeader className="relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className={`p-2 rounded-lg ${connected
                  ? color === "instagram"
                    ? "gradient-instagram"
                    : "bg-social-" + color
                  : "bg-[rgb(143,115,86)]/10 border border-[rgb(143,115,86)]/40"
                }`}
            >
              <Icon
                className="h-5 w-5"
                style={{ color: connected ? "#ffffff" : "rgb(143, 115, 86)" }}
              />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                {platform}
                {connected && <CheckCircle2 className="h-4 w-4 text-green-500" />}
              </CardTitle>
              {connected && <p className="text-sm text-muted-foreground">{username}</p>}
            </div>
          </div>
          {connected ? (
            <div className="flex flex-col items-end gap-1">
              <Badge className="bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20">
                <Shield className="h-3 w-3 mr-1" />
                Connected
              </Badge>
              <span className="text-xs text-muted-foreground">Your account</span>
            </div>
          ) : (
            <Badge variant="secondary">Not Connected</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="relative">
        {connected ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-foreground">{followers.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Followers</p>
              </div>
              <div className="flex items-center space-x-1 text-green-500">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm font-medium">+12%</span>
              </div>
            </div>

            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleSync}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <Settings className="h-4 w-4 mr-2" />
                    Sync Data
                  </>
                )}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="flex-1"
                onClick={handleDisconnect}
                disabled={isDisconnecting || isFbDisconnecting || isTikTokDisconnecting}
              >
                <Unlink className="h-4 w-4 mr-2" />
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">Connect your {platform} account to post and track analytics</p>
            <Button
              onClick={handleConnect}
              disabled={!!activeConnectPlatform && activeConnectPlatform !== platform}
              className="w-full text-white bg-[rgb(143,115,86)] hover:bg-[rgb(123,95,70)]"
            >
              <Plus className="h-4 w-4 mr-2" />
              {activeConnectPlatform === platform ? "Connecting..." : `Connect Your ${platform}`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
