import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  TrendingUp,
  Calendar,
  Heart,
  MessageSquare,
  Share2,
  Instagram,
  Twitter,
  Facebook,
  Linkedin,
  Youtube,
  Plus,
  BarChart3,
  Clock,
  Target,
  LogOut
} from "lucide-react";
import { AnalyticsChart } from "@/components/dashboard/AnalyticsChart";
import { SocialAccountCard } from "@/components/dashboard/SocialAccountCard";
import { PostScheduler } from "@/components/dashboard/PostScheduler";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { PostAnalytics } from "@/components/dashboard/PostAnalytics";
import { useSocialData } from "@/hooks/useSocialData";
import { XPostCard } from "@/components/XPostCard";
import { FacebookPostCard } from "@/components/FacebookPostCard";

import { TikTokPostCard } from "@/components/TikTokPostCard";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const Dashboard = () => {
  const [selectedTimeframe, setSelectedTimeframe] = useState("7d");
  const [selectedTab, setSelectedTab] = useState("overview");
  const [activeConnectPlatform, setActiveConnectPlatform] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, logout, user } = useAuth();

  // Social data (from Supabase functions; requires Supabase auth)
  const { connections, analytics, loading, error, syncAnalytics } = useSocialData();

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  // Release connect state when OAuth completion messages come back
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (typeof event.data?.type === "string" && event.data.type.includes("-auth-")) {
        setActiveConnectPlatform(null);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Transform connections to match the expected format for social accounts
  console.log('[Dashboard] Current user:', user?.id, user?.email);
  console.log('[Dashboard] Connections loaded:', connections.length, connections);

  const allPlatforms = ["Instagram", "Twitter", "Facebook", "LinkedIn", "YouTube", "Reddit", "TikTok"];
  const socialAccounts = allPlatforms.map(platform => {
    const connection = connections.find(c =>
      c.platform.toLowerCase() === platform.toLowerCase()
    );

    if (connection) {
      console.log(`[Dashboard] ${platform} connection found:`, {
        connectionUserId: connection.user_id,
        currentUserId: user?.id,
        match: connection.user_id === user?.id,
        username: connection.username
      });
    }

    return {
      platform,
      username: connection?.username || "",
      followers: connection?.followers_count || 0,
      connected: !!connection,
      color: platform.toLowerCase(),
      connectionId: connection?.id,
    };
  });

  // Calculate metrics only from connected accounts
  const connectedAccounts = socialAccounts.filter(account => account.connected);
  const hasConnectedAccounts = connectedAccounts.length > 0;

  const metrics = hasConnectedAccounts ? {
    totalFollowers: connectedAccounts.reduce((sum, account) => sum + account.followers, 0),
    followersGrowth: 12, // Calculate from analytics data
    totalEngagement: Object.values(analytics).flat()
      .reduce((sum, data) => sum + data.likes + data.comments + data.shares, 0),
    engagementGrowth: 8,
    scheduledPosts: 0, // TODO: Get from your scheduling system
    postsGrowth: 0,
    avgReach: Math.round(
      Object.values(analytics).flat()
        .reduce((sum, data) => sum + data.reach, 0) /
      (Object.values(analytics).flat().length || 1)
    ),
    reachGrowth: 15
  } : null;

  const hasAnalyticsData = Object.keys(analytics).length > 0;

  const apiStatus = error
    ? { title: "API Issue", description: "Social APIs not reachable yet. Configure Supabase functions and keys.", tone: "warning" }
    : hasConnectedAccounts
      ? { title: "API Status", description: "Connected to Supabase social APIs", tone: "success" }
      : { title: "API Status", description: "No social accounts connected. Supabase social APIs may need wiring.", tone: "muted" };

  return (
    <div className="min-h-screen bg-background">
      {isAuthenticated && (
        <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold">Social Dashboard</h1>
                <p className="text-sm text-muted-foreground">Track analytics, manage accounts, and schedule posts.</p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="border-primary/20 hover:bg-primary/10"
                onClick={() => setSelectedTab("scheduler")}
              >
                <Plus className="h-4 w-4 mr-2" />
                New Post
              </Button>
            </div>
          </div>

          <div className="space-y-8">
            {/* Key Metrics */}
            {hasConnectedAccounts ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                  title="Total Followers"
                  value={metrics!.totalFollowers.toLocaleString()}
                  growth={metrics!.followersGrowth}
                  icon={Users}
                  gradient="gradient-primary"
                />
                <MetricCard
                  title="Total Engagement"
                  value={metrics!.totalEngagement.toLocaleString()}
                  growth={metrics!.engagementGrowth}
                  icon={Heart}
                  gradient="gradient-instagram"
                />
                <MetricCard
                  title="Scheduled Posts"
                  value={metrics!.scheduledPosts.toString()}
                  growth={metrics!.postsGrowth}
                  icon={Calendar}
                  gradient="gradient-secondary"
                />
                <MetricCard
                  title="Avg. Reach"
                  value={metrics!.avgReach.toLocaleString()}
                  growth={metrics!.reachGrowth}
                  icon={Target}
                  gradient="gradient-primary"
                />
              </div>
            ) : (
              <Card className="glass border-border/20 border-dashed border-2">
                <CardContent className="p-8 text-center">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-semibold mb-2">No Social Accounts Connected</h3>
                  <p className="text-muted-foreground mb-4">
                    Connect your social media accounts to start tracking your analytics and growth metrics.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Head to the "Social Accounts" tab to get started!
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Main Content Tabs */}
            <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-3 bg-muted/20">
                <TabsTrigger
                  value="overview"
                  className="flex items-center space-x-2 data-[state=active]:bg-[rgb(143,115,86)] data-[state=active]:text-white"
                >
                  <BarChart3 className="h-4 w-4" />
                  <span>Analytics</span>
                </TabsTrigger>
                <TabsTrigger
                  value="accounts"
                  className="flex items-center space-x-2 data-[state=active]:bg-[rgb(143,115,86)] data-[state=active]:text-white"
                >
                  <Users className="h-4 w-4" />
                  <span>Social Accounts</span>
                </TabsTrigger>
                <TabsTrigger
                  value="scheduler"
                  className="flex items-center space-x-2 data-[state=active]:bg-[rgb(143,115,86)] data-[state=active]:text-white"
                >
                  <Clock className="h-4 w-4" />
                  <span>Post Scheduler</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-6">
                    <AnalyticsChart
                      timeframe={selectedTimeframe}
                      onTimeframeChange={setSelectedTimeframe}
                      connectedAccounts={connectedAccounts}
                      hasData={hasAnalyticsData}
                      analytics={analytics}
                    />
                    <PostAnalytics />
                  </div>
                  <div className="space-y-4">
                    <Card className="glass border-border/20">
                      <CardHeader>
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Connected Platforms
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {connectedAccounts.length > 0 ? (
                          <div className="space-y-3">
                            {connectedAccounts.map((account, index) => (
                              <div key={index} className="flex items-center justify-between">
                                <span className="text-sm font-medium">{account.platform}</span>
                                <span className="text-sm text-muted-foreground">
                                  {account.followers.toLocaleString()} followers
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center">
                            No accounts connected yet
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="glass border-border/20">
                      <CardHeader>
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          {apiStatus.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-center">
                          <p className={`text-sm font-medium ${apiStatus.tone === 'success'
                              ? 'text-green-500'
                              : apiStatus.tone === 'warning'
                                ? 'text-amber-500'
                                : 'text-muted-foreground'
                            }`}>
                            {apiStatus.description}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="accounts" className="space-y-6">
                <Card className="glass border-border/20 mb-6">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-2">Connect Your Social Accounts</h3>
                    <p className="text-sm text-muted-foreground">
                      Connect your own social media accounts to post content and track analytics.
                      Each account you connect will use your personal credentials for posting.
                    </p>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {socialAccounts.map((account, index) => (
                    <SocialAccountCard
                      key={index}
                      {...account}
                      activeConnectPlatform={activeConnectPlatform}
                      onConnectStart={() => setActiveConnectPlatform(account.platform)}
                      onConnectEnd={() => setActiveConnectPlatform(null)}
                      onSync={() => syncAnalytics(account.platform.toLowerCase())}
                    />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="scheduler" className="space-y-6">
                <PostScheduler />

                {/* Quick Post Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {connections.some(c => c.platform === 'twitter') && <XPostCard />}
                  {connections.some(c => c.platform === 'facebook') && <FacebookPostCard />}
                  {connections.some(c => c.platform === 'tiktok') && (
                    <TikTokPostCard connectionId={connections.find(c => c.platform === 'tiktok')?.id || ''} />
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
