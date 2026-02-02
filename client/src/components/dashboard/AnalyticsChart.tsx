import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { BarChart3, X as XIcon, Instagram, Facebook, Youtube } from "lucide-react";
import { useState } from "react";

interface AnalyticsChartProps {
  timeframe: string;
  // optional handler to update timeframe in parent
  onTimeframeChange?: (value: string) => void;
  connectedAccounts?: Array<{
    platform: string;
    platformKey?: string;
    username: string;
    followers: number;
    connected: boolean;
    color: string;
    connectionId?: string;
  }>;
  hasData: boolean;
  analytics?: Record<string, Array<{
    date: string;
    followers_count: number;
    engagement_rate: number;
    impressions: number;
    reach: number;
    likes: number;
    comments: number;
    shares: number;
  }>>;
}

export const AnalyticsChart = ({ timeframe, onTimeframeChange, connectedAccounts = [], hasData, analytics = {} }: AnalyticsChartProps) => {
  const [selectedPlatform, setSelectedPlatform] = useState<string>("overview");

  // Get platform icon
  const getPlatformIcon = (platformKey: string) => {
    const icons: Record<string, any> = {
      twitter: XIcon,
      instagram: Instagram,
      facebook: Facebook,
      youtube: Youtube,
    };
    return icons[platformKey.toLowerCase()] || BarChart3;
  };

  // Filter analytics based on selected platform
  const getFilteredAnalytics = () => {
    // filter by timeframe: assume dates are ISO strings; filter based on timeframe window
    const withinRange = (dateStr: string) => {
      const dt = new Date(dateStr);
      const now = new Date();
      const diffDays = (now.getTime() - dt.getTime()) / (1000 * 60 * 60 * 24);
      switch (timeframe) {
        case "7d": return diffDays <= 7;
        case "30d": return diffDays <= 30;
        case "90d": return diffDays <= 90;
        case "1y": return diffDays <= 365;
        default: return true;
      }
    };

    const baseData =
      selectedPlatform === "overview"
        ? Object.values(analytics).flat()
        : (() => {
          const connection = connectedAccounts.find(
            acc => (acc.platformKey || acc.platform).toLowerCase() === selectedPlatform.toLowerCase()
          );
          return connection && analytics[connection.connectionId!]
            ? analytics[connection.connectionId!]
            : [];
        })();

    const filtered = baseData.filter(a => withinRange(a.date));
    // If filtering removes everything, fall back to base data so demo/static data still shows
    return filtered.length > 0 ? filtered : baseData;
  };

  // Process analytics data
    const analyticsData = hasData && Object.keys(analytics).length > 0 ?
    getFilteredAnalytics()
      .reduce((acc: any[], data) => {
        const dateKey = data.date;
        const existingDate = acc.find(item => item.dateKey === dateKey);
        if (existingDate) {
          existingDate.followers += data.followers_count;
          existingDate.likes += data.likes;
          existingDate.engagement += data.likes + data.comments + data.shares;
          existingDate.reach += data.reach;
        } else {
          acc.push({
            dateKey,
            dateLabel: new Date(`${data.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            followers: data.followers_count,
            likes: data.likes,
            engagement: data.likes + data.comments + data.shares,
            reach: data.reach
          });
        }
        return acc;
      }, [])
      .sort((a, b) => new Date(`${a.dateKey}T00:00:00`).getTime() - new Date(`${b.dateKey}T00:00:00`).getTime())
    : [];

  const timeframeButtons = [
    { label: "7D", value: "7d" },
    { label: "30D", value: "30d" },
    { label: "90D", value: "90d" },
    { label: "1Y", value: "1y" },
  ];

  return (
    <Card className="glass border-border/20">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle className="text-lg font-semibold">Growth Analytics</CardTitle>
          <div className="flex items-center gap-4">
            <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
              <SelectTrigger className="w-[180px] bg-muted/20">
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border z-50">
                <SelectItem value="overview">Overview (All)</SelectItem>
                {connectedAccounts.map((account) => {
                  const platformKey = account.platformKey || account.platform;
                  const Icon = getPlatformIcon(platformKey);
                  return (
                    <SelectItem
                      key={account.platform}
                      value={platformKey.toLowerCase()}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {account.platform}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <div className="flex space-x-2">
              {timeframeButtons.map((btn) => (
                <Button
                  key={btn.value}
                  variant={timeframe === btn.value ? "default" : "outline"}
                  size="sm"
                  className="h-8 px-3"
                  onClick={() => onTimeframeChange?.(btn.value)}
                >
                  {btn.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {hasData && analyticsData.length > 0 ? (
          <div className="space-y-6">
            {/* Followers Chart */}
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Follower Growth</h3>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={analyticsData}>
                  <defs>
                    <linearGradient id="followersGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="dateLabel"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="followers"
                    stroke="hsl(var(--primary))"
                    fillOpacity={1}
                    fill="url(#followersGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Likes Chart */}
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Daily Likes</h3>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={analyticsData}>
                  <defs>
                    <linearGradient id="likesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--instagram))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--instagram))" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="dateLabel"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="likes"
                    stroke="hsl(var(--instagram))"
                    fillOpacity={1}
                    fill="url(#likesGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-[400px] text-center">
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-muted/20 flex items-center justify-center">
                <BarChart3 className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">No Analytics Data</h3>
                <p className="text-sm text-muted-foreground">
                  Connect social accounts to view real-time analytics
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
