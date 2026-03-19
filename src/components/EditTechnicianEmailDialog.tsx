import { useState } from 'react';
import logger from '@/lib/logger';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Mail } from 'lucide-react';

interface EditTechnicianEmailDialogProps {
  open: boolean;
  onClose: () => void;
  tecnicoId: string;
  profileId: string;
  currentEmail: string | null;
  tecnicoNome: string;
  onSuccess?: () => void;
}

export const EditTechnicianEmailDialog = ({
  open,
  onClose,
  tecnicoId,
  profileId,
  currentEmail,
  tecnicoNome,
  onSuccess
}: EditTechnicianEmailDialogProps) => {
  const [email, setEmail] = useState(currentEmail || '');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!email || !email.includes('@')) {
      toast({
        title: 'Email inválido',
        description: 'Por favor, insira um email válido',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ email })
        .eq('id', profileId);

      if (error) throw error;

      toast({
        title: 'Email atualizado',
        description: `Email do técnico ${tecnicoNome} atualizado com sucesso`
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (error: any) {
      logger.error('Erro ao atualizar email:', error);
      toast({
        title: 'Erro ao atualizar',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Editar Email do Técnico
          </DialogTitle>
          <DialogDescription>
            Atualize o email de {tecnicoNome} para permitir envio de convites e lembretes
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="tecnico@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar Email'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
