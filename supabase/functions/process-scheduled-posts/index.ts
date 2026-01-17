import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("=== Process Scheduled Posts Function Called ===");

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get all posts that are scheduled and due to be posted
    const { data: scheduledPosts, error: fetchError } = await supabaseClient
      .from('scheduled_posts')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true });

    if (fetchError) {
      console.error('Error fetching scheduled posts:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${scheduledPosts?.length || 0} posts to process`);

    if (!scheduledPosts || scheduledPosts.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No posts to process', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];
    
    for (const post of scheduledPosts) {
      console.log(`Processing post ${post.id} for user ${post.user_id}`);
      
      try {
        // Process each platform
        const platformResults: Record<string, any> = {};
        
        for (const platform of post.platforms) {
          try {
            // Get user's connection for this platform
            const { data: connection, error: connError } = await supabaseClient
              .from('social_connections')
              .select('*')
              .eq('user_id', post.user_id)
              .eq('platform', platform === 'twitter' ? 'twitter' : platform)
              .eq('is_active', true)
              .maybeSingle();

            if (connError || !connection) {
              throw new Error(`${platform} account not connected`);
            }

            let postResult;

            if (platform === 'twitter') {
              // Call post-to-x function using service role
              postResult = await supabaseClient.functions.invoke('post-to-x', {
                body: {
                  content: post.content,
                  postId: post.id,
                  _internal_user_id: post.user_id,
                }
              });
            } else if (platform === 'reddit') {
              // Call reddit-post function with service role authorization
              postResult = await supabaseClient.functions.invoke('reddit-post', {
                body: {
                  content: post.content,
                  connectionId: connection.id,
                  title: post.content.substring(0, 300),
                  mediaUrls: post.media_urls || [],
                  _internal_user_id: post.user_id,
                }
              });
            } else if (platform === 'facebook') {
              // Call facebook-post function with service role authorization
              postResult = await supabaseClient.functions.invoke('facebook-post', {
                body: {
                  message: post.content,
                  mediaUrls: post.media_urls || [],
                  _internal_user_id: post.user_id,
                }
              });
            } else if (platform === 'linkedin' || platform === 'instagram') {
              // Not yet implemented
              throw new Error(`${platform} posting not yet implemented`);
            }

            if (postResult?.error) {
              throw postResult.error;
            }
            
            platformResults[platform] = postResult?.data || { success: true };
            console.log(`Successfully posted to ${platform} for post ${post.id}`);
          } catch (error: any) {
            console.error(`Error posting to ${platform}:`, error);
            platformResults[platform] = { error: error.message };
          }
        }

        // Check if any platform succeeded
        const hasSuccess = Object.values(platformResults).some(
          (result: any) => !result.error
        );
        const successfulPlatforms = Object.entries(platformResults)
          .filter(([_, result]: [string, any]) => !result.error)
          .map(([platform]) => platform);

        // Update post status
        const newStatus = hasSuccess ? 'published' : 'failed';
        const errorMessage = hasSuccess 
          ? null 
          : Object.entries(platformResults)
              .map(([platform, result]: [string, any]) => `${platform}: ${result.error}`)
              .join('; ');

        const { error: updateError } = await supabaseClient
          .from('scheduled_posts')
          .update({
            status: newStatus,
            post_results: platformResults,
            error_message: errorMessage,
            updated_at: new Date().toISOString(),
          })
          .eq('id', post.id);

        if (updateError) {
          console.error(`Failed to update post ${post.id}:`, updateError);
        }

        // Create notification for successful posts
        if (hasSuccess) {
          const platformList = successfulPlatforms.map(p => 
            p.charAt(0).toUpperCase() + p.slice(1)
          ).join(', ');
          
          const contentPreview = post.content.length > 50 
            ? post.content.substring(0, 50) + '...' 
            : post.content;

          await supabaseClient
            .from('notifications')
            .insert({
              user_id: post.user_id,
              type: 'success',
              title: 'Post Published',
              message: `Your post "${contentPreview}" was successfully published to ${platformList}`,
              metadata: {
                post_id: post.id,
                platforms: successfulPlatforms,
                post_results: platformResults,
              },
            });
          
          console.log(`Created notification for user ${post.user_id}`);
        }

        results.push({
          postId: post.id,
          status: newStatus,
          platforms: platformResults,
        });

      } catch (error: any) {
        console.error(`Error processing post ${post.id}:`, error);
        
        // Mark post as failed
        await supabaseClient
          .from('scheduled_posts')
          .update({
            status: 'failed',
            error_message: error.message,
            updated_at: new Date().toISOString(),
          })
          .eq('id', post.id);

        results.push({
          postId: post.id,
          status: 'failed',
          error: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error("Error in process-scheduled-posts:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

