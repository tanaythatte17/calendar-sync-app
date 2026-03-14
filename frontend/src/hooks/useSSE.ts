import { useEffect, useRef, useState } from 'react';
import { EventSourcePolyfill } from 'event-source-polyfill';

interface SSEEvent {
  type: 'connection' | 'event' | 'calendarList' | 'syncStatus';
  action?: 'added' | 'updated' | 'deleted';
  data?: any;
  message?: string;
  status?: 'started' | 'completed' | 'error' | 'connected';
  details?: any;
  timestamp: string;
}

interface UseSSEOptions {
  onEvent?: (event: SSEEvent) => void;
  onCalendarListUpdate?: (data: any) => void;
  onSyncStatus?: (status: string) => void;
}

export const useSSE = (options: UseSSEOptions = {}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000; // 1 second

  const connect = () => {
    if (eventSourceRef.current?.readyState === EventSource.OPEN) {
      return; // Already connected
    }

    setConnectionStatus('connecting');

    const eventSource = new EventSourcePolyfill(
      `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/sse/events`,
      {
        withCredentials: true,
      }
    );

    eventSource.onopen = () => {
      setIsConnected(true);
      reconnectAttempts.current = 0;
    };

    eventSource.onmessage = (event) => {
      try {
        const data: SSEEvent = JSON.parse(event.data);
        
        // Handle different event types
        switch (data.type) {
          case 'connection':
            break;
            
          case 'event':
            options.onEvent?.(data);
            break;
            
          case 'calendarList':
            options.onCalendarListUpdate?.(data.data);
            break;
            
          case 'syncStatus':
            options.onSyncStatus?.(data.status || 'completed');
            break;
            
          default:
        }
      } catch (error) {
        console.error('Error parsing SSE event:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('🔴 SSE Error:', error);
      setConnectionStatus('error');
      setIsConnected(false);
      
      // Attempt to reconnect
      if (reconnectAttempts.current < maxReconnectAttempts) {
        const delay = baseReconnectDelay * Math.pow(2, reconnectAttempts.current);
        console.log(`🔄 Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttempts.current++;
          connect();
        }, delay);
      } else {
        console.error('❌ Max reconnection attempts reached');
        setConnectionStatus('disconnected');
      }
    };

    eventSourceRef.current = eventSource;
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    setIsConnected(false);
    setConnectionStatus('disconnected');
  };

  // Auto-connect on mount
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return {
    isConnected,
    connectionStatus,
    connect,
    disconnect
  };
};
