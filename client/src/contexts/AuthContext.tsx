import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient, User, LoginResponse } from '@/lib/api';
import { useArtistStore } from '@/stores/artistStore';
import { supabase } from '@/integrations/supabase/client';

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

  useEffect(() => {
    // Check if user is already logged in (has token)
    const token = apiClient.getToken();
    if (token) {
      // Fetch current user data and artist profile
      apiClient.getCurrentUser()
        .then(async response => {
          setUser(response.user);

          // If user has an artist profile, load it into Zustand
          if (response.artist) {
            updateArtistData({
              artistName: response.artist.artist_name || '',
              genre: response.artist.genre || '',
              bio: response.artist.bio || '',
            });
          }

          // Fetch uploaded files
          try {
            const filesData = await apiClient.getUploadedFiles();
            if (filesData.files) {
              setUploadedFiles(filesData.files);
            }
          } catch (error) {
            console.log('No uploaded files found');
          }
        })
        .catch(error => {
          console.error('Failed to fetch user data:', error);
          // Invalid token, clear it
          apiClient.logout();
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, [updateArtistData, setUploadedFiles]);

  const login = async (email: string, password: string) => {
    try {
      const response: LoginResponse = await apiClient.login(email, password);
      setUser(response.user);

      // Also log into Supabase for social features (create if missing)
      try {
        const { error: supaError } = await supabase.auth.signInWithPassword({ email, password });
        if (supaError) {
          // If user not found, try to sign up and then sign in again
          const { error: signupError } = await supabase.auth.signUp({ email, password });
          if (signupError && !signupError.message?.toLowerCase().includes('existing')) {
            console.warn('Supabase signup failed (social features may be unavailable):', signupError.message);
          } else {
            const { error: retryError } = await supabase.auth.signInWithPassword({ email, password });
            if (retryError) {
              console.warn('Supabase login retry failed (social features may be unavailable):', retryError.message);
            }
          }
        }
      } catch (err) {
        console.warn('Supabase login exception (social features may be unavailable):', err);
      }

      // Fetch artist profile after login
      try {
        const userData = await apiClient.getCurrentUser();
        if (userData.artist) {
          updateArtistData({
            artistName: userData.artist.artist_name || '',
            genre: userData.artist.genre || '',
            bio: userData.artist.bio || '',
          });
        }

        // Fetch uploaded files
        try {
          const filesData = await apiClient.getUploadedFiles();
          if (filesData.files) {
            setUploadedFiles(filesData.files);
          }
        } catch (error) {
          console.log('No uploaded files found');
        }
      } catch (error) {
        console.log('No artist profile found for user');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (email: string, password: string) => {
    try {
      // Create Supabase user first (ignore if already exists)
      try {
        await supabase.auth.signUp({ email, password });
      } catch (err) {
        console.warn('Supabase signup exception (may already exist):', err);
      }

      await apiClient.register({ email, password });
      // After registration, automatically log in (will also sign into Supabase)
      await login(email, password);
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  const logout = () => {
    apiClient.logout();
    supabase.auth.signOut().catch(err => console.warn('Supabase signOut failed', err));
    setUser(null);

    // Clear artist data from Zustand (and localStorage via persist)
    clearArtistData();
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
