import { useEffect, useRef, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import { API_BASE_URL } from '../services/api';

interface UseWebSocketOptions {
  userId: number | null;
  onNotification: (payload: any) => void;
  onUnreadCount: (count: number) => void;
}

export function useWebSocket({ userId, onNotification, onUnreadCount }: UseWebSocketOptions) {
  const clientRef = useRef<Client | null>(null);

  const connect = useCallback(() => {
    if (!userId) return;

    const client = new Client({
      brokerURL: `${API_BASE_URL.replace('http', 'ws')}/ws`,
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
    });

    client.onConnect = () => {
      client.subscribe(`/topic/notifications/${userId}`, (message) => {
        const payload = JSON.parse(message.body);
        onNotification(payload);
      });

      client.subscribe(`/topic/notifications/${userId}/count`, (message) => {
        const { count } = JSON.parse(message.body);
        onUnreadCount(count);
      });
    };

    client.activate();
    clientRef.current = client;
  }, [userId, onNotification, onUnreadCount]);

  useEffect(() => {
    connect();
    return () => {
      clientRef.current?.deactivate();
    };
  }, [connect]);
}
