const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Types
export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface LoginResponse {
  message: string;
  token: string;
  user: User;
}

export interface RegisterData {
  email: string;
  password: string;
}

export interface Artist {
  id: string;
  user_id: string;
  artist_name: string;
  real_name?: string;
  bio?: string;
  genre?: string;
  location?: string;
  website_url?: string;
  spotify_artist_id?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateArtistData {
  artist_name: string;
  real_name?: string;
  bio?: string;
  genre?: string;
  location?: string;
  website_url?: string;
  spotify_artist_id?: string;
}

export interface Persona {
  id: string;
  artist_id: string;
  persona_name: string;
  description?: string;
  tone?: string;
  target_audience?: string;
  key_themes?: string[];
  voice_characteristics?: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatePersonaData {
  persona_name: string;
  description?: string;
  tone?: string;
  target_audience?: string;
  key_themes?: string[];
  voice_characteristics?: any;
}

export interface GenerateContentRequest {
  content_type: 'announcement' | 'release' | 'news' | 'social_post' | 'story';
  context?: string;
  max_length?: number;
  variations?: number;
  template_id?: string;
  provider?: 'groq' | 'cohere' | 'openai' | 'huggingface' | 'auto';
}

export interface GeneratedContent {
  id: string;
  content: string;
  quality_score: number;
  variation_id: number;
  model_used: string;
  saved_at: string;
}

export interface ContentGenerationResponse {
  message: string;
  generated_content: GeneratedContent[];
  content_saved: boolean;
  persona_used: {
    name: string;
    tone: string;
    themes: string[];
  };
  generation_metadata: {
    model_used: string;
    variations_generated: number;
    average_quality_score: number | null;
  };
}

export interface Template {
  id: string;
  template_name: string;
  template_type: string;
  template_content: string;
  variables: any;
  created_at: string;
  is_active: boolean;
}

export interface HealthCheckResponse {
  status: string;
  message: string;
  timestamp: string;
  environment: string;
}

export class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL = API_BASE_URL) {
    this.baseURL = baseURL;
    // Load token from localStorage on initialization
    this.token = localStorage.getItem('auth_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  getToken(): string | null {
    return this.token || this.loadSupabaseAccessToken();
  }

  // Fallback: use Supabase access token if API JWT is missing
  private loadSupabaseAccessToken(): string | null {
    if (typeof localStorage === 'undefined') return null;

    const keys = Object.keys(localStorage).filter(
      (k) => k.startsWith('sb-') && k.endsWith('-auth-token')
    );

    for (const key of keys) {
      try {
        const stored = localStorage.getItem(key);
        if (!stored) continue;
        const parsed = JSON.parse(stored);
        const accessToken =
          parsed?.access_token ||
          parsed?.currentSession?.access_token ||
          parsed?.currentSession?.provider_token;
        if (accessToken) {
          this.token = accessToken;
          return accessToken;
        }
      } catch {
        // ignore parsing errors and continue
      }
    }

    return null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const headers: HeadersInit = {
      ...options.headers,
    };

    // Add Content-Type header for JSON requests
    if (options.body && typeof options.body === 'string') {
      headers['Content-Type'] = 'application/json';
    }

    const authToken = this.getToken();
    // Add Authorization header if token exists (API JWT or Supabase access token)
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    const response = await fetch(url, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: `HTTP error! status: ${response.status}`
      }));
      throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // ==================== Authentication ====================

