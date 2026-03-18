import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Upload, X, FileText, Image, Download, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  ticketId: string;
  existingFiles?: string[];
  onFilesChange: (files: string[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  ticketId,
  existingFiles = [],
  onFilesChange,
  maxFiles = 5,
  maxSizeMB = 10,
}) => {
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<string[]>(existingFiles);
  const { toast } = useToast();

  const isImage = (filename: string) => {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(filename);
  };

  const getFileUrl = async (path: string) => {
    const { data } = await supabase.storage
      .from('ticket-anexos')
      .createSignedUrl(path, 3600); // 1 hora
    return data?.signedUrl || '';
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    
    if (files.length + selectedFiles.length > maxFiles) {
      toast({
        title: 'Limite excedido',
        description: `Máximo de ${maxFiles} arquivos permitido`,
        variant: 'destructive',
      });
      return;
    }

    const maxBytes = maxSizeMB * 1024 * 1024;
    const oversizedFiles = selectedFiles.filter(f => f.size > maxBytes);
    
    if (oversizedFiles.length > 0) {
      toast({
        title: 'Arquivo muito grande',
        description: `Tamanho máximo: ${maxSizeMB}MB`,
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);

    try {
      const uploadedPaths: string[] = [];

      for (const file of selectedFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${ticketId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('ticket-anexos')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) throw uploadError;
        uploadedPaths.push(fileName);
      }

      const newFiles = [...files, ...uploadedPaths];
      setFiles(newFiles);
      onFilesChange(newFiles);

      toast({
        title: 'Sucesso',
        description: `${uploadedPaths.length} arquivo(s) enviado(s)`,
      });
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao fazer upload',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleRemoveFile = async (path: string) => {
    try {
      const { error } = await supabase.storage
        .from('ticket-anexos')
        .remove([path]);

      if (error) throw error;

      const newFiles = files.filter(f => f !== path);
      setFiles(newFiles);
      onFilesChange(newFiles);

      toast({
        title: 'Sucesso',
        description: 'Arquivo removido',
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: 'Erro ao remover arquivo',
        variant: 'destructive',
      });
    }
  };

  const handleDownload = async (path: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('ticket-anexos')
        .download(path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = path.split('/').pop() || 'arquivo';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: 'Erro ao baixar arquivo',
        variant: 'destructive',
      });
    }
  };

  const handlePreview = async (path: string) => {
    const url = await getFileUrl(path);
    if (url) {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={uploading || files.length >= maxFiles}
          onClick={() => document.getElementById('file-upload')?.click()}
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? 'Enviando...' : 'Adicionar Anexos'}
        </Button>
        <span className="text-sm text-muted-foreground">
          {files.length}/{maxFiles} arquivos • Max {maxSizeMB}MB
        </span>
      </div>

      <input
        id="file-upload"
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
        onChange={handleFileUpload}
        className="hidden"
      />

      {files.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {files.map((path) => {
            const filename = path.split('/').pop() || '';
            const isImg = isImage(filename);

            return (
              <Card key={path} className="p-3 flex items-center gap-3">
                <div className="flex-shrink-0">
                  {isImg ? (
                    <Image className="h-8 w-8 text-primary" />
                  ) : (
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" title={filename}>
                    {filename}
                  </p>
                </div>

                <div className="flex gap-1">
                  {isImg && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePreview(path)}
                      className="h-8 w-8 p-0"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(path)}
                    className="h-8 w-8 p-0"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveFile(path)}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
