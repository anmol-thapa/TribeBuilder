import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { decryptTokens } from "../_shared/encryption.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Validate request body with Zod
    const TikTokPostSchema = z.object({
      videoUrl: z.string().url().regex(/^https?:\/\//, 'URL must use http or https protocol'),
      caption: z.string().max(2200, 'Caption cannot exceed 2200 characters').optional(),
      connectionId: z.string().uuid('Invalid connection ID format').optional(),
    });

    const body = await req.json();
    const validationResult = TikTokPostSchema.safeParse(body);
    
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new Error(`Validation failed: ${errors}`);
    }

    let { videoUrl, caption, connectionId } = validationResult.data;

    console.log('Posting to TikTok for user:', user.id);

    // If URL is from our storage, generate a fresh signed URL
    if (videoUrl.includes('/storage/v1/object/')) {
      const pathMatch = videoUrl.match(/\/post-videos\/(.+?)(?:\?|$)/);
      if (pathMatch) {
        const filePath = decodeURIComponent(pathMatch[1]);
        console.log('Generating signed URL for TikTok post, path:', filePath);
        const { data: signedUrlData, error: signedError } = await supabase.storage
          .from('post-videos')
          .createSignedUrl(filePath, 3600); // 1 hour expiry for TikTok
        
        if (signedError || !signedUrlData?.signedUrl) {
          throw new Error('Failed to generate signed URL for video');
        }
        videoUrl = signedUrlData.signedUrl;
        console.log('Using signed URL for TikTok upload');
      }
    }

    // Get TikTok connection
    let query = supabase
      .from('social_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', 'tiktok')
      .eq('is_active', true);

    if (connectionId) {
      query = query.eq('id', connectionId);
    }

    const { data: connection, error: connError } = await query.single();

    if (connError || !connection) {
      throw new Error('TikTok account not connected');
    }

    // Decrypt access token before use
    const decryptedTokens = await decryptTokens({
      access_token: connection.access_token,
    });

    console.log('TikTok connection found:', {
      username: connection.username,
      hasToken: !!connection.access_token,
    });

    // Step 1: Initialize video upload
    const initResponse = await fetch('https://open.tiktokapis.com/v2/post/publish/inbox/video/init/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${decryptedTokens.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_info: {
          source: 'FILE_URL',
          video_url: videoUrl,
        },
        post_info: {
          title: caption || '',
          privacy_level: 'SELF_ONLY', // Can be PUBLIC_TO_EVERYONE, MUTUAL_FOLLOW_FRIENDS, or SELF_ONLY
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
          video_cover_timestamp_ms: 1000,
        },
      }),
    });

    if (!initResponse.ok) {
      const errorText = await initResponse.text();
      console.error('TikTok post failed:', errorText);
      throw new Error('Failed to publish video to TikTok');
    }

    const result = await initResponse.json();
    console.log('TikTok post result:', result);

    // Store post record
    const { error: postError } = await supabase
      .from('social_posts')
      .insert({
        user_id: user.id,
        connection_id: connection.id,
        platform: 'tiktok',
        content: caption,
        media_urls: [videoUrl],
        platform_post_id: result.data.publish_id,
        status: 'published',
        posted_at: new Date().toISOString(),
      });

    if (postError) {
      console.error('Error storing post record:', postError);
      // Continue anyway - post was successful on TikTok
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: result.data,
        message: 'Video uploaded to TikTok successfully' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error posting to TikTok:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
