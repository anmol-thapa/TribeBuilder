import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { decryptTokens } from "../_shared/encryption.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('[Instagram Post] === Function invoked ===');
  console.log('[Instagram Post] Method:', req.method);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('[Instagram Post] Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    console.log('[Instagram Post] Initializing Supabase client');

    // Check if this is an internal service call or user call
    const authHeader = req.headers.get('Authorization');
    let userId: string;
    let supabaseClient;

    if (authHeader?.includes(serviceRoleKey)) {
      console.log('[Instagram Post] Service role authentication detected');
      // Internal call from scheduled posts processor
      supabaseClient = createClient(supabaseUrl, serviceRoleKey);
      
      const body = await req.json();
      userId = body.user_id;
      console.log('[Instagram Post] User ID from body:', userId);
      
      if (!userId) {
        console.error('[Instagram Post] No user_id provided in service call');
        throw new Error('user_id is required for service calls');
      }
    } else {
      console.log('[Instagram Post] User authentication detected');
      // Regular user call
      supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: { Authorization: authHeader! },
        },
      });

      const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
      
      if (authError) {
        console.error('[Instagram Post] Auth error:', authError.message);
        throw new Error('Authentication failed');
      }
      
      if (!user) {
        console.error('[Instagram Post] No user found in session');
        throw new Error('Unauthorized');
      }
      
      userId = user.id;
      console.log('[Instagram Post] Authenticated user ID:', userId);
    }

    // Parse and validate request body
    console.log('[Instagram Post] Parsing request body');
    const bodyText = await req.text();
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch {
      body = {};
    }
    
    const InstagramPostSchema = z.object({
      caption: z.string().min(1, 'Caption is required').max(2200, 'Caption must be 2200 characters or less'),
      media_url: z.string().url('Valid media URL is required'),
      media_type: z.enum(['IMAGE', 'VIDEO', 'CAROUSEL']).default('IMAGE'),
      user_id: z.string().uuid().optional(),
    });

    const validationResult = InstagramPostSchema.safeParse(body);
    
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      console.error('[Instagram Post] Validation failed:', errors);
      throw new Error(`Validation failed: ${errors}`);
    }

    const { caption, media_url, media_type } = validationResult.data;
    console.log('[Instagram Post] Caption length:', caption.length);
    console.log('[Instagram Post] Media URL:', media_url);
    console.log('[Instagram Post] Media type:', media_type);

    // Rate limiting check
    console.log('[Instagram Post] Checking rate limit');
    const { data: rateLimitCheck } = await supabaseClient.rpc('check_rate_limit', {
      endpoint_name: 'instagram-post',
      identifier_value: userId,
      max_requests: 25,
      window_minutes: 60
    });

    if (!rateLimitCheck) {
      console.warn('[Instagram Post] Rate limit exceeded for user:', userId);
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    console.log('[Instagram Post] Rate limit check passed');

    // Get user's Instagram connection
    console.log('[Instagram Post] Fetching Instagram connection for user');
    const { data: connection, error: connectionError } = await supabaseClient
      .from('social_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'instagram')
      .eq('is_active', true)
      .single();

    if (connectionError) {
      console.error('[Instagram Post] Connection fetch error:', connectionError.message);
      throw new Error('Instagram account not connected');
    }

    if (!connection) {
      console.error('[Instagram Post] No active Instagram connection found');
      throw new Error('Instagram account not connected');
    }

    console.log('[Instagram Post] Connection found:', connection.id);
    console.log('[Instagram Post] Username:', connection.username);
    console.log('[Instagram Post] Platform user ID:', connection.platform_user_id);

    // Decrypt access token
    console.log('[Instagram Post] Decrypting access token');
    const decryptedTokens = await decryptTokens({
      access_token: connection.access_token,
    });
    const accessToken = decryptedTokens.access_token!;
    console.log('[Instagram Post] Access token decrypted successfully');

    // Instagram Content Publishing API requires a Business or Creator account
    // Step 1: Create a media container
    console.log('[Instagram Post] Step 1: Creating media container');
    
    const containerParams = new URLSearchParams({
      access_token: accessToken,
      caption: caption,
    });
    
    if (media_type === 'IMAGE') {
      containerParams.append('image_url', media_url);
    } else if (media_type === 'VIDEO') {
      containerParams.append('video_url', media_url);
      containerParams.append('media_type', 'VIDEO');
    }

    const containerResponse = await fetch(
      `https://graph.facebook.com/v18.0/${connection.platform_user_id}/media`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: containerParams,
      }
    );

    console.log('[Instagram Post] Container response status:', containerResponse.status);
    const containerData = await containerResponse.json();
    
    if (containerData.error) {
      console.error('[Instagram Post] Container creation failed:', JSON.stringify(containerData.error));
      throw new Error(containerData.error.message || 'Failed to create media container');
    }

    const containerId = containerData.id;
    console.log('[Instagram Post] Media container created:', containerId);

    // Step 2: Publish the container
    console.log('[Instagram Post] Step 2: Publishing media container');
    
    // For videos, we need to wait for processing
    if (media_type === 'VIDEO') {
      console.log('[Instagram Post] Video detected, checking processing status');
      let status = 'IN_PROGRESS';
      let attempts = 0;
      const maxAttempts = 30;
      
      while (status === 'IN_PROGRESS' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        
        const statusResponse = await fetch(
          `https://graph.facebook.com/v18.0/${containerId}?fields=status_code&access_token=${accessToken}`
        );
        const statusData = await statusResponse.json();
        status = statusData.status_code;
        attempts++;
        console.log('[Instagram Post] Video processing status:', status, 'Attempt:', attempts);
      }
      
      if (status !== 'FINISHED') {
        console.error('[Instagram Post] Video processing failed or timed out. Status:', status);
        throw new Error('Video processing failed or timed out');
      }
      console.log('[Instagram Post] Video processing completed');
    }

    const publishResponse = await fetch(
      `https://graph.facebook.com/v18.0/${connection.platform_user_id}/media_publish`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          access_token: accessToken,
          creation_id: containerId,
        }),
      }
    );

    console.log('[Instagram Post] Publish response status:', publishResponse.status);
    const publishData = await publishResponse.json();
    
    if (publishData.error) {
      console.error('[Instagram Post] Publish failed:', JSON.stringify(publishData.error));
      throw new Error(publishData.error.message || 'Failed to publish to Instagram');
    }

    const mediaId = publishData.id;
    console.log('[Instagram Post] Post published successfully! Media ID:', mediaId);

    // Store the post record
    console.log('[Instagram Post] Storing post record in database');
    const { data: postRecord, error: postError } = await supabaseClient
      .from('social_posts')
      .insert({
        connection_id: connection.id,
        platform_post_id: mediaId,
        content: caption,
        media_urls: [media_url],
        post_url: `https://www.instagram.com/p/${mediaId}/`,
        posted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (postError) {
      console.error('[Instagram Post] Failed to store post record:', postError.message);
      // Don't throw - the post was successful, just logging failed
    } else {
      console.log('[Instagram Post] Post record stored:', postRecord?.id);
    }

    console.log('[Instagram Post] === Function completed successfully ===');

    return new Response(
      JSON.stringify({
        success: true,
        post_id: mediaId,
        message: 'Successfully posted to Instagram',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[Instagram Post] === Error occurred ===');
    console.error('[Instagram Post] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[Instagram Post] Error message:', errorMessage);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
