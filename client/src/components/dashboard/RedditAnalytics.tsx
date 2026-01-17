import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUp, ArrowDown, MessageSquare, TrendingUp } from 'lucide-react';

interface RedditPost {
  id: string;
  content: string;
  post_url: string;
  posted_at: string;
  upvotes_count: number;
  downvotes_count: number;
  comments_count: number;
  followers_at_post: number;
}

interface RedditAnalyticsProps {
  posts: RedditPost[];
}

export const RedditAnalytics = ({ posts }: RedditAnalyticsProps) => {
  const totalUpvotes = posts.reduce((sum, post) => sum + (post.upvotes_count || 0), 0);
  const totalDownvotes = posts.reduce((sum, post) => sum + (post.downvotes_count || 0), 0);
  const totalComments = posts.reduce((sum, post) => sum + (post.comments_count || 0), 0);
  const netKarma = totalUpvotes - totalDownvotes;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ArrowUp className="h-4 w-4 text-green-500" />
              Upvotes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUpvotes.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ArrowDown className="h-4 w-4 text-red-500" />
              Downvotes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDownvotes.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-500" />
              Comments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalComments.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              Net Karma
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netKarma >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {netKarma >= 0 ? '+' : ''}{netKarma.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Posts */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Posts Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {posts.slice(0, 5).map((post) => {
              const karma = (post.upvotes_count || 0) - (post.downvotes_count || 0);
              const followerGrowth = post.followers_at_post || 0;
              
              return (
                <div key={post.id} className="border-b border-border pb-4 last:border-0">
                  <a 
                    href={post.post_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm font-medium hover:underline mb-2 block"
                  >
                    {post.content.substring(0, 100)}...
                  </a>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <ArrowUp className="h-3 w-3 text-green-500" />
                      {post.upvotes_count || 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <ArrowDown className="h-3 w-3 text-red-500" />
                      {post.downvotes_count || 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3 text-blue-500" />
                      {post.comments_count || 0}
                    </span>
                    <span className={`flex items-center gap-1 font-medium ${karma >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      Net: {karma >= 0 ? '+' : ''}{karma}
                    </span>
                    {followerGrowth > 0 && (
                      <span className="flex items-center gap-1 text-purple-500">
                        <TrendingUp className="h-3 w-3" />
                        {followerGrowth} followers
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Posted {new Date(post.posted_at).toLocaleDateString()}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
