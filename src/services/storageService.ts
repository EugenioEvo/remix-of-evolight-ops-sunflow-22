import { supabase } from '@/integrations/supabase/client';
import logger from '@/lib/logger';

type BucketName = 'ticket-anexos' | 'rme-fotos' | 'rme-evidences' | 'ordens-servico';

export const storageService = {
  async upload(bucket: BucketName, path: string, file: File, options?: { upsert?: boolean }) {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: options?.upsert ?? false,
      });
    if (error) {
      logger.error('Storage upload error', { bucket, path, error });
      throw error;
    }
    return path;
  },

  async remove(bucket: BucketName, paths: string[]) {
    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error) {
      logger.error('Storage remove error', { bucket, paths, error });
      throw error;
    }
  },

  async download(bucket: BucketName, path: string) {
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error) {
      logger.error('Storage download error', { bucket, path, error });
      throw error;
    }
    return data;
  },

  async getSignedUrl(bucket: BucketName, path: string, expiresIn = 3600) {
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
    return data?.signedUrl || '';
  },

  getPublicUrl(bucket: BucketName, path: string) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  },

  /** Trigger browser download for a storage file */
  async triggerDownload(bucket: BucketName, path: string) {
    const blob = await this.download(bucket, path);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = path.split('/').pop() || 'arquivo';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
