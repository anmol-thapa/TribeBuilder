import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { decryptTokens } from "../_shared/encryption.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Facebook post request received');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const body = await req.json();

    // Check for internal service role call
    let userId: string;
    if (body._internal_user_id) {
      const authHeader = req.headers.get('Authorization');
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (!authHeader || !authHeader.includes(serviceRoleKey!)) {
        throw new Error('Unauthorized service role call');
      }
      
      userId = body._internal_user_id;
      console.log('Service role call for user:', userId);
    } else {
      // Get authenticated user
      const authHeader = req.headers.get('Authorization')!;
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        throw new Error('Unauthorized');
      }
      userId = user.id;
    }

    // Validate request body with Zod
    const FacebookPostSchema = z.object({
      message: z.string().max(63206, 'Message cannot exceed 63206 characters').optional(),
      pageId: z.string().optional(),
      mediaUrls: z.array(z.string().url().regex(/^https?:\/\//, 'URL must use http or https protocol')).optional(),
      _internal_user_id: z.string().uuid().optional(),
    }).refine(
      (data) => data.message || (data.mediaUrls && data.mediaUrls.length > 0),
      { message: 'Either message or media is required' }
    );

    const validationResult = FacebookPostSchema.safeParse(body);
    
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new Error(`Validation failed: ${errors}`);
    }

    const { message, pageId, mediaUrls } = validationResult.data;

    // Get user's Facebook connection
    const { data: connection, error: connectionError } = await supabase
      .from('social_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'facebook')
      .eq('is_active', true)
      .single();

    if (connectionError || !connection) {
      throw new Error('Facebook account not connected');
    }

    // Decrypt access token before use
    const decryptedTokens = await decryptTokens({
      access_token: connection.access_token,
    });
    const accessToken = decryptedTokens.access_token!;

    // Determine the target (page or user profile)
    const targetId = pageId || 'me';

    let fbData;
    let fbResponse;

    // Check if we have media to upload
    if (mediaUrls && mediaUrls.length > 0) {
      let firstMediaUrl = mediaUrls[0];
      const isVideo = firstMediaUrl.includes('.mp4') || firstMediaUrl.includes('.mov') || firstMediaUrl.includes('.webm');

      console.log('Uploading media to Facebook:', { firstMediaUrl, isVideo, targetId });

      try {
        // If URL is from our storage, generate a fresh signed URL
        if (firstMediaUrl.includes('/storage/v1/object/')) {
          const pathMatch = firstMediaUrl.match(/\/post-videos\/(.+?)(?:\?|$)/);
          if (pathMatch) {
            const filePath = decodeURIComponent(pathMatch[1]);
            console.log('Generating signed URL for path:', filePath);
            const { data: signedUrlData, error: signedError } = await supabase.storage
              .from('post-videos')
              .createSignedUrl(filePath, 600); // 10 min expiry
            
            if (signedError || !signedUrlData?.signedUrl) {
              throw new Error('Failed to generate signed URL for media');
            }
            firstMediaUrl = signedUrlData.signedUrl;
            console.log('Using signed URL for media fetch');
          }
        }

        // Download the media from storage
        const mediaResponse = await fetch(firstMediaUrl);
        if (!mediaResponse.ok) {
          throw new Error(`Failed to fetch media from storage: ${mediaResponse.status}`);
        }
        
        const mediaBlob = await mediaResponse.blob();
        console.log('Media blob size:', mediaBlob.size, 'type:', mediaBlob.type);
        
        // Get file extension
        const fileExt = firstMediaUrl.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `media.${fileExt}`;
        
        // Create form data for Facebook
        const formData = new FormData();
        formData.append('source', mediaBlob, fileName);
        if (message) {
          formData.append('message', message);
        }
        formData.append('access_token', accessToken);
        
        const endpoint = isVideo ? 'videos' : 'photos';
        console.log(`Posting to Facebook ${endpoint} endpoint`);
        
        fbResponse = await fetch(
          `https://graph.facebook.com/v21.0/${targetId}/${endpoint}`,
          {
            method: 'POST',
            body: formData,
          }
        );
        
        console.log('Facebook media upload response status:', fbResponse.status);
        
        if (!fbResponse.ok) {
          const errorData = await fbResponse.json();
          console.error('Facebook upload error:', errorData);
          throw new Error(errorData.error?.message || 'Facebook upload failed');
        }
      } catch (uploadError) {
        console.error('Error during Facebook media upload:', uploadError);
        throw uploadError;
      }
    } else {
      // Post text only
      fbResponse = await fetch(
        `https://graph.facebook.com/v21.0/${targetId}/feed`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: message,
            access_token: accessToken,
          }),
        }
      );
    }

    fbData = await fbResponse.json();

    if (!fbResponse.ok) {
      console.error('Facebook API error:', fbData);
      throw new Error(fbData.error?.message || 'Failed to post to Facebook');
    }

    console.log('Successfully posted to Facebook:', fbData);

    // Store the post in our database
    const { error: insertError } = await supabase
      .from('social_posts')
      .insert({
        connection_id: connection.id,
        platform_post_id: fbData.id,
        content: message || '',
        media_urls: mediaUrls || [],
        posted_at: new Date().toISOString(),
        followers_at_post: connection.followers_count || 0,
      });

    if (insertError) {
      console.error('Error storing post:', insertError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        postId: fbData.id,
        message: 'Posted successfully to Facebook'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
