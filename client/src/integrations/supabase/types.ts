export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      kv_store_eac2062e: {
        Row: {
          key: string
          user_id: string
          value: Json
        }
        Insert: {
          key: string
          user_id: string
          value: Json
        }
        Update: {
          key?: string
          user_id?: string
          value?: Json
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          metadata: Json | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          metadata?: Json | null
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          metadata?: Json | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      oauth_rate_limits: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          identifier: string
          request_count: number
          window_start: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          identifier: string
          request_count?: number
          window_start?: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          identifier?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      scheduled_posts: {
        Row: {
          content: string
          created_at: string
          error_message: string | null
          id: string
          media_urls: string[] | null
          platforms: string[]
          post_results: Json | null
          scheduled_for: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          error_message?: string | null
          id?: string
          media_urls?: string[] | null
          platforms: string[]
          post_results?: Json | null
          scheduled_for: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          error_message?: string | null
          id?: string
          media_urls?: string[] | null
          platforms?: string[]
          post_results?: Json | null
          scheduled_for?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      social_analytics: {
        Row: {
          comments: number | null
          connection_id: string
          created_at: string
          date: string
          engagement_rate: number | null
          followers_count: number | null
          id: string
          impressions: number | null
          likes: number | null
          profile_views: number | null
          reach: number | null
          shares: number | null
        }
        Insert: {
          comments?: number | null
          connection_id: string
          created_at?: string
          date: string
          engagement_rate?: number | null
          followers_count?: number | null
          id?: string
          impressions?: number | null
          likes?: number | null
          profile_views?: number | null
          reach?: number | null
          shares?: number | null
        }
        Update: {
          comments?: number | null
          connection_id?: string
          created_at?: string
          date?: string
          engagement_rate?: number | null
          followers_count?: number | null
          id?: string
          impressions?: number | null
          likes?: number | null
          profile_views?: number | null
          reach?: number | null
          shares?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "social_analytics_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "social_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_analytics_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "social_connections_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      social_connections: {
        Row: {
          access_token: string
          access_token_secret: string | null
          created_at: string
          display_name: string | null
          followers_count: number | null
          following_count: number | null
          id: string
          is_active: boolean | null
          platform: string
          platform_user_id: string
          posts_count: number | null
          profile_data: Json | null
          profile_image_url: string | null
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string
          user_handle: string | null
          user_id: string
          username: string
        }
        Insert: {
          access_token: string
          access_token_secret?: string | null
          created_at?: string
          display_name?: string | null
          followers_count?: number | null
          following_count?: number | null
          id?: string
          is_active?: boolean | null
          platform: string
          platform_user_id: string
          posts_count?: number | null
          profile_data?: Json | null
          profile_image_url?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_handle?: string | null
          user_id: string
          username: string
        }
        Update: {
          access_token?: string
          access_token_secret?: string | null
          created_at?: string
          display_name?: string | null
          followers_count?: number | null
          following_count?: number | null
          id?: string
          is_active?: boolean | null
          platform?: string
          platform_user_id?: string
          posts_count?: number | null
          profile_data?: Json | null
          profile_image_url?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_handle?: string | null
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      social_posts: {
        Row: {
          comments_count: number | null
          connection_id: string
          content: string | null
          created_at: string
          downvotes_count: number | null
          followers_at_post: number | null
          id: string
          likes_count: number | null
          media_urls: string[] | null
          platform_post_id: string
          post_url: string | null
          posted_at: string
          retweets_count: number | null
          shares_count: number | null
          updated_at: string
          upvotes_count: number | null
          views_count: number | null
        }
        Insert: {
          comments_count?: number | null
          connection_id: string
          content?: string | null
          created_at?: string
          downvotes_count?: number | null
          followers_at_post?: number | null
          id?: string
          likes_count?: number | null
          media_urls?: string[] | null
          platform_post_id: string
          post_url?: string | null
          posted_at: string
          retweets_count?: number | null
          shares_count?: number | null
          updated_at?: string
          upvotes_count?: number | null
          views_count?: number | null
        }
        Update: {
          comments_count?: number | null
          connection_id?: string
          content?: string | null
          created_at?: string
          downvotes_count?: number | null
          followers_at_post?: number | null
          id?: string
          likes_count?: number | null
          media_urls?: string[] | null
          platform_post_id?: string
          post_url?: string | null
          posted_at?: string
          retweets_count?: number | null
          shares_count?: number | null
          updated_at?: string
          upvotes_count?: number | null
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "social_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "social_connections_safe"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      social_connections_safe: {
        Row: {
          created_at: string | null
          display_name: string | null
          followers_count: number | null
          following_count: number | null
          has_access_token: boolean | null
          has_refresh_token: boolean | null
          id: string | null
          is_active: boolean | null
          platform: string | null
          platform_user_id: string | null
          posts_count: number | null
          profile_data: Json | null
          profile_image_url: string | null
          token_expires_at: string | null
          updated_at: string | null
          user_handle: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          followers_count?: number | null
          following_count?: number | null
          has_access_token?: never
          has_refresh_token?: never
          id?: string | null
          is_active?: boolean | null
          platform?: string | null
          platform_user_id?: string | null
          posts_count?: number | null
          profile_data?: Json | null
          profile_image_url?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_handle?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          followers_count?: number | null
          following_count?: number | null
          has_access_token?: never
          has_refresh_token?: never
          id?: string | null
          is_active?: boolean | null
          platform?: string | null
          platform_user_id?: string | null
          posts_count?: number | null
          profile_data?: Json | null
          profile_image_url?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_handle?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_rate_limit: {
        Args: {
          endpoint_name: string
          identifier_value: string
          max_requests?: number
          window_minutes?: number
        }
        Returns: boolean
      }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      get_user_connection_tokens: {
        Args: { connection_uuid: string }
        Returns: {
          access_token: string
          access_token_secret: string
          refresh_token: string
          token_expires_at: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
