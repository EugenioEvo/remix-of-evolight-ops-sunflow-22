import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateSolarPlant } from '@/hooks/queries/useSolar';
import { useClientes } from '@/hooks/queries/useClientes';
import { useToast } from '@/hooks/use-toast';

type FormValues = {
  nome: string;
  potencia_kwp: number;
  cidade: string;
  estado: string;
  endereco: string;
  data_instalacao: string;
  marca_inversor: string;
  modelo_inversor: string;
  serial_inversor: string;
  solarz_plant_id: string;
  cliente_id: string;
};

const BRAZIL_STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

export default function PlantNew() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const createPlant = useCreateSolarPlant();
  const { data: clientes } = useClientes();

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>();

  const onSubmit = async (values: FormValues) => {
    try {
      if (!values.cliente_id) {
        toast({ title: 'Selecione um cliente', variant: 'destructive' });
        return;
      }

      const result = await createPlant.mutateAsync({
        nome: values.nome,
        potencia_kwp: Number(values.potencia_kwp),
        cidade: values.cidade || null,
        estado: values.estado || null,
        endereco: values.endereco || null,
        data_instalacao: values.data_instalacao || null,
        marca_inversor: values.marca_inversor || null,
        modelo_inversor: values.modelo_inversor || null,
        serial_inversor: values.serial_inversor || null,
        solarz_plant_id: values.solarz_plant_id || null,
        cliente_id: values.cliente_id,
        ativo: true,
      });

      toast({ title: 'Usina cadastrada com sucesso!' });
      navigate(`/sunflow/plants/${result.id}`);
    } catch (err) {
      toast({
        title: 'Erro ao cadastrar usina',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/sunflow/plants" className="flex items-center gap-1 hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Usinas
        </Link>
        <span>/</span>
        <span className="text-foreground">Nova Usina</span>
      </div>

      <h1 className="text-2xl font-bold">Cadastrar Nova Usina</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader><CardTitle className="text-base">Informações Básicas</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cliente_id">Cliente *</Label>
              <Select onValueChange={(v) => setValue('cliente_id', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {(clientes ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.empresa ?? c.cnpj_cpf ?? c.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="nome">Nome da Usina *</Label>
                <Input
                  id="nome"
                  {...register('nome', { required: 'Nome é obrigatório' })}
                  placeholder="Ex: Usina Solar Nordeste I"
                />
                {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="potencia_kwp">Capacidade (kWp) *</Label>
                <Input
                  id="potencia_kwp"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('potencia_kwp', {
                    required: 'Capacidade é obrigatória',
                    min: { value: 0.01, message: 'Deve ser maior que 0' },
                  })}
                  placeholder="Ex: 1500.00"
                />
                {errors.potencia_kwp && <p className="text-xs text-destructive">{errors.potencia_kwp.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="data_instalacao">Data de Instalação</Label>
              <Input id="data_instalacao" type="date" {...register('data_instalacao')} />
            </div>
          </CardContent>
        </Card>

        {/* Location */}
        <Card>
          <CardHeader><CardTitle className="text-base">Localização</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="endereco">Endereço</Label>
              <Input id="endereco" {...register('endereco')} placeholder="Rua, número, complemento" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cidade">Cidade</Label>
                <Input id="cidade" {...register('cidade')} placeholder="Ex: Fortaleza" />
              </div>
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Select onValueChange={(v) => setValue('estado', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {BRAZIL_STATES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inversor */}
        <Card>
          <CardHeader><CardTitle className="text-base">Inversor</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="marca_inversor">Marca</Label>
                <Input id="marca_inversor" {...register('marca_inversor')} placeholder="Huawei, Sungrow..." />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="modelo_inversor">Modelo</Label>
                <Input id="modelo_inversor" {...register('modelo_inversor')} placeholder="SUN2000-100KTL" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="serial_inversor">Número de Série</Label>
                <Input id="serial_inversor" {...register('serial_inversor')} placeholder="SN-12345" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SolarZ Integration */}
        <Card>
          <CardHeader><CardTitle className="text-base">Integração SolarZ</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              <Label htmlFor="solarz_plant_id">ID da Planta no SolarZ</Label>
              <Input id="solarz_plant_id" {...register('solarz_plant_id')} placeholder="ID externo (opcional)" />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" asChild>
            <Link to="/sunflow/plants">Cancelar</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando...' : 'Cadastrar Usina'}
          </Button>
        </div>
      </form>
    </div>
  );
}
