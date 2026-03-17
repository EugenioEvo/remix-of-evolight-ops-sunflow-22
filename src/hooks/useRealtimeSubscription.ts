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

  // Keep callback refs up-to-date on every render to avoid stale closures.
  const onInsertRef = useRef(onInsert);
  const onUpdateRef = useRef(onUpdate);
  const onDeleteRef = useRef(onDelete);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onInsertRef.current = onInsert;
    onUpdateRef.current = onUpdate;
    onDeleteRef.current = onDelete;
    onChangeRef.current = onChange;
  });

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

      onChangeRef.current?.(ev, record);
      if (ev === 'INSERT') onInsertRef.current?.(record);
      if (ev === 'UPDATE') onUpdateRef.current?.(record);
      if (ev === 'DELETE') onDeleteRef.current?.(record);
    });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, schema, event, filter]);

  return channelRef;
}
