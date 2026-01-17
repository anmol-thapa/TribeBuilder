import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { decryptTokens } from "../_shared/encryption.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: req.headers.get('Authorization')!,
          },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    // Validate request body with Zod
    const AnalyticsSyncSchema = z.object({
      platform: z.enum(['youtube', 'instagram', 'twitter', 'facebook', 'tiktok', 'reddit'], {
        errorMap: () => ({ message: 'Platform must be one of: youtube, instagram, twitter, facebook, tiktok, reddit' })
      }),
    });

    const body = await req.json();
    const validationResult = AnalyticsSyncSchema.safeParse(body);
    
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new Error(`Validation failed: ${errors}`);
    }

    const { platform } = validationResult.data;
    console.log(`Syncing analytics for ${platform} for user:`, user.id);

    // Get user's connection for this platform
    const { data: connection, error: connectionError } = await supabaseClient
      .from('social_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', platform)
      .eq('is_active', true)
      .single();

    if (connectionError || !connection) {
      console.error('Connection error:', connectionError);
      throw new Error('Social media account not connected');
    }

    // Decrypt access token before use
    const decryptedTokens = await decryptTokens({
      access_token: connection.access_token,
    });
    const accessToken = decryptedTokens.access_token!;

    let analyticsData: any = {};

    switch (platform) {
      case 'youtube':
        // Get channel analytics
        const analyticsResponse = await fetch(
          `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==${connection.platform_user_id}&startDate=2024-01-01&endDate=${new Date().toISOString().split('T')[0]}&metrics=views,estimatedMinutesWatched,subscribersGained&dimensions=day`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );

        if (analyticsResponse.ok) {
          const analytics = await analyticsResponse.json();
          // Process and store daily analytics
          if (analytics.rows && analytics.rows.length > 0) {
            const latestData = analytics.rows[analytics.rows.length - 1];
            analyticsData = {
              date: new Date().toISOString().split('T')[0],
              followers_count: connection.followers_count,
              engagement_rate: 0, // Calculate based on views/subscribers
              impressions: latestData[0] || 0, // views
              reach: latestData[0] || 0,
              likes: 0, // Would need additional API calls
              comments: 0,
              shares: 0,
              profile_views: 0,
            };
          }
        }
        break;

      case 'instagram':
        // Instagram Basic Display API has limited analytics
        console.log('[Instagram Analytics] Starting analytics sync for user:', user.id);
        console.log('[Instagram Analytics] Connection ID:', connection.id);
        console.log('[Instagram Analytics] Username:', connection.username);
        
        console.log('[Instagram Analytics] Fetching user media from Instagram Graph API');
        const mediaResponse = await fetch(
          `https://graph.instagram.com/me/media?fields=id,media_type,timestamp,caption,like_count,comments_count,permalink&access_token=${accessToken}`
        );

        console.log('[Instagram Analytics] Media response status:', mediaResponse.status);

        if (mediaResponse.ok) {
          const media = await mediaResponse.json();
          console.log('[Instagram Analytics] Media items retrieved:', media.data?.length || 0);
          
          let totalLikes = 0;
          let totalComments = 0;
          
          // Process and store individual posts
          if (media.data && media.data.length > 0) {
            console.log('[Instagram Analytics] Processing individual posts');
            
            for (const post of media.data) {
              totalLikes += post.like_count || 0;
              totalComments += post.comments_count || 0;
              
              // Store post in database
              const { error: postError } = await supabaseClient
                .from('social_posts')
                .upsert({
                  connection_id: connection.id,
                  platform_post_id: post.id,
                  content: post.caption || '',
                  post_url: post.permalink || '',
                  posted_at: post.timestamp,
                  likes_count: post.like_count || 0,
                  comments_count: post.comments_count || 0,
                  shares_count: 0,
                  views_count: 0,
                  followers_at_post: connection.followers_count,
                }, {
                  onConflict: 'connection_id,platform_post_id',
                });
                
              if (postError) {
                console.error('[Instagram Analytics] Error storing post:', post.id, postError.message);
              }
            }
            
            console.log('[Instagram Analytics] Total likes across posts:', totalLikes);
            console.log('[Instagram Analytics] Total comments across posts:', totalComments);
          }
          
          // Calculate engagement rate
          const totalPosts = media.data?.length || 0;
          const avgEngagement = totalPosts > 0 ? ((totalLikes + totalComments) / totalPosts) : 0;
          const engagementRate = connection.followers_count > 0 
            ? (avgEngagement / connection.followers_count) * 100 
            : 0;
          
          console.log('[Instagram Analytics] Calculated engagement rate:', engagementRate.toFixed(2), '%');
          
          analyticsData = {
            date: new Date().toISOString().split('T')[0],
            followers_count: connection.followers_count,
            engagement_rate: Number(engagementRate.toFixed(2)),
            impressions: 0,
            reach: 0,
            likes: totalLikes,
            comments: totalComments,
            shares: 0,
            profile_views: 0,
          };
          
          // Update connection with latest post count
          console.log('[Instagram Analytics] Updating connection with post count:', totalPosts);
          await supabaseClient
            .from('social_connections')
            .update({ 
              posts_count: totalPosts,
            })
            .eq('id', connection.id);
            
          console.log('[Instagram Analytics] Analytics sync completed successfully');
        } else {
          const errorData = await mediaResponse.json();
          console.error('[Instagram Analytics] Failed to fetch media:', JSON.stringify(errorData));
          throw new Error(errorData.error?.message || 'Failed to fetch Instagram media');
        }
        break;

      case 'twitter':
        // Twitter API v2 - Get user metrics
        const metricsResponse = await fetch(
          `https://api.twitter.com/2/users/${connection.platform_user_id}?user.fields=public_metrics`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );

        let totalLikes = 0;
        let totalRetweets = 0;
        let totalReplies = 0;
        let totalImpressions = 0;

        if (metricsResponse.ok) {
          const metrics = await metricsResponse.json();
          const followerCount = metrics.data.public_metrics?.followers_count || 0;

          // Fetch recent tweets with engagement metrics
          const tweetsResponse = await fetch(
            `https://api.twitter.com/2/users/${connection.platform_user_id}/tweets?max_results=50&tweet.fields=public_metrics,created_at,text`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
              },
            }
          );

          if (tweetsResponse.ok) {
            const tweets = await tweetsResponse.json();
            console.log('Fetched tweets:', tweets);
            
            // Store individual posts
            if (tweets.data && tweets.data.length > 0) {
              for (const tweet of tweets.data) {
                totalLikes += tweet.public_metrics?.like_count || 0;
                totalRetweets += tweet.public_metrics?.retweet_count || 0;
                totalReplies += tweet.public_metrics?.reply_count || 0;
                totalImpressions += tweet.public_metrics?.impression_count || 0;

                // Store post in database
                await supabaseClient
                  .from('social_posts')
                  .upsert({
                    connection_id: connection.id,
                    platform_post_id: tweet.id,
                    content: tweet.text,
                    post_url: `https://twitter.com/${connection.username}/status/${tweet.id}`,
                    posted_at: tweet.created_at,
                    likes_count: tweet.public_metrics?.like_count || 0,
                    comments_count: tweet.public_metrics?.reply_count || 0,
                    shares_count: 0,
                    retweets_count: tweet.public_metrics?.retweet_count || 0,
                    views_count: tweet.public_metrics?.impression_count || 0,
                    followers_at_post: followerCount,
                  }, {
                    onConflict: 'connection_id,platform_post_id',
                  });
              }
            }
          }

          // Calculate engagement rate
          const totalEngagement = totalLikes + totalRetweets + totalReplies;
          const engagementRate = followerCount > 0 ? (totalEngagement / followerCount) * 100 : 0;

          analyticsData = {
            date: new Date().toISOString().split('T')[0],
            followers_count: followerCount,
            engagement_rate: Number(engagementRate.toFixed(2)),
            impressions: totalImpressions,
            reach: totalImpressions, // Approximate reach with impressions
            likes: totalLikes,
            comments: totalReplies,
            shares: totalRetweets,
            profile_views: 0, // Not available in basic API
          };

          // Update connection with latest counts
          await supabaseClient
            .from('social_connections')
            .update({ 
              followers_count: followerCount,
              following_count: metrics.data.public_metrics?.following_count || 0,
              posts_count: metrics.data.public_metrics?.tweet_count || 0,
            })
            .eq('id', connection.id);
        }
        break;

      case 'reddit':
        // Get Reddit user info and post metrics
        const redditUserResponse = await fetch(
          'https://oauth.reddit.com/api/v1/me',
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'User-Agent': 'SocialMediaManager/1.0',
            },
          }
        );

        let totalUpvotes = 0;
        let totalDownvotes = 0;
        let totalComments = 0;
        let followerCount = 0;

        if (redditUserResponse.ok) {
          const userData = await redditUserResponse.json();
          followerCount = userData.total_karma || 0; // Karma as proxy for engagement

          // Fetch user's posts
          const postsResponse = await fetch(
            `https://oauth.reddit.com/user/${connection.username}/submitted?limit=100`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'User-Agent': 'SocialMediaManager/1.0',
              },
            }
          );

          if (postsResponse.ok) {
            const redditPosts = await postsResponse.json();
            console.log('Fetched Reddit posts:', redditPosts);

            if (redditPosts.data?.children && redditPosts.data.children.length > 0) {
              for (const postWrapper of redditPosts.data.children) {
                const post = postWrapper.data;
                totalUpvotes += post.ups || 0;
                totalDownvotes += post.downs || 0;
                totalComments += post.num_comments || 0;

                // Update or insert post in database
                await supabaseClient
                  .from('social_posts')
                  .upsert({
                    connection_id: connection.id,
                    platform_post_id: post.id,
                    content: post.selftext || post.title,
                    post_url: `https://reddit.com${post.permalink}`,
                    posted_at: new Date(post.created_utc * 1000).toISOString(),
                    upvotes_count: post.ups || 0,
                    downvotes_count: post.downs || 0,
                    comments_count: post.num_comments || 0,
                    likes_count: post.ups || 0, // Use upvotes as likes
                    views_count: 0, // Reddit doesn't provide view counts
                    followers_at_post: followerCount,
                  }, {
                    onConflict: 'connection_id,platform_post_id',
                  });
              }

              // Calculate engagement rate
              const totalPosts = redditPosts.data.children.length;
              const avgEngagement = totalPosts > 0 ? ((totalUpvotes + totalComments) / totalPosts) : 0;
              const engagementRate = followerCount > 0 ? (avgEngagement / followerCount) * 100 : 0;

              analyticsData = {
                date: new Date().toISOString().split('T')[0],
                followers_count: followerCount,
                engagement_rate: Number(engagementRate.toFixed(2)),
                impressions: 0, // Not available in Reddit API
                reach: 0,
                likes: totalUpvotes,
                comments: totalComments,
                shares: 0,
                profile_views: 0,
              };

              // Update connection with latest counts
              await supabaseClient
                .from('social_connections')
                .update({ 
                  followers_count: followerCount,
                  posts_count: totalPosts,
                })
                .eq('id', connection.id);
            }
          }
        }
        break;

      default:
        throw new Error(`Analytics sync not implemented for ${platform}`);
    }

    // Store analytics data
    if (Object.keys(analyticsData).length > 0) {
      const { error: analyticsError } = await supabaseClient
        .from('social_analytics')
        .upsert({
          connection_id: connection.id,
          ...analyticsData,
        });

      if (analyticsError) {
        console.error('Analytics storage error:', analyticsError);
        throw new Error('Failed to save analytics data');
      }
    }

    return new Response(JSON.stringify({ success: true, data: analyticsData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Analytics sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});