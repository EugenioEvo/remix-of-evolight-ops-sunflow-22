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
import { createPlant } from '@/integrations/sunflow/client';
import type { CreateSolarPlant } from '@/integrations/sunflow/types';
import { useToast } from '@/hooks/use-toast';

type FormValues = {
  name: string;
  code: string;
  capacity_kwp: number;
  city: string;
  state: string;
  country: string;
  address: string;
  commissioning_date: string;
  owner_name: string;
  owner_contact: string;
  latitude: string;
  longitude: string;
  notes: string;
};

const BRAZIL_STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

export default function PlantNew() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    defaultValues: { country: 'BR' },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      const payload: CreateSolarPlant = {
        name: values.name,
        code: values.code,
        capacity_kwp: Number(values.capacity_kwp),
        city: values.city,
        state: values.state,
        country: values.country || 'BR',
        address: values.address || null,
        commissioning_date: values.commissioning_date || null,
        owner_name: values.owner_name || null,
        owner_contact: values.owner_contact || null,
        notes: values.notes || null,
        status: 'active',
        created_by: null,
        latitude: values.latitude ? Number(values.latitude) : undefined,
        longitude: values.longitude ? Number(values.longitude) : undefined,
      };
      const plant = await createPlant(payload);
      toast({ title: 'Usina cadastrada com sucesso!' });
      navigate(`/sunflow/plants/${plant.id}`);
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome da Usina *</Label>
                <Input
                  id="name"
                  {...register('name', { required: 'Nome é obrigatório' })}
                  placeholder="Ex: Usina Solar Nordeste I"
                />
                {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="code">Código *</Label>
                <Input
                  id="code"
                  {...register('code', { required: 'Código é obrigatório' })}
                  placeholder="Ex: USN-001"
                />
                {errors.code && <p className="text-xs text-red-500">{errors.code.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="capacity_kwp">Capacidade (kWp) *</Label>
                <Input
                  id="capacity_kwp"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('capacity_kwp', {
                    required: 'Capacidade é obrigatória',
                    min: { value: 0.01, message: 'Deve ser maior que 0' },
                  })}
                  placeholder="Ex: 1500.00"
                />
                {errors.capacity_kwp && <p className="text-xs text-red-500">{errors.capacity_kwp.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="commissioning_date">Data de Comissionamento</Label>
                <Input id="commissioning_date" type="date" {...register('commissioning_date')} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location */}
        <Card>
          <CardHeader><CardTitle className="text-base">Localização</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="address">Endereço</Label>
              <Input id="address" {...register('address')} placeholder="Rua, número, complemento" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label htmlFor="city">Cidade *</Label>
                <Input
                  id="city"
                  {...register('city', { required: 'Cidade é obrigatória' })}
                  placeholder="Ex: Fortaleza"
                />
                {errors.city && <p className="text-xs text-red-500">{errors.city.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Estado *</Label>
                <Select onValueChange={(v) => setValue('state', v)}>
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
              <div className="space-y-1.5">
                <Label htmlFor="country">País</Label>
                <Input id="country" {...register('country')} defaultValue="BR" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="latitude">Latitude</Label>
                <Input id="latitude" type="number" step="any" {...register('latitude')} placeholder="-3.7172" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="longitude">Longitude</Label>
                <Input id="longitude" type="number" step="any" {...register('longitude')} placeholder="-38.5433" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Owner */}
        <Card>
          <CardHeader><CardTitle className="text-base">Proprietário</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="owner_name">Nome do Proprietário</Label>
                <Input id="owner_name" {...register('owner_name')} placeholder="Razão social ou nome" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="owner_contact">Contato</Label>
                <Input id="owner_contact" {...register('owner_contact')} placeholder="Email ou telefone" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader><CardTitle className="text-base">Observações</CardTitle></CardHeader>
          <CardContent>
            <Textarea {...register('notes')} placeholder="Informações adicionais..." rows={3} />
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
