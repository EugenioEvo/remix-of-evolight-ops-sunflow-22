import { useState } from 'react';
import logger from '@/lib/logger';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const equipmentSchema = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
  tipo: z.enum(['painel_solar', 'inversor', 'bateria', 'controlador_carga', 'estrutura', 'cabeamento', 'monitoramento', 'outros']),
  modelo: z.string().optional(),
  numero_serie: z.string().optional(),
  fabricante: z.string().optional(),
  observacoes: z.string().optional(),
});

type EquipmentForm = z.infer<typeof equipmentSchema>;

interface EquipmentQuickAddProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (equipmentId: string) => void;
  clienteId: string;
  initialData?: Partial<EquipmentForm>;
}

export const EquipmentQuickAdd = ({ 
  open, 
  onClose, 
  onSuccess, 
  clienteId,
  initialData 
}: EquipmentQuickAddProps) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<EquipmentForm>({
    resolver: zodResolver(equipmentSchema),
    defaultValues: {
      nome: initialData?.nome || '',
      tipo: initialData?.tipo || 'inversor',
      modelo: initialData?.modelo || '',
      numero_serie: initialData?.numero_serie || '',
      fabricante: initialData?.fabricante || '',
      observacoes: initialData?.observacoes || '',
    },
  });

  const onSubmit = async (data: EquipmentForm) => {
    try {
      setLoading(true);

      const { data: newEquipment, error } = await supabase
        .from('equipamentos')
        .insert([{
          nome: data.nome,
          tipo: data.tipo,
          modelo: data.modelo || null,
          numero_serie: data.numero_serie || null,
          fabricante: data.fabricante || null,
          observacoes: data.observacoes || null,
          cliente_id: clienteId,
          status: 'ativo',
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Equipamento cadastrado!',
        description: 'Equipamento adicionado com sucesso.',
      });

      onSuccess(newEquipment.id);
      onClose();
    } catch (error: any) {
      logger.error('Erro ao cadastrar equipamento:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao cadastrar equipamento',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastro Rápido de Equipamento</DialogTitle>
          <DialogDescription>
            Preencha os dados do equipamento para continuar
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Equipamento *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Ex: Inversor Solar Principal" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tipo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="painel_solar">Painel Solar</SelectItem>
                      <SelectItem value="inversor">Inversor</SelectItem>
                      <SelectItem value="bateria">Bateria</SelectItem>
                      <SelectItem value="controlador_carga">Controlador de Carga</SelectItem>
                      <SelectItem value="estrutura">Estrutura</SelectItem>
                      <SelectItem value="cabeamento">Cabeamento</SelectItem>
                      <SelectItem value="monitoramento">Monitoramento</SelectItem>
                      <SelectItem value="outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="fabricante"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fabricante</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Ex: WEG, ABB, Fronius" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="modelo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Modelo</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Ex: WEG-1000" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="numero_serie"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número de Série</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Ex: SN123456789" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Informações adicionais" rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Cadastrar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
