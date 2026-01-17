import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encode as base64url } from 'https://deno.land/std@0.177.0/encoding/base64url.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Function to verify Facebook signed request
async function parseSignedRequest(signedRequest: string, appSecret: string) {
  const [encodedSig, payload] = signedRequest.split('.', 2);
  
  // Decode the data
  const sig = new Uint8Array(atob(encodedSig.replace(/-/g, '+').replace(/_/g, '/')).split('').map(c => c.charCodeAt(0)));
  const data = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  
  // Verify signature
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const expectedSig = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  );
  
  // Compare signatures
  if (sig.length !== expectedSig.length) {
    throw new Error('Invalid signature length');
  }
  
  for (let i = 0; i < sig.length; i++) {
    if (sig[i] !== expectedSig[i]) {
      throw new Error('Invalid signature');
    }
  }
  
  return data;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Facebook data deletion request received');
    console.log('Request method:', req.method);
    console.log('Content-Type:', req.headers.get('content-type'));

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    // Use unified META_APP_SECRET for both Facebook and Instagram
    const appSecret = Deno.env.get('META_APP_SECRET')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Handle GET requests (Facebook validation)
    if (req.method === 'GET') {
      console.log('GET request - Facebook validation');
      return new Response(
        JSON.stringify({ status: 'ok', message: 'Data deletion endpoint active' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the signed request from Facebook
    let signedRequest: string | null = null;
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await req.json();
      signedRequest = body.signed_request;
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      signedRequest = formData.get('signed_request') as string;
    } else {
      // Try to read as text and parse
      const text = await req.text();
      if (text) {
        try {
          const body = JSON.parse(text);
          signedRequest = body.signed_request;
        } catch {
          console.log('Could not parse request body');
        }
      }
    }

    if (!signedRequest) {
      console.log('No signed_request provided - might be a test request');
      return new Response(
        JSON.stringify({ 
          status: 'ok',
          message: 'Data deletion endpoint ready',
          url: `${supabaseUrl}/functions/v1/facebook-data-deletion`,
          confirmation_code: `test_${Date.now()}`
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify and parse the signed request
    console.log('Verifying and processing signed request');
    const data = await parseSignedRequest(signedRequest, appSecret);
    const userId = data.user_id;
    
    if (!userId) {
      throw new Error('No user_id in signed request');
    }

    console.log(`Processing deletion request for Facebook user: ${userId}`);

    // Find the user's connection
    const { data: connection, error: connectionError } = await supabase
      .from('social_connections')
      .select('user_id')
      .eq('platform', 'facebook')
      .eq('platform_user_id', userId)
      .single();

    if (connectionError) {
      console.error('Error finding connection:', connectionError);
    }

    if (connection) {
      // Delete social analytics
      const { error: analyticsError } = await supabase
        .from('social_analytics')
        .delete()
        .eq('connection_id', connection.user_id);

      if (analyticsError) {
        console.error('Error deleting analytics:', analyticsError);
      }

      // Delete social posts
      const { error: postsError } = await supabase
        .from('social_posts')
        .delete()
        .eq('connection_id', connection.user_id);

      if (postsError) {
        console.error('Error deleting posts:', postsError);
      }

      // Delete the connection
      const { error: deleteError } = await supabase
        .from('social_connections')
        .delete()
        .eq('platform', 'facebook')
        .eq('platform_user_id', userId);

      if (deleteError) {
        console.error('Error deleting connection:', deleteError);
        throw deleteError;
      }

      console.log(`Successfully deleted data for Facebook user: ${userId}`);
    }

    // Return confirmation URL and status code as per Facebook requirements
    const confirmationCode = `${userId}_${Date.now()}`;
    const statusUrl = `${supabaseUrl}/functions/v1/facebook-data-deletion?id=${confirmationCode}`;

    return new Response(
      JSON.stringify({
        url: statusUrl,
        confirmation_code: confirmationCode,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error processing data deletion:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
