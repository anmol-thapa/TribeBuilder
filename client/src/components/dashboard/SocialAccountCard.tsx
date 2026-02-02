import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Instagram,
  X as XIcon,
  Facebook,
  Youtube,
  MessageCircle,
  Video,
  Plus,
  Settings,
  CheckCircle2,
  Shield,
  Unlink,
  Loader2,
  HelpCircle,
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
  platformKey: string;
  username: string;
  followers: number;
  engagement: number;
  reach: number;
  connected: boolean;
  color: string;
  connectionId?: string;
  profileData?: any;
  onSync?: () => void;
  onDisconnect?: () => void;
  activeConnectPlatform: string | null;
  activeSyncPlatform: string | null;
  onConnectStart: () => void;
  onConnectEnd: () => void;
}

const platformIcons = {
  instagram: Instagram,
  twitter: XIcon,
  facebook: Facebook,
  youtube: Youtube,
  reddit: MessageCircle,
  tiktok: Video,
};

const platformBrandColors: Record<string, string> = {
  instagram: "#E1306C",
  twitter: "#000000",
  facebook: "#1877F2",
  youtube: "#FF0000",
  reddit: "#FF4500",
  tiktok: "#111111",
};

export const SocialAccountCard = ({
  platform,
  platformKey,
  username,
  followers,
  engagement,
  reach,
  connected,
  color,
  connectionId,
  profileData,
  onSync,
  onDisconnect,
  activeConnectPlatform,
  activeSyncPlatform,
  onConnectStart,
  onConnectEnd,
}: SocialAccountCardProps) => {
  const Icon = platformIcons[platformKey as keyof typeof platformIcons];
  const brandColor = platformBrandColors[platformKey] ?? "rgb(143, 115, 86)";
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
      activeConnectPlatform !== null && activeConnectPlatform !== platformKey;
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
    if (platformKey === "twitter") {
      toast({
        title: "Connecting Your X Account",
        description: "You'll be redirected to X. Make sure to log in with YOUR X account.",
        duration: 5000,
      });
      await connectX();
      return;
    }

    // YouTube (redirect flow)
    if (platformKey === "youtube") {
      const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "VITE_GOOGLE_CLIENT_ID";
      const googleClientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET || "";
      const youtubeApiKey = import.meta.env.VITE_YOUTUBE_API_KEY || "";
      if (!googleClientId || googleClientId === "VITE_GOOGLE_CLIENT_ID") {
        toast({
          title: "YouTube not configured",
          description: "Set VITE_GOOGLE_CLIENT_ID to enable YouTube OAuth.",
          variant: "destructive",
        });
        onConnectEnd();
        return;
      }
      if (!googleClientSecret || !youtubeApiKey) {
        toast({
          title: "YouTube not fully configured",
          description: "Set VITE_GOOGLE_CLIENT_SECRET and VITE_YOUTUBE_API_KEY.",
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        toast({
          title: "Please log in",
          description: "You need to be logged in to connect YouTube.",
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
      const oauthState = `youtube_${session.user.id}`;
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", googleClientId);
      authUrl.searchParams.set("redirect_uri", `${supabaseUrl}/functions/v1/social-auth`);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set(
        "scope",
        "https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.upload"
      );
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("state", oauthState);
      authUrl.searchParams.set("prompt", "consent");
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      const popup = window.open(
        authUrl.toString(),
        "YouTube OAuth",
        `width=${width},height=${height},left=${left},top=${top}`
      );
      if (!popup) {
        toast({
          title: "Popup blocked",
          description: "Please allow popups to connect YouTube.",
          variant: "destructive",
        });
        onConnectEnd();
        return;
      }
      const checkPopup = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkPopup);
          onConnectEnd();
        }
      }, 1000);
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
    if (!connectionId && platformKey !== "twitter") return;

    const confirmed = window.confirm(`Are you sure you want to disconnect your ${platform} account?`);

    if (!confirmed) return;

    const clearTokens = async (id: string) => {
      const { error } = await supabase
        .from('social_connections')
        .update({
          is_active: false,
          access_token: "",
          refresh_token: null,
          token_expires_at: null,
        })
        .eq('id', id);

      if (error) throw error;
    };

    try {
      if (platformKey === "twitter") {
        await disconnectX();
      } else if (platform === "Facebook" && connectionId) {
        await disconnectFacebook(connectionId);
        await clearTokens(connectionId);
      } else if (platform === "TikTok") {
        await disconnectTikTok();
      }

      if (connectionId) {
        await clearTokens(connectionId);
      }

      toast({
        title: "Disconnected",
        description: `Your ${platform} account has been disconnected.`,
      });
      await onDisconnect?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to disconnect account.",
        variant: "destructive",
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
          className="absolute inset-0 opacity-5"
          style={{ backgroundColor: brandColor }}
        ></div>
      )}

      <CardHeader className="relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className={`p-2 rounded-lg ${connected
                ? ""
                : "bg-[rgb(143,115,86)]/10 border border-[rgb(143,115,86)]/40"
                }`}
              style={
                connected
                  ? { backgroundColor: brandColor }
                  : undefined
              }
            >
              <Icon
                className="h-5 w-5"
                style={{
                  color:
                    connected
                      ? "#ffffff"
                      : "rgb(143, 115, 86)",
                }}
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
            </div>
          ) : (
            <Badge variant="secondary">Not Connected</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="relative">
        {connected ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="flex items-center gap-2">
                  {platform === "Reddit" ? (
                    <span className="text-lg font-semibold text-muted-foreground">—</span>
                  ) : (
                    <p className="text-lg font-semibold text-foreground">{followers.toLocaleString()}</p>
                  )}
                  {platform === "Reddit" && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-muted-foreground">
                            <HelpCircle className="h-4 w-4" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          Reddit does not provide follower counts via API.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Followers</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{engagement.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Engagement</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{reach.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Reach</p>
              </div>
            </div>

            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleSync}
                disabled={isSyncing || (!!activeSyncPlatform && activeSyncPlatform !== platformKey)}
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
