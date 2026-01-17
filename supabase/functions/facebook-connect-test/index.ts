import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Facebook connection request received');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Get access token from request body (from client-side SDK login)
    const body = await req.json();
    const userToken = body.accessToken;

    console.log('Received token from SDK, length:', userToken?.length);

    if (!userToken || userToken.length < 20) {
      throw new Error('Facebook access token is missing or invalid');
    }

    // Validate the token by inspecting it
    console.log('Validating Facebook token...');
    const debugUrl = `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(userToken)}&access_token=${encodeURIComponent(userToken)}`;
    const debugResponse = await fetch(debugUrl);
    const debugData = await debugResponse.json();
    
    console.log('Token validation response:', JSON.stringify(debugData, null, 2));

    if (debugData.error) {
      console.error('Token validation failed:', debugData.error);
      throw new Error(`Invalid Facebook token: ${debugData.error.message}`);
    }

    // Fetch user data from Facebook using the user token
    console.log('Fetching Facebook user data...');
    const fbResponse = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name,email&access_token=${encodeURIComponent(userToken)}`);
    const fbData = await fbResponse.json();

    if (!fbResponse.ok || fbData.error) {
      console.error('Facebook API error:', fbData);
      const errorMsg = fbData.error?.message || 'Failed to fetch Facebook user data';
      const errorType = fbData.error?.type || 'Unknown';
      throw new Error(`Facebook API Error (${errorType}): ${errorMsg}`);
    }

    console.log('Facebook user data:', fbData);

    // Fetch page data if available
    const pagesResponse = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${encodeURIComponent(userToken)}`);
    const pagesData = await pagesResponse.json();

    console.log('Facebook pages:', pagesData);

    // Store the connection in database
    const { data: existingConnection, error: fetchError } = await supabase
      .from('social_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', 'facebook')
      .eq('is_active', true)
      .maybeSingle();

    if (fetchError) throw fetchError;

    const connectionData = {
      user_id: user.id,
      platform: 'facebook',
      platform_user_id: fbData.id,
      username: fbData.name,
      access_token: userToken,
      is_active: true,
      profile_data: {
        email: fbData.email,
        pages: pagesData.data || []
      }
    };

    if (existingConnection) {
      const { error: updateError } = await supabase
        .from('social_connections')
        .update(connectionData)
        .eq('id', existingConnection.id);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from('social_connections')
        .insert(connectionData);

      if (insertError) throw insertError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: fbData,
        pages: pagesData.data || []
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
