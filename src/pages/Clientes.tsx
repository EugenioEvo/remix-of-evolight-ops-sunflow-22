import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Pencil, Trash2, Building2, Phone, Mail, MapPin, FileText, Calendar, Clock, User, Plus, Search, Edit, Upload, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { BulkImportDialog } from '@/components/BulkImportDialog';

// Estados brasileiros
const ESTADOS_BR = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
] as const;

const clienteSchema = z.object({
  empresa: z.string().min(2, "Nome da empresa deve ter pelo menos 2 caracteres"),
  cnpj_cpf: z.string()
    .min(11, "CNPJ/CPF deve ter pelo menos 11 dígitos")
    .refine(val => {
      const digits = val.replace(/\D/g, '');
      return digits.length === 11 || digits.length === 14;
    }, "CNPJ deve ter 14 dígitos ou CPF 11 dígitos"),
  endereco: z.string().min(5, "Endereço é obrigatório"),
  cidade: z.string().min(2, "Cidade é obrigatória"),
  estado: z.enum(ESTADOS_BR, { errorMap: () => ({ message: "Selecione um estado válido" }) }),
  cep: z.string()
    .min(8, "CEP é obrigatório")
    .refine(val => /^\d{5}-?\d{3}$/.test(val.replace(/\D/g, '').replace(/(\d{5})(\d{3})/, '$1-$2')), "CEP inválido (formato: 00000-000)"),
  telefone: z.string()
    .optional()
    .refine(val => !val || /^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/.test(val), "Telefone inválido (formato: (00) 00000-0000)"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  ufv_solarz: z.string().optional(),
  prioridade: z.number().int().min(0, "Prioridade deve ser maior ou igual a 0").optional(),
  observacoes: z.string().optional(),
});

type ClienteForm = z.infer<typeof clienteSchema>;

interface Cliente extends ClienteForm {
  id: string;
  status: 'ativo' | 'inativo';
  ufv_solarz?: string;
  prioridade?: number;
  profile?: {
    id: string;
    nome: string;
    email: string;
    telefone?: string;
  };
}

export default function Clientes() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Cliente | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, session } = useAuth();

  // Carregar clientes do banco de dados
  useEffect(() => {
    fetchClientes();
  }, []);

  const fetchClientes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('clientes')
        .select(`
          *,
          profiles!clientes_profile_id_fkey(id, nome, email, telefone)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const clientesFormatted = data?.map(cliente => ({
        id: cliente.id,
        empresa: cliente.empresa || '',
        cnpj_cpf: cliente.cnpj_cpf || '',
        endereco: cliente.endereco || '',
        cidade: cliente.cidade || '',
        estado: (cliente.estado || 'SP') as typeof ESTADOS_BR[number],
        cep: cliente.cep || '',
        telefone: cliente.profiles?.telefone || '',
        email: cliente.profiles?.email || '',
        ufv_solarz: cliente.ufv_solarz || '',
        prioridade: (cliente as any).prioridade ?? 5,
        observacoes: '',
        status: 'ativo' as const,
        profile: cliente.profiles
      })) || [];

      setClientes(clientesFormatted);
    } catch (error) {
      logger.error('Erro ao carregar clientes:', error);
      toast.error('Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  };

  const form = useForm<ClienteForm>({
    resolver: zodResolver(clienteSchema),
    defaultValues: {
      empresa: '',
      cnpj_cpf: '',
      endereco: '',
      cidade: '',
      estado: 'SP',
      cep: '',
      telefone: '',
      email: '',
      ufv_solarz: '',
      prioridade: 5,
      observacoes: ''
    }
  });

  const onSubmit = async (data: ClienteForm) => {
    try {
      if (editingClient) {
        // Atualizar cliente existente
        if (editingClient.profile?.id) {
          const { error: profileError } = await supabase
            .from('profiles')
            .update({
              nome: data.empresa,
              email: data.email || data.empresa.toLowerCase().replace(/\s+/g, '') + '@cliente.com',
              telefone: data.telefone
            })
            .eq('id', editingClient.profile.id);

          if (profileError) throw profileError;
        }

        const { error: clienteError } = await supabase
          .from('clientes')
          .update({
            empresa: data.empresa,
            cnpj_cpf: data.cnpj_cpf,
            endereco: data.endereco,
            cidade: data.cidade,
            estado: data.estado,
            cep: data.cep,
            ufv_solarz: data.ufv_solarz || null,
            prioridade: data.prioridade ?? 5
          })
          .eq('id', editingClient.id);

        if (clienteError) throw clienteError;

        toast.success('Cliente atualizado com sucesso!');
      } else {
        // Criar novo cliente diretamente sem profile
        // O profile será criado quando o cliente fizer login pela primeira vez
        const { error: clienteError } = await supabase
          .from('clientes')
          .insert({
            profile_id: null,
            empresa: data.empresa,
            cnpj_cpf: data.cnpj_cpf,
            endereco: data.endereco,
            cidade: data.cidade,
            estado: data.estado,
            cep: data.cep,
            ufv_solarz: data.ufv_solarz || null,
            prioridade: data.prioridade ?? 5
          });

        if (clienteError) throw clienteError;

        toast.success('Cliente adicionado com sucesso!');
      }

      setIsDialogOpen(false);
      setEditingClient(null);
      form.reset();
      fetchClientes();
    } catch (error: any) {
      logger.error('Erro ao salvar cliente:', error);
      const errorMessage = error?.message || 'Erro desconhecido';
      const errorCode = error?.code || '';
      toast.error(`Erro ao salvar cliente: ${errorMessage} ${errorCode ? `(${errorCode})` : ''}`);
    }
  };

  const handleEdit = (cliente: Cliente) => {
    setEditingClient(cliente);
    form.reset({
      empresa: cliente.empresa,
      cnpj_cpf: cliente.cnpj_cpf,
      endereco: cliente.endereco,
      cidade: cliente.cidade,
      estado: cliente.estado,
      cep: cliente.cep,
      telefone: cliente.telefone,
      email: cliente.email,
      ufv_solarz: cliente.ufv_solarz || '',
      prioridade: cliente.prioridade ?? 5,
      observacoes: cliente.observacoes
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Cliente removido com sucesso!');
      fetchClientes(); // Recarregar lista
    } catch (error) {
      logger.error('Erro ao remover cliente:', error);
      toast.error('Erro ao remover cliente');
    }
  };

  const filteredClientes = clientes.filter(cliente =>
    cliente.empresa.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cliente.cnpj_cpf.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cliente.cidade.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (cliente.ufv_solarz && cliente.ufv_solarz.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Cadastro de Clientes</h1>
          <p className="text-muted-foreground">Gerencie os clientes da empresa</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Importar
          </Button>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-solar shadow-solar">
                <Plus className="h-4 w-4 mr-2" />
                Novo Cliente
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingClient ? "Editar Cliente" : "Novo Cliente"}
              </DialogTitle>
              <DialogDescription>
                {editingClient 
                  ? 'Atualize as informações do cliente abaixo.' 
                  : 'Preencha os dados para cadastrar um novo cliente. Email e telefone são opcionais.'}
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="empresa"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome da Empresa</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="cnpj_cpf"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CNPJ/CPF</FormLabel>
                        <FormControl>
                          <Input 
                            {...field}
                            placeholder="00.000.000/0000-00"
                            onChange={(e) => {
                              let value = e.target.value.replace(/\D/g, '');
                              if (value.length <= 11) {
                                // CPF: 000.000.000-00
                                value = value.replace(/(\d{3})(\d)/, '$1.$2');
                                value = value.replace(/(\d{3})(\d)/, '$1.$2');
                                value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
                              } else {
                                // CNPJ: 00.000.000/0000-00
                                value = value.replace(/^(\d{2})(\d)/, '$1.$2');
                                value = value.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
                                value = value.replace(/\.(\d{3})(\d)/, '.$1/$2');
                                value = value.replace(/(\d{4})(\d)/, '$1-$2');
                              }
                              field.onChange(value);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email (Opcional)</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="cliente@email.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="telefone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone (Opcional)</FormLabel>
                        <FormControl>
                          <Input 
                            {...field}
                            placeholder="(00) 00000-0000"
                            maxLength={15}
                            onChange={(e) => {
                              let value = e.target.value.replace(/\D/g, '');
                              value = value.replace(/^(\d{2})(\d)/, '($1) $2');
                              value = value.replace(/(\d{5})(\d)/, '$1-$2');
                              field.onChange(value);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="endereco"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endereço</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="cidade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cidade</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="estado"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estado</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ESTADOS_BR.map(estado => (
                              <SelectItem key={estado} value={estado}>
                                {estado}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="cep"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CEP</FormLabel>
                        <FormControl>
                          <Input 
                            {...field}
                            placeholder="00000-000"
                            maxLength={9}
                            onChange={(e) => {
                              let value = e.target.value.replace(/\D/g, '');
                              value = value.replace(/^(\d{5})(\d)/, '$1-$2');
                              field.onChange(value);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="ufv_solarz"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>UFV/SolarZ (Opcional)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Identificador da usina ou projeto" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="prioridade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prioridade</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            min={0}
                            {...field}
                            value={field.value ?? 5}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : 5)}
                            placeholder="Quanto menor, maior a prioridade"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="observacoes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Textarea {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="bg-gradient-solar">
                    {editingClient ? "Atualizar" : "Salvar"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setIsDialogOpen(false);
                      setEditingClient(null);
                      form.reset();
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <BulkImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onImportComplete={fetchClientes}
      />

      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar clientes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Badge variant="outline" className="text-sm">
          {filteredClientes.length} cliente(s)
        </Badge>
      </div>

      <div className="space-y-4">
        <Badge variant="secondary" className="mb-4">
          {filteredClientes.length} cliente{filteredClientes.length !== 1 ? 's' : ''} encontrado{filteredClientes.length !== 1 ? 's' : ''}
        </Badge>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Carregando clientes...</p>
          </div>
        ) : filteredClientes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Building2 className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>Nenhum cliente encontrado</p>
            <p className="text-sm">Adicione seu primeiro cliente usando o botão acima</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredClientes.map((cliente) => (
              <Card key={cliente.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Building2 className="h-4 w-4" />
                          <span className="font-medium text-foreground">{cliente.empresa}</span>
                        </div>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs flex items-center gap-1">
                          <Star className="h-3 w-3" />
                          P{cliente.prioridade ?? 5}
                        </Badge>
                        {cliente.ufv_solarz && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                            UFV/SolarZ: {cliente.ufv_solarz}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span>CNPJ/CPF: {cliente.cnpj_cpf}</span>
                          </div>
                          
                          <div className="flex items-center gap-2 text-sm">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span>{cliente.endereco}</span>
                          </div>
                          
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">📍</span>
                            <span>{cliente.cidade}, {cliente.estado} - {cliente.cep}</span>
                          </div>

                          {cliente.profile && (
                            <>
                              <div className="flex items-center gap-2 text-sm">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <span>{cliente.profile.email}</span>
                              </div>
                              
                              {cliente.profile.telefone && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Phone className="h-4 w-4 text-muted-foreground" />
                                  <span>{cliente.profile.telefone}</span>
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Badge 
                            variant={cliente.status === 'ativo' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {cliente.status === 'ativo' ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(cliente)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(cliente.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}