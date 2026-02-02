import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { decryptTokens } from "../_shared/encryption.ts";
import { createHmac } from "node:crypto";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const X_API_KEY = Deno.env.get("X_API_KEY")?.trim();
const X_KEY_SECRET = Deno.env.get("X_KEY_SECRET")?.trim();

const encodeOAuth = (value: string) =>
  encodeURIComponent(value)
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

const buildOAuthSignature = (
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
) => {
  const baseString = [
    method.toUpperCase(),
    encodeOAuth(url),
    encodeOAuth(
      Object.entries(params)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${encodeOAuth(k)}=${encodeOAuth(v)}`)
        .join("&")
    ),
  ].join("&");

  const signingKey = `${encodeOAuth(consumerSecret)}&${encodeOAuth(tokenSecret)}`;
  return createHmac("sha1", signingKey).update(baseString).digest("base64");
};

const buildOAuthHeader = (
  method: string,
  url: string,
  queryParams: Record<string, string>,
  token: string,
  tokenSecret: string
) => {
  if (!X_API_KEY || !X_KEY_SECRET) {
    throw new Error("X API credentials are not configured");
  }

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: X_API_KEY,
    oauth_nonce: Math.random().toString(36).slice(2),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: token,
    oauth_version: "1.0",
  };

  const signature = buildOAuthSignature(
    method,
    url,
    { ...oauthParams, ...queryParams },
    X_KEY_SECRET,
    tokenSecret
  );

  const headerParams = { ...oauthParams, oauth_signature: signature };
  return (
    "OAuth " +
    Object.entries(headerParams)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${encodeOAuth(k)}="${encodeOAuth(v)}"`)
      .join(", ")
  );
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let rateLimitInfo: any = null;
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
      access_token_secret: connection.access_token_secret || undefined,
    });
    const accessToken = decryptedTokens.access_token!;
    const accessTokenSecret = decryptedTokens.access_token_secret || "";

    let analyticsData: any = {};
    let analyticsRows: any[] = [];

    const getRateLimitInfo = (res: Response) => ({
      limit: res.headers.get('x-rate-limit-limit'),
      remaining: res.headers.get('x-rate-limit-remaining'),
      reset: res.headers.get('x-rate-limit-reset'),
      status: res.status,
    });

    switch (platform) {
      case 'youtube':
        // Refresh subscriber count
        let subscriberCount = connection.followers_count || 0;
        const channelInfoResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${connection.platform_user_id}&key=${Deno.env.get('YOUTUBE_API_KEY')}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );
        if (channelInfoResponse.ok) {
          const channelInfo = await channelInfoResponse.json();
          const stats = channelInfo.items?.[0]?.statistics;
          if (stats?.subscriberCount) {
            subscriberCount = parseInt(stats.subscriberCount || '0');
            await supabaseClient
              .from('social_connections')
              .update({ followers_count: subscriberCount })
              .eq('id', connection.id);
          }
        }

        const endDate = new Date();
        const endDateStr = endDate.toISOString().split('T')[0];
        const startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 90);
        const startDateStr = startDate.toISOString().split('T')[0];

        // Get channel analytics
        const analyticsResponse = await fetch(
          `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==${connection.platform_user_id}&startDate=${startDateStr}&endDate=${endDateStr}&metrics=views,estimatedMinutesWatched,subscribersGained&dimensions=day`,
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
            const totalGained = analytics.rows.reduce(
              (sum: number, row: any[]) => sum + (Number(row[3]) || 0),
              0
            );
            let runningFollowers = Math.max(subscriberCount - totalGained, 0);

            analyticsRows = analytics.rows.map((row: any[]) => {
              const rowDate = row[0];
              const views = Number(row[1]) || 0;
              const subscribersGained = Number(row[3]) || 0;
              runningFollowers += subscribersGained;

              return {
                connection_id: connection.id,
                date: rowDate,
                followers_count: runningFollowers,
                engagement_rate: 0,
                impressions: views,
                reach: views,
                likes: 0,
                comments: 0,
                shares: 0,
                profile_views: 0,
              };
            });
          }
        } else {
          const analyticsError = await analyticsResponse.json().catch(() => null);
          console.error('YouTube analytics API error:', analyticsError || analyticsResponse.statusText);
        }
        // Always write a baseline row even if analytics has no rows
        if (analyticsRows.length === 0) {
          analyticsData = {
            date: new Date().toISOString().split('T')[0],
            followers_count: subscriberCount,
            engagement_rate: 0,
            impressions: 0,
            reach: 0,
            likes: 0,
            comments: 0,
            shares: 0,
            profile_views: 0,
          };
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
        if (!accessTokenSecret) {
          throw new Error('Missing X access token secret');
        }

        const metricsUrl = `https://api.twitter.com/2/users/${connection.platform_user_id}`;
        const metricsQuery = {
          "user.fields": "public_metrics",
        };
        const metricsResponse = await fetch(
          `${metricsUrl}?user.fields=${encodeURIComponent(metricsQuery["user.fields"])}`,
          {
            headers: {
              'Authorization': buildOAuthHeader(
                "GET",
                metricsUrl,
                metricsQuery,
                accessToken,
                accessTokenSecret
              ),
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
          const tweetsUrl = `https://api.twitter.com/2/users/${connection.platform_user_id}/tweets`;
          const tweetsQuery = {
            max_results: "50",
            "tweet.fields": "public_metrics,created_at,text",
          };
          const tweetsResponse = await fetch(
            `${tweetsUrl}?max_results=${tweetsQuery.max_results}&tweet.fields=${encodeURIComponent(tweetsQuery["tweet.fields"])}`,
            {
              headers: {
                'Authorization': buildOAuthHeader(
                  "GET",
                  tweetsUrl,
                  tweetsQuery,
                  accessToken,
                  accessTokenSecret
                ),
              },
            }
          );

          if (tweetsResponse.ok) {
            const tweets = await tweetsResponse.json();
            console.log('Fetched tweets:', tweets);
            
            // Aggregate engagement only (skip per-post storage)
            if (tweets.data && tweets.data.length > 0) {
              for (const tweet of tweets.data) {
                totalLikes += tweet.public_metrics?.like_count || 0;
                totalRetweets += tweet.public_metrics?.retweet_count || 0;
                totalReplies += tweet.public_metrics?.reply_count || 0;
                totalImpressions += tweet.public_metrics?.impression_count || 0;
              }
            }
          } else {
            const tweetsError = await tweetsResponse.json().catch(() => null);
          rateLimitInfo = getRateLimitInfo(tweetsResponse);
          console.error('Twitter tweets API error:', tweetsError || tweetsResponse.statusText);
          console.error('Twitter rate limit:', rateLimitInfo);
            throw new Error(
              `Twitter tweets API error (${tweetsResponse.status})` +
              (rateLimitInfo?.reset ? `; rate_limit_reset=${rateLimitInfo.reset}` : '')
            );
          }

          // Calculate engagement rate
          const totalEngagement = totalLikes + totalRetweets + totalReplies;
          const engagementRate = followerCount > 0 ? (totalEngagement / followerCount) * 100 : 0;
          analyticsData = {
            date: new Date().toISOString().split('T')[0],
            followers_count: followerCount,
            engagement_rate: Number(engagementRate.toFixed(2)),
            impressions: totalImpressions,
            reach: totalImpressions || totalEngagement, // Use impressions if available, else engagement proxy
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
        } else {
          const metricsError = await metricsResponse.json().catch(() => null);
          rateLimitInfo = getRateLimitInfo(metricsResponse);
          console.error('Twitter metrics API error:', metricsError || metricsResponse.statusText);
          console.error('Twitter rate limit:', rateLimitInfo);
          throw new Error(
            `Twitter metrics API error (${metricsResponse.status})` +
            (rateLimitInfo?.reset ? `; rate_limit_reset=${rateLimitInfo.reset}` : '')
          );
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
        const followerCount = 0;
        let karmaEngagement = 0;

        if (redditUserResponse.ok) {
          const userData = await redditUserResponse.json();
          // Reddit API doesn't provide follower count; treat karma as engagement proxy.
          karmaEngagement = userData.total_karma || 0;

          // Always create a baseline analytics row even if no posts exist
          analyticsData = {
            date: new Date().toISOString().split('T')[0],
            followers_count: 0,
            engagement_rate: 0,
            impressions: 0,
            reach: karmaEngagement,
            likes: 0,
            comments: 0,
            shares: 0,
            profile_views: 0,
          };

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
              const engagementRate = 0;

              analyticsData = {
                date: new Date().toISOString().split('T')[0],
                followers_count: 0,
                engagement_rate: Number(engagementRate.toFixed(2)),
                impressions: 0, // Not available in Reddit API
                reach: karmaEngagement,
                likes: totalUpvotes,
                comments: totalComments,
                shares: 0,
                profile_views: 0,
              };

              // Update connection with latest counts
              await supabaseClient
                .from('social_connections')
                .update({
                  posts_count: totalPosts,
                })
                .eq('id', connection.id);
            }
          }

          // Update connection with latest counts even if no posts exist
          // Keep followers_count as-is (Reddit doesn't expose follower count via API).
        }
        break;

      default:
        throw new Error(`Analytics sync not implemented for ${platform}`);
    }

    // Store analytics data
    if (analyticsRows.length > 0) {
      const { error: analyticsError } = await supabaseClient
        .from('social_analytics')
        .upsert(analyticsRows, {
          onConflict: 'connection_id,date',
        });

      if (analyticsError) {
        console.error('Analytics storage error:', analyticsError);
        throw new Error(
          `Failed to save analytics data: ${analyticsError.message || 'unknown error'}`
        );
      }
      analyticsData = analyticsRows[analyticsRows.length - 1];
    } else if (Object.keys(analyticsData).length > 0) {
      const { error: analyticsError } = await supabaseClient
        .from('social_analytics')
        .upsert({
          connection_id: connection.id,
          ...analyticsData,
        }, {
          onConflict: 'connection_id,date',
        });

      if (analyticsError) {
        console.error('Analytics storage error:', analyticsError);
        throw new Error(
          `Failed to save analytics data: ${analyticsError.message || 'unknown error'}`
        );
      }
    }

    return new Response(JSON.stringify({ success: true, data: analyticsData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Analytics sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage, rateLimit: rateLimitInfo }), {
      status: rateLimitInfo?.status || 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
