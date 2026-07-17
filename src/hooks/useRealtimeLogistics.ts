import { useEffect, useRef } from 'react';
import { subscribeToCollection } from '../services/firebase';
import { ChatMessage, GPSLocation } from '../types';

export function useRealtimeLogistics(
  regionActive: string,
  onNewMessage: (msg: ChatMessage) => void,
  onNewLocation: (loc: GPSLocation) => void
) {
  const processedChatIds = useRef<Set<string>>(new Set());
  const processedLocationTimestamps = useRef<Map<string, string>>(new Map());

  // Use refs to avoid recreating subscriptions on callback instance changes
  const onNewMessageRef = useRef(onNewMessage);
  const onNewLocationRef = useRef(onNewLocation);

  // Always keep the refs updated with the latest callbacks
  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
    onNewLocationRef.current = onNewLocation;
  });

  useEffect(() => {
    // Reset processed caches on region change
    processedChatIds.current.clear();
    processedLocationTimestamps.current.clear();

    // 1. Subscribe to chats in real-time
    const unsubscribeChat = subscribeToCollection<ChatMessage>('chats', (chatsList) => {
      if (!chatsList) return;
      
      // Filter chats belonging to regionActive (or global)
      const filtered = chatsList.filter(chat => 
        chat && (chat.region === regionActive || chat.region === 'all' || !chat.region)
      );

      // Sort by timestamp to ensure they are processed chronologically
      filtered.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeA - timeB;
      });

      // Trigger callback for any chat we haven't seen yet
      filtered.forEach(chat => {
        if (chat && chat.id && !processedChatIds.current.has(chat.id)) {
          processedChatIds.current.add(chat.id);
          onNewMessageRef.current(chat);
        }
      });
    });

    // 2. Subscribe to GPS locations in real-time
    const unsubscribeLocations = subscribeToCollection<GPSLocation>('locations', (locationsList) => {
      if (!locationsList) return;

      locationsList.forEach(loc => {
        if (loc && loc.driverId) {
          const lastTime = processedLocationTimestamps.current.get(loc.driverId);
          if (loc.lastUpdated !== lastTime) {
            processedLocationTimestamps.current.set(loc.driverId, loc.lastUpdated || '');
            onNewLocationRef.current(loc);
          }
        }
      });
    });

    return () => {
      unsubscribeChat();
      unsubscribeLocations();
    };
  }, [regionActive]); // Only re-subscribe if regionActive changes
}