  async register(data: RegisterData): Promise<{ message: string }> {
    return this.request('/users/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>('/users/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    // Automatically set the token after successful login
    if (response.token) {
      this.setToken(response.token);
    }

    return response;
  }

  logout() {
    this.setToken(null);
  }

  async getCurrentUser(): Promise<{ user: User; artist: Artist | null }> {
    return this.request('/users/me');
  }

  // ==================== Artists ====================

  async getArtistProfile(): Promise<Artist> {
    return this.request('/artists/profile');
  }

  async createArtistProfile(data: CreateArtistData): Promise<{ message: string; artist: Artist }> {
    return this.request('/artists/profile', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateArtistProfile(data: Partial<CreateArtistData>): Promise<{ message: string; artist: Artist }> {
    return this.request('/artists/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // ==================== Personas ====================

  async getActivePersona(): Promise<Persona | null> {
    try {
      const response = await this.request<{ persona: Persona }>('/personas/persona');
      return response.persona || null;
    } catch (error) {
      return null;
    }
  }

  async getQuestionnaireQuestions(): Promise<{ questions: any[]; total: number }> {
    return this.request('/personas/questionnaire/questions');
  }

  async submitQuestionnaire(responses: Array<{
    question_key: string;
    question_text: string;
    answer_text: string;
    answer_type: string;
  }>): Promise<{ message: string; persona_id: string; responses_count: number }> {
    return this.request('/personas/questionnaire', {
      method: 'POST',
      body: JSON.stringify({ responses }),
    });
  }

  async createPersonaFromArtistData(artistData: {
    artistName: string;
    genre: string;
    bio: string;
    targetAudience?: string;
    influences?: string;
    stageName?: string;
  }): Promise<{ message: string; persona_id: string }> {
    // Convert artist form data to questionnaire responses
    const responses = [
      {
        question_key: 'musical_style',
        question_text: 'How would you describe your musical style and genre?',
        answer_text: `${artistData.genre}. ${artistData.bio}`,
        answer_type: 'text'
      },
      {
        question_key: 'target_audience',
        question_text: 'Who is your ideal listener or fan?',
        answer_text: artistData.targetAudience || 'Music enthusiasts who appreciate my genre',
        answer_type: 'text'
      },
      {
        question_key: 'inspiration',
        question_text: 'What or who inspires your music and creativity?',
        answer_text: artistData.influences || 'Various artists and life experiences',
        answer_type: 'text'
      },
      {
        question_key: 'personality_tone',
        question_text: 'How would you describe your personality in social media posts?',
        answer_text: 'authentic and engaging',
        answer_type: 'text'
      },
      {
        question_key: 'key_messages',
        question_text: 'What key messages or themes do you want to communicate to your fans?',
        answer_text: artistData.bio,
        answer_type: 'text'
      }
    ];

    return this.submitQuestionnaire(responses);
  }

  async updatePersona(personaId: string, data: Partial<CreatePersonaData>): Promise<{ message: string; persona: Persona }> {
    return this.request(`/personas/${personaId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async setActivePersona(personaId: string): Promise<{ message: string }> {
    return this.request(`/personas/${personaId}/activate`, {
      method: 'PUT',
    });
  }

  // ==================== Uploads ====================

  async uploadQuestionnaireFile(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);

    return this.request('/uploads/persona/questionnaire', {
      method: 'POST',
      body: formData,
      // Don't set Content-Type header - browser will set it with boundary
      headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {},
    });
  }

  async uploadTranscriptFile(file: File, sourceType: string = 'podcast'): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('source_type', sourceType);

    return this.request('/uploads/persona/transcript', {
      method: 'POST',
      body: formData,
      headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {},
    });
  }

  async getUploadedFiles(): Promise<any> {
    return this.request('/uploads/persona/files');
  }

  // ==================== Content Generation ====================

  async generateContent(params: GenerateContentRequest): Promise<ContentGenerationResponse> {
    return this.request('/content/generate', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async scoreContentQuality(content: string): Promise<any> {
    return this.request('/content/quality-score', {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async getContentHistory(params?: {
    limit?: number;
    offset?: number;
    content_type?: string;
    approval_status?: string;
  }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.content_type) queryParams.append('content_type', params.content_type);
    if (params?.approval_status) queryParams.append('approval_status', params.approval_status);

    const query = queryParams.toString();
    return this.request(`/content/history${query ? `?${query}` : ''}`);
  }

  // ==================== Templates ====================

  async getTemplates(type?: string): Promise<{ templates: Template[]; total: number }> {
    const query = type ? `?type=${encodeURIComponent(type)}` : '';
    return this.request(`/content/templates${query}`);
  }

  async createTemplate(data: any): Promise<{ message: string; template: Template }> {
    return this.request('/content/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async processTemplate(templateId: string, variables: any): Promise<any> {
    return this.request(`/content/templates/${templateId}/process`, {
      method: 'POST',
      body: JSON.stringify({ variables }),
    });
  }

  async getTemplateSuggestions(contentType: string, context?: string): Promise<any> {
    const queryParams = new URLSearchParams({ content_type: contentType });
    if (context) queryParams.append('context', context);

    return this.request(`/content/templates/suggestions?${queryParams.toString()}`);
  }

  async initializeDefaultTemplates(): Promise<{ message: string }> {
    return this.request('/content/templates/initialize-defaults', {
      method: 'POST',
    });
  }

  // ==================== Health Check ====================

  async healthCheck(): Promise<HealthCheckResponse> {
    return this.request('/health');
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
