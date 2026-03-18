import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { logger } from '@/services/api';
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface GerarOSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string;
  onSuccess?: () => void;
}

export const GerarOSDialog = ({ open, onOpenChange, ticketId, onSuccess }: GerarOSDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    equipe: "",
    servico_solicitado: "MANUTENÇÃO",
    inspetor_responsavel: "TODOS",
    tipo_trabalho: [] as string[],
  });

  const handleTipoTrabalhoChange = (tipo: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      tipo_trabalho: checked
        ? [...prev.tipo_trabalho, tipo]
        : prev.tipo_trabalho.filter(t => t !== tipo)
    }));
  };

  const handleSubmit = async () => {
    if (!formData.equipe.trim()) {
      toast.error("Preencha o campo Equipe");
      return;
    }

    if (formData.tipo_trabalho.length === 0) {
      toast.error("Selecione ao menos um tipo de trabalho");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('gerar-ordem-servico', {
        body: { 
          ticketId,
          equipe: formData.equipe.split('/').map(n => n.trim()),
          servico_solicitado: formData.servico_solicitado,
          inspetor_responsavel: formData.inspetor_responsavel,
          tipo_trabalho: formData.tipo_trabalho
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Erro ao gerar OS');
      }

      toast.success('Ordem de Serviço gerada com sucesso!');
      onOpenChange(false);
      
      // Resetar form
      setFormData({
        equipe: "",
        servico_solicitado: "MANUTENÇÃO",
        inspetor_responsavel: "TODOS",
        tipo_trabalho: []
      });

      if (onSuccess) onSuccess();

    } catch (error: any) {
      console.error('Erro ao gerar OS:', error);
      toast.error(error.message || 'Erro ao gerar Ordem de Serviço');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gerar Ordem de Serviço</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="equipe">
              Equipe <span className="text-red-500">*</span>
            </Label>
            <Input
              id="equipe"
              placeholder="Ex: DIEGO / ADRIAN / RICHADS"
              value={formData.equipe}
              onChange={(e) => setFormData(prev => ({ ...prev, equipe: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Separe os nomes com "/" (barra)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="servico">
              Serviço Solicitado <span className="text-red-500">*</span>
            </Label>
            <Input
              id="servico"
              placeholder="Ex: MANUTENÇÃO, INSTALAÇÃO, REPARO"
              value={formData.servico_solicitado}
              onChange={(e) => setFormData(prev => ({ ...prev, servico_solicitado: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="inspetor">
              Inspetor Responsável <span className="text-red-500">*</span>
            </Label>
            <Input
              id="inspetor"
              placeholder="Ex: TODOS, JOÃO SILVA"
              value={formData.inspetor_responsavel}
              onChange={(e) => setFormData(prev => ({ ...prev, inspetor_responsavel: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>
              Tipo de Trabalho <span className="text-red-500">*</span>
            </Label>
            <div className="flex gap-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="internet"
                  checked={formData.tipo_trabalho.includes('internet')}
                  onCheckedChange={(checked) => handleTipoTrabalhoChange('internet', checked as boolean)}
                />
                <label
                  htmlFor="internet"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  INTERNET
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="eletrica"
                  checked={formData.tipo_trabalho.includes('eletrica')}
                  onCheckedChange={(checked) => handleTipoTrabalhoChange('eletrica', checked as boolean)}
                />
                <label
                  htmlFor="eletrica"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  ELÉTRICA
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="limpeza"
                  checked={formData.tipo_trabalho.includes('limpeza')}
                  onCheckedChange={(checked) => handleTipoTrabalhoChange('limpeza', checked as boolean)}
                />
                <label
                  htmlFor="limpeza"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  LIMPEZA
                </label>
              </div>
            </div>
          </div>

          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-200 dark:border-yellow-800">
            <p className="text-xs text-yellow-800 dark:text-yellow-200">
              <strong>ATENÇÃO:</strong> A OS deve ser preenchida e grampeada junto com o RME. 
              Não será permitido RME sem a OS grampeada e/ou vinculada.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Gerar OS
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
