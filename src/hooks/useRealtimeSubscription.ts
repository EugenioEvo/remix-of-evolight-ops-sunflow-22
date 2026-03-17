import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface RealtimeSubscriptionOptions<T> {
  table: string;
  schema?: string;
  event?: RealtimeEvent;
  filter?: string;
  onInsert?: (record: T) => void;
  onUpdate?: (record: T) => void;
  onDelete?: (record: T) => void;
  onChange?: (event: RealtimeEvent, record: T) => void;
}

export function useRealtimeSubscription<T = Record<string, unknown>>(
  options: RealtimeSubscriptionOptions<T>
) {
  const {
    table,
    schema = 'public',
    event = '*',
    filter,
    onInsert,
    onUpdate,
    onDelete,
    onChange,
  } = options;

  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const channelName = `sunflow-rt-${table}-${Date.now()}`;
    const channel = supabase.channel(channelName);

    const postgresConfig: Parameters<typeof channel.on>[1] = {
      event,
      schema,
      table,
      ...(filter ? { filter } : {}),
    };

    (channel as any).on('postgres_changes', postgresConfig, (payload: any) => {
      const record = (payload.new ?? payload.old) as T;
      const ev = payload.eventType as RealtimeEvent;

      onChange?.(ev, record);
      if (ev === 'INSERT') onInsert?.(record);
      if (ev === 'UPDATE') onUpdate?.(record);
      if (ev === 'DELETE') onDelete?.(record);
    });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, schema, event, filter]);

  return channelRef;
}
