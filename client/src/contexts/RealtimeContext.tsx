import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface RealtimeContextType {
  supabase: SupabaseClient;
  isConnected: boolean;
  subscribeToChannel: (channelName: string, callback: (payload: any) => void) => RealtimeChannel;
  unsubscribeFromChannel: (channel: RealtimeChannel) => void;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

export const useRealtime = () => {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
};

interface RealtimeProviderProps {
  children: ReactNode;
}

export const RealtimeProvider: React.FC<RealtimeProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Check Supabase connection
    const checkConnection = async () => {
      try {
        const { error } = await supabase.from('users').select('count').limit(1);
        if (!error) {
          setIsConnected(true);
        }
      } catch (error) {
        console.error('Supabase connection error:', error);
        setIsConnected(false);
      }
    };

    checkConnection();
  }, []);

  const subscribeToChannel = (channelName: string, callback: (payload: any) => void): RealtimeChannel => {
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        callback(payload);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Subscribed to channel: ${channelName}`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`❌ Error subscribing to channel: ${channelName}`);
          console.error('Realtime may not be enabled on database tables.');
          console.error('Run: server/scripts/enable-realtime.sql in Supabase SQL Editor');
          // Don't show toast - this is normal if Realtime isn't enabled
          // Application will work fine without it
        } else if (status === 'TIMED_OUT') {
          console.warn(`⏱️  Timeout subscribing to channel: ${channelName}`);
        } else if (status === 'CLOSED') {
          console.log(`🔒 Channel closed: ${channelName}`);
        }
      });

    return channel;
  };

  const unsubscribeFromChannel = (channel: RealtimeChannel) => {
    supabase.removeChannel(channel);
  };

  const value: RealtimeContextType = {
    supabase,
    isConnected,
    subscribeToChannel,
    unsubscribeFromChannel,
  };

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
};

export { supabase };
