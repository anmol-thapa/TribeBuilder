// Social Media API Configuration
// This file contains OAuth URLs for each platform
// Each user will connect their OWN account through these OAuth flows

// Meta App ID (public - for Facebook)
export const META_APP_ID = "1101468621955068";

// Instagram App ID (public - separate from Meta/Facebook)
export const INSTAGRAM_APP_ID = "1408252954304770";
const SUPABASE_FUNCTION_URL =
  `${import.meta.env.VITE_SUPABASE_URL || "https://your-supabase-project.supabase.co"}/functions/v1`;

export const socialApiConfig = {
  // X/Twitter OAuth 1.0a (handled by x-oauth-callback function)
  twitter: {
    authUrl: null, // Handled programmatically in useXConnection
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
  },

  // Instagram Graph API (separate app from Facebook)
  // Set up at https://developers.facebook.com/
  instagram: {
    authUrl: `https://api.instagram.com/oauth/authorize?client_id=${INSTAGRAM_APP_ID}&redirect_uri=${SUPABASE_FUNCTION_URL}/instagram-oauth-callback&scope=user_profile,user_media&response_type=code`,
    scopes: ["user_profile", "user_media"],
  },

  // Facebook Graph API (uses Meta App credentials - shared with Instagram)
  // Set up at https://developers.facebook.com/
  facebook: {
    authUrl: `https://www.facebook.com/v18.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${SUPABASE_FUNCTION_URL}/social-auth&scope=pages_show_list,pages_read_engagement,pages_manage_posts&state=facebook`,
    scopes: ["pages_show_list", "pages_read_engagement", "pages_manage_posts"],
  },

  // LinkedIn API
  // Set up at https://www.linkedin.com/developers/
  linkedin: {
    authUrl: `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${
      import.meta.env.VITE_LINKEDIN_CLIENT_ID || "YOUR_LINKEDIN_CLIENT_ID"
    }&redirect_uri=${SUPABASE_FUNCTION_URL}/social-auth&scope=r_liteprofile%20r_emailaddress%20w_member_social&state=linkedin`,
    scopes: ["r_liteprofile", "r_emailaddress", "w_member_social"],
  },

  // YouTube Data API (Google OAuth)
  // Set up at https://console.cloud.google.com/
  youtube: {
    authUrl: `https://accounts.google.com/o/oauth2/v2/auth?client_id=${
      import.meta.env.VITE_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID"
    }&redirect_uri=${SUPABASE_FUNCTION_URL}/social-auth&response_type=code&scope=https://www.googleapis.com/auth/youtube.readonly%20https://www.googleapis.com/auth/youtube.upload&access_type=offline&state=youtube&prompt=consent`,
    scopes: ["https://www.googleapis.com/auth/youtube.readonly", "https://www.googleapis.com/auth/youtube.upload"],
  },

  // Reddit API
  // Set up at https://www.reddit.com/prefs/apps
  reddit: {
    authUrl: `https://www.reddit.com/api/v1/authorize?client_id=${
      import.meta.env.VITE_REDDIT_CLIENT_ID || "YOUR_REDDIT_CLIENT_ID"
    }&response_type=code&state=reddit&redirect_uri=${SUPABASE_FUNCTION_URL}/social-auth&duration=permanent&scope=identity,read,submit`,
    scopes: ["identity", "read", "submit"],
  },

  // TikTok API
  // Set up at https://developers.tiktok.com/
  tiktok: {
    authUrl: `https://www.tiktok.com/v2/auth/authorize?client_key=${
      import.meta.env.VITE_TIKTOK_CLIENT_KEY || "YOUR_TIKTOK_CLIENT_KEY"
    }&response_type=code&scope=user.info.basic,video.publish&redirect_uri=${SUPABASE_FUNCTION_URL}/tiktok-oauth-callback&state=tiktok`,
    scopes: ["user.info.basic", "video.publish"],
  },
};

export default socialApiConfig;
