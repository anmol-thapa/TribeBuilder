import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient, User, LoginResponse } from '@/lib/api';
import { useArtistStore } from '@/stores/artistStore';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { updateArtistData, clearArtistData, setUploadedFiles } = useArtistStore();
  const { toast: showToast } = useToast();

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email || '',
          created_at: session.user.created_at || '',
        });
      } else {
        setUser(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email || '',
          created_at: session.user.created_at || '',
        });
      }
      setIsLoading(false);
    });

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    // Supabase is the source of truth for auth/session
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      showToast({
        title: 'Supabase login failed',
        description: error.message,
        variant: 'destructive',
        duration: 6000,
      });
      throw error;
    }
    if (data?.user) {
      setUser({
        id: data.user.id,
        email: data.user.email || '',
        created_at: data.user.created_at || '',
      });
    }

    // Also log into API/JWT to keep the users table/token for other features
    try {
      const apiResp: LoginResponse = await apiClient.login(email, password);
      // Optionally hydrate artist/files if needed
      setUser(apiResp.user);
      try {
        const userData = await apiClient.getCurrentUser();
        if (userData.artist) {
          updateArtistData({
            artistName: userData.artist.artist_name || '',
            genre: userData.artist.genre || '',
            bio: userData.artist.bio || '',
          });
        }
        try {
          const filesData = await apiClient.getUploadedFiles();
          if (filesData.files) {
            setUploadedFiles(filesData.files);
          }
        } catch {
          // no files
        }
      } catch {
        // ignore artist/files errors
      }
    } catch (apiErr: any) {
      console.warn('API login failed (users table/token)', apiErr?.message || apiErr);
    }
  };

  const register = async (email: string, password: string) => {
    // Create Supabase user
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });

    if (error) {
      showToast({
        title: 'Supabase signup failed',
        description: error.message,
        variant: 'destructive',
        duration: 6000,
      });
      throw error;
    }

    // Also create row in users table for other app features
    try {
      await apiClient.register({ email, password });
    } catch (apiErr: any) {
      console.warn('API register failed (users table)', apiErr?.message || apiErr);
    }

    showToast({
      title: 'Check your email',
      description: 'Please verify your email before signing in.',
      duration: 6000,
    });
  };

  const logout = () => {
    supabase.auth.signOut().catch(err => console.warn('Supabase signOut failed', err));
    setUser(null);
    clearArtistData();
    apiClient.logout();
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
