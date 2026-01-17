import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// This is your verify token - Instagram will send this to verify your webhook
const VERIFY_TOKEN = Deno.env.get('INSTAGRAM_WEBHOOK_VERIFY_TOKEN') || 'tribebuilder_instagram_webhook_2024';

serve(async (req) => {
  const url = new URL(req.url);
  
  console.log('[Instagram Webhook] === Request received ===');
  console.log('[Instagram Webhook] Method:', req.method);
  console.log('[Instagram Webhook] URL:', req.url);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // GET request = Instagram verification challenge
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    console.log('[Instagram Webhook] Verification request received');
    console.log('[Instagram Webhook] Mode:', mode);
    console.log('[Instagram Webhook] Token received:', token ? '***' : 'none');
    console.log('[Instagram Webhook] Challenge:', challenge);

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('[Instagram Webhook] Verification successful!');
      // Return the challenge to complete verification
      return new Response(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    } else {
      console.error('[Instagram Webhook] Verification failed - token mismatch');
      return new Response('Forbidden', { status: 403 });
    }
  }

  // POST request = Actual webhook event from Instagram
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      console.log('[Instagram Webhook] Event received:', JSON.stringify(body, null, 2));

      // Process webhook events
      const { object, entry } = body;
      
      if (object === 'instagram') {
        console.log('[Instagram Webhook] Processing Instagram event');
        
        for (const event of entry || []) {
          console.log('[Instagram Webhook] Event ID:', event.id);
          console.log('[Instagram Webhook] Event time:', event.time);
          
          // Handle different event types
          if (event.messaging) {
            console.log('[Instagram Webhook] Messaging event detected');
            // Handle direct messages
          }
          
          if (event.changes) {
            for (const change of event.changes) {
              console.log('[Instagram Webhook] Change field:', change.field);
              console.log('[Instagram Webhook] Change value:', JSON.stringify(change.value));
              
              // Handle mentions, comments, etc.
              if (change.field === 'mentions') {
                console.log('[Instagram Webhook] Mention received');
              } else if (change.field === 'comments') {
                console.log('[Instagram Webhook] Comment received');
              }
            }
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error) {
      console.error('[Instagram Webhook] Error processing event:', error);
      return new Response(JSON.stringify({ error: 'Failed to process webhook' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response('Method not allowed', { status: 405 });
});
