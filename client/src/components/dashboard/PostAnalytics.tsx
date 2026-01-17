import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, MessageSquare, Share2, Eye, Users, TrendingUp, ArrowUp, ArrowDown } from "lucide-react";
import { useSocialPosts } from "@/hooks/useSocialPosts";
import { useSocialData } from "@/hooks/useSocialData";
import { formatDistanceToNow } from "date-fns";

interface PostAnalyticsProps {
  connectionId?: string;
}

export const PostAnalytics = ({ connectionId }: PostAnalyticsProps) => {
  const { posts, loading } = useSocialPosts(connectionId);
  const { connections } = useSocialData();

  if (loading) {
    return (
      <Card className="glass border-border/20">
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading posts...</p>
        </CardContent>
      </Card>
    );
  }

  if (posts.length === 0) {
    return (
      <Card className="glass border-border/20 border-dashed border-2">
        <CardContent className="p-8 text-center">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-semibold mb-2">No Posts Yet</h3>
          <p className="text-muted-foreground">
            Connect your social accounts and sync analytics to see your posts here.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getPlatformColor = (connectionId: string) => {
    const connection = connections.find(c => c.id === connectionId);
    return connection?.platform.toLowerCase() || 'primary';
  };

  const getPlatformName = (connectionId: string) => {
    const connection = connections.find(c => c.id === connectionId);
    return connection?.platform || 'Unknown';
  };

  return (
    <div className="space-y-4">
      <Card className="glass border-border/20">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Recent Posts</span>
            <Badge variant="secondary">{posts.length} posts</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {posts.map((post: any, index: number) => {
              const platform = getPlatformName(post.connection_id);
              const platformColor = getPlatformColor(post.connection_id);
              const followerGrowth = post.followers_at_post - (posts[index + 1]?.followers_at_post || post.followers_at_post);
              
              return (
                <Card key={post.id} className="border-border/20 hover:border-primary/20 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={`gradient-${platformColor}`}>
                            {platform}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(post.posted_at), { addSuffix: true })}
                          </span>
                        </div>
                        {post.content && (
                          <p className="text-sm line-clamp-3 mb-3">{post.content}</p>
                        )}
                        {post.post_url && (
                          <a 
                            href={post.post_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline"
                          >
                            View post →
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-3 border-t border-border/20">
                      {platform.toLowerCase() === 'reddit' ? (
                        <>
                          <div className="flex items-center gap-2">
                            <ArrowUp className="h-4 w-4 text-orange-500" />
                            <div>
                              <p className="text-xs text-muted-foreground">Upvotes</p>
                              <p className="text-sm font-semibold">{(post.upvotes_count || 0).toLocaleString()}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <ArrowDown className="h-4 w-4 text-blue-500" />
                            <div>
                              <p className="text-xs text-muted-foreground">Downvotes</p>
                              <p className="text-sm font-semibold">{(post.downvotes_count || 0).toLocaleString()}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-green-500" />
                            <div>
                              <p className="text-xs text-muted-foreground">Comments</p>
                              <p className="text-sm font-semibold">{post.comments_count.toLocaleString()}</p>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <Heart className="h-4 w-4 text-red-500" />
                            <div>
                              <p className="text-xs text-muted-foreground">Likes</p>
                              <p className="text-sm font-semibold">{post.likes_count.toLocaleString()}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-blue-500" />
                            <div>
                              <p className="text-xs text-muted-foreground">Comments</p>
                              <p className="text-sm font-semibold">{post.comments_count.toLocaleString()}</p>
                            </div>
                          </div>

                          {post.shares_count > 0 && (
                            <div className="flex items-center gap-2">
                              <Share2 className="h-4 w-4 text-green-500" />
                              <div>
                                <p className="text-xs text-muted-foreground">Shares</p>
                                <p className="text-sm font-semibold">{post.shares_count.toLocaleString()}</p>
                              </div>
                            </div>
                          )}

                          {post.views_count > 0 && (
                            <div className="flex items-center gap-2">
                              <Eye className="h-4 w-4 text-purple-500" />
                              <div>
                                <p className="text-xs text-muted-foreground">Views</p>
                                <p className="text-sm font-semibold">{post.views_count.toLocaleString()}</p>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-orange-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">Followers</p>
                          <div className="flex items-center gap-1">
                            <p className="text-sm font-semibold">{post.followers_at_post.toLocaleString()}</p>
                            {followerGrowth !== 0 && (
                              <span className={`text-xs flex items-center ${followerGrowth > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                <TrendingUp className="h-3 w-3" />
                                {followerGrowth > 0 ? '+' : ''}{followerGrowth}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
