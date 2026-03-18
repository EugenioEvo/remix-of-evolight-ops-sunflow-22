import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/useDebounce';
import { useTicketsRealtime } from '@/hooks/useTicketsRealtime';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, Plus, Search, Settings, FileText, CheckCircle, XCircle, Download, Eye, ExternalLink, Ticket as TicketIcon, MapPinOff, Loader2, RefreshCw, Star } from 'lucide-react';
import TicketFilters from '@/components/TicketFilters';
import { LoadingState } from '@/components/LoadingState';
import { EmptyState } from '@/components/EmptyState';
import { FileUpload } from '@/components/FileUpload';
import { useGeocoding } from '@/hooks/useGeocoding';

const ticketSchema = z.object({
  titulo: z.string().min(1, 'Título é obrigatório'),
  descricao: z.string().min(1, 'Descrição é obrigatória'),
  cliente_id: z.string().uuid('Selecione um cliente'),
  equipamento_tipo: z.enum(['painel_solar', 'inversor', 'controlador_carga', 'bateria', 'cabeamento', 'estrutura', 'monitoramento', 'outros']),
  prioridade: z.enum(['baixa', 'media', 'alta', 'critica']),
  endereco_servico: z.string().min(1, 'Endereço do serviço é obrigatório'),
  data_servico: z.string().optional(),
  data_vencimento: z.string().optional(),
  horario_previsto_inicio: z.string().optional(),
  tempo_estimado: z.number().min(1, 'Tempo estimado deve ser maior que 0').optional(),
  observacoes: z.string().optional(),
  anexos: z.array(z.string()).optional(),
});

type TicketForm = z.infer<typeof ticketSchema>;

const Tickets = () => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [prestadores, setPrestadores] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState(localStorage.getItem('tickets_search') || '');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [activeTab, setActiveTab] = useState(localStorage.getItem('tickets_tab') || 'todos');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [generatingOsId, setGeneratingOsId] = useState<string | null>(null);
  const [selectedCliente, setSelectedCliente] = useState(localStorage.getItem('tickets_cliente') || 'todos');
  const [selectedPrioridade, setSelectedPrioridade] = useState(localStorage.getItem('tickets_prioridade') || 'todas');
  const [selectedUfvSolarz, setSelectedUfvSolarz] = useState(localStorage.getItem('tickets_ufv_solarz') || 'todos');
  const [reprocessingTicketId, setReprocessingTicketId] = useState<string | null>(null);

  const { geocodeAddress, loading: geocoding } = useGeocoding();

  // Persistir filtros
  useEffect(() => {
    localStorage.setItem('tickets_search', searchTerm);
    localStorage.setItem('tickets_tab', activeTab);
    localStorage.setItem('tickets_cliente', selectedCliente);
    localStorage.setItem('tickets_prioridade', selectedPrioridade);
    localStorage.setItem('tickets_ufv_solarz', selectedUfvSolarz);
  }, [searchTerm, activeTab, selectedCliente, selectedPrioridade, selectedUfvSolarz]);

  // Extrair opções únicas de UFV/SolarZ dos tickets
  const ufvSolarzOptions = React.useMemo(() => {
    const ufvSet = new Set<string>();
    tickets.forEach(ticket => {
      if (ticket.clientes?.ufv_solarz) {
        ufvSet.add(ticket.clientes.ufv_solarz);
      }
    });
    return Array.from(ufvSet).sort();
  }, [tickets]);

  const { user, profile } = useAuth();
  const { toast } = useToast();

  const form = useForm<TicketForm>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      titulo: '',
      descricao: '',
      cliente_id: '',
      equipamento_tipo: 'painel_solar',
      prioridade: 'media',
      endereco_servico: '',
      data_servico: '',
      data_vencimento: '',
      horario_previsto_inicio: '',
      tempo_estimado: undefined,
      observacoes: '',
    },
  });

  const [selectedTechnicianForTicket, setSelectedTechnicianForTicket] = useState<string>('');
  const [attachments, setAttachments] = useState<string[]>([]);

  const [ufvSolarzListForForm, setUfvSolarzListForForm] = useState<string[]>([]);
  const [selectedUfvSolarzForm, setSelectedUfvSolarzForm] = useState<string>('');
  
  const loadData = async () => {
    try {
      setLoading(true);
      
      // Carregar clientes com endereço completo, UFV/SolarZ e prioridade
      const { data: clientesData } = await supabase
        .from('clientes')
        .select(`
          id,
          empresa,
          endereco,
          cidade,
          estado,
          cep,
          cnpj_cpf,
          ufv_solarz,
          prioridade,
          profiles(nome, email, telefone)
        `);
      setClientes(clientesData || []);
      
      // Extrair lista única de UFV/SolarZ para o formulário
      const ufvList = (clientesData || [])
        .map((c: any) => c.ufv_solarz)
        .filter((ufv: string | null): ufv is string => ufv !== null && ufv.trim() !== '')
        .filter((ufv: string, index: number, arr: string[]) => arr.indexOf(ufv) === index)
        .sort((a: string, b: string) => a.localeCompare(b));
      setUfvSolarzListForForm(ufvList);

      // Carregar prestadores ativos com categoria técnico
      const { data: prestadoresData } = await supabase
        .from('prestadores')
        .select('*')
        .eq('categoria', 'tecnico')
        .eq('ativo', true);
      
      setPrestadores(prestadoresData || []);

      // Carregar tickets com informações do técnico atribuído
      const { data: ticketsData, error: ticketsError } = await supabase
        .from('tickets')
        .select(`
          *,
          ordens_servico(numero_os, id, pdf_url),
          clientes(
            empresa,
            endereco,
            cidade,
            estado,
            cep,
            ufv_solarz,
            prioridade,
            profiles(nome, email)
          ),
          prestadores:tecnico_responsavel_id(
            id,
            nome,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (ticketsError) {
        logger.error('Erro ao carregar tickets:', ticketsError);
        throw ticketsError;
      }

      setTickets(ticketsData || []);
    } catch (error) {
      logger.error('Erro ao carregar dados:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar dados',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Realtime subscription - mover depois da definição de loadData
  useTicketsRealtime({
    onTicketChange: loadData
  });

  const onSubmit = async (data: TicketForm) => {
    try {
      setLoading(true);

      // Definir técnico se selecionado, senão deixar null
      const tecnico_id = selectedTechnicianForTicket || null;
      
      // Alertar se data de serviço ultrapassa data de vencimento
      if (data.data_servico && data.data_vencimento) {
        const servico = new Date(data.data_servico);
        const vencimento = new Date(data.data_vencimento);
        if (servico > vencimento) {
          toast({
            title: '⚠️ Atenção: Data de serviço após o vencimento',
            description: `A data de serviço (${servico.toLocaleDateString('pt-BR')}) é posterior à data de vencimento limite (${vencimento.toLocaleDateString('pt-BR')}).`,
            variant: 'destructive',
          });
        }
      }

      const ticketData = {
        ...data,
        tempo_estimado: data.tempo_estimado || null,
        data_servico: data.data_servico || null,
        data_vencimento: data.data_vencimento ? new Date(data.data_vencimento).toISOString() : null,
        created_by: user?.id,
        tecnico_responsavel_id: tecnico_id,
        anexos: attachments,
        // Status: sempre inicia como aberto
        status: 'aberto',
      };

      if (editingTicket) {
        const { error } = await supabase
          .from('tickets')
          .update(ticketData as any)
          .eq('id', editingTicket.id);

        if (error) throw error;

        toast({
          title: 'Sucesso',
          description: 'Ticket atualizado com sucesso!',
        });
      } else {
        const { error } = await supabase
          .from('tickets')
          .insert([ticketData as any]);

        if (error) throw error;

        toast({
          title: 'Sucesso',
          description: 'Ticket criado aguardando aprovação!',
        });
      }

      setIsDialogOpen(false);
      setEditingTicket(null);
      setSelectedTechnicianForTicket('');
      setAttachments([]);
      form.reset();
      loadData();
    } catch (error: any) {
      logger.error('Erro ao salvar ticket:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao salvar ticket',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (ticket: any) => {
    setEditingTicket(ticket);
    setSelectedTechnicianForTicket(ticket.tecnico_responsavel_id || '');
    setAttachments(ticket.anexos || []);
    // Preencher UFV/SolarZ do cliente associado
    setSelectedUfvSolarzForm(ticket.clientes?.ufv_solarz || '');
    form.reset({
      titulo: ticket.titulo,
      descricao: ticket.descricao,
      cliente_id: ticket.cliente_id,
      equipamento_tipo: ticket.equipamento_tipo,
      prioridade: ticket.prioridade,
      endereco_servico: ticket.endereco_servico,
      data_servico: ticket.data_servico || '',
      data_vencimento: ticket.data_vencimento ? new Date(ticket.data_vencimento).toISOString().split('T')[0] : '',
      horario_previsto_inicio: ticket.horario_previsto_inicio || '',
      tempo_estimado: ticket.tempo_estimado || undefined,
      observacoes: ticket.observacoes || '',
      anexos: ticket.anexos || [],
    });
    setIsDialogOpen(true);
  };

  const handleAssignTechnician = async (ticketId: string, technicianId: string) => {
    try {
      if (!technicianId) {
        toast({
          title: 'Erro',
          description: 'Selecione um técnico',
          variant: 'destructive',
        });
        return;
      }

      // Atribuir técnico ao ticket
      const { error } = await supabase
        .from('tickets')
        .update({ 
          tecnico_responsavel_id: technicianId
        })
        .eq('id', ticketId);

      if (error) throw error;

      // Se já existe OS, atualizar o tecnico_id na OS também
      // Buscar prestador para encontrar o técnico correspondente
      const { data: prestador } = await supabase
        .from('prestadores')
        .select('email')
        .eq('id', technicianId)
        .single();

      if (prestador?.email) {
        const { data: tecnico } = await supabase
          .from('tecnicos')
          .select('id, profiles!inner(email)')
          .ilike('profiles.email', prestador.email)
          .maybeSingle();

        if (tecnico) {
          await supabase
            .from('ordens_servico')
            .update({ tecnico_id: tecnico.id })
            .eq('ticket_id', ticketId);
        }
      }

      toast({
        title: 'Sucesso',
        description: 'Técnico atribuído com sucesso.',
      });

      loadData();
    } catch (error: any) {
      logger.error('Erro ao atribuir técnico:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao atribuir técnico',
        variant: 'destructive',
      });
    }
  };

  const handleApprove = async (ticketId: string) => {
    try {
      setLoading(true);
      
      // Atualizar status do ticket
      const { error: updateError } = await supabase
        .from('tickets')
        .update({ status: 'aprovado' })
        .eq('id', ticketId);

      if (updateError) throw updateError;

      // Registrar aprovação
      const { error: approvalError } = await supabase
        .from('aprovacoes')
        .insert({
          ticket_id: ticketId,
          aprovador_id: profile?.id,
          status: 'aprovado',
          observacoes: 'Aprovado automaticamente'
        });

      if (approvalError) throw approvalError;

      toast({
        title: 'Sucesso',
        description: 'Ticket aprovado. Agora pode atribuir um técnico.',
      });

      // Mudar para a aba de aprovados
      setActiveTab('aprovado');
      loadData();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao aprovar ticket',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (ticketId: string) => {
    try {
      setLoading(true);
      
      // Atualizar status do ticket
      const { error: updateError } = await supabase
        .from('tickets')
        .update({ status: 'rejeitado' })
        .eq('id', ticketId);

      if (updateError) throw updateError;

      // Registrar rejeição
      const { error: approvalError } = await supabase
        .from('aprovacoes')
        .insert({
          ticket_id: ticketId,
          aprovador_id: profile?.id,
          status: 'rejeitado',
          observacoes: 'Rejeitado'
        });

      if (approvalError) throw approvalError;

      toast({
        title: 'Sucesso',
        description: 'Ticket rejeitado',
      });

      // Manter na mesma aba ou mostrar todos
      setActiveTab('todos');
      loadData();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao rejeitar ticket',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateOS = async (ticketId: string) => {
    try {
      setGeneratingOsId(ticketId);
      
      const { data, error } = await supabase.functions.invoke('gerar-ordem-servico', {
        body: { ticketId }
      });

      if (error) {
        throw error;
      }

      const isExisting = data?.message === 'Ordem de serviço já existente';

      toast({
        title: 'Sucesso',
        description: isExisting 
          ? 'Ordem de serviço já foi gerada anteriormente!' 
          : 'Ordem de serviço gerada com sucesso!',
      });

      // Abrir PDF em nova aba se disponível
      if (data?.pdfUrl) {
        window.open(data.pdfUrl, '_blank');
      } else {
        toast({
          title: 'Informação',
          description: 'A OS foi gerada. O PDF estará disponível em breve na aba "OS Gerada".',
        });
      }

      // Mudar para a aba de OS gerada
      setActiveTab('ordem_servico_gerada');
      loadData();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao gerar ordem de serviço',
        variant: 'destructive',
      });
    } finally {
      setGeneratingOsId(null);
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from("tickets")
        .delete()
        .eq("id", ticketId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Ticket excluído com sucesso",
      });

      setActiveTab('todos');
      loadData();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir ticket",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    const clienteNome = ticket.clientes?.empresa || ticket.clientes?.profiles?.nome || '';
    const matchesSearch = ticket.titulo.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                         ticket.numero_ticket.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                         clienteNome.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
    
    const matchesCliente = selectedCliente === 'todos' || ticket.cliente_id === selectedCliente;
    const matchesPrioridade = selectedPrioridade === 'todas' || ticket.prioridade === selectedPrioridade;
    const matchesUfvSolarz = selectedUfvSolarz === 'todos' || ticket.clientes?.ufv_solarz === selectedUfvSolarz;
    
    if (activeTab === 'todos') return matchesSearch && matchesCliente && matchesPrioridade && matchesUfvSolarz;
    return matchesSearch && matchesCliente && matchesPrioridade && matchesUfvSolarz && ticket.status === activeTab;
  });

  const getStatusColor = (status: string) => {
    const colors = {
      'aberto': 'bg-blue-100 text-blue-800',
      'aguardando_aprovacao': 'bg-yellow-100 text-yellow-800',
      'aprovado': 'bg-green-100 text-green-800',
      'rejeitado': 'bg-red-100 text-red-800',
      'ordem_servico_gerada': 'bg-purple-100 text-purple-800',
      'em_execucao': 'bg-orange-100 text-orange-800',
      'aguardando_rme': 'bg-indigo-100 text-indigo-800',
      'concluido': 'bg-gray-100 text-gray-800',
      'cancelado': 'bg-red-100 text-red-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getPrioridadeColor = (prioridade: string) => {
    const colors = {
      'baixa': 'bg-green-100 text-green-800',
      'media': 'bg-yellow-100 text-yellow-800',
      'alta': 'bg-orange-100 text-orange-800',
      'critica': 'bg-red-100 text-red-800'
    };
    return colors[prioridade as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getGeocodingStatusBadge = (status: string | null | undefined) => {
    if (!status) return null;
    
    const config: Record<string, {
      variant: 'secondary' | 'destructive';
      className: string;
      icon: typeof Clock;
      label: string;
      iconClass?: string;
    }> = {
      'pending': {
        variant: 'secondary',
        className: 'bg-yellow-100 text-yellow-800 border-yellow-300',
        icon: Clock,
        label: 'Pendente'
      },
      'processing': {
        variant: 'secondary',
        className: 'bg-blue-100 text-blue-800 border-blue-300',
        icon: Loader2,
        label: 'Processando',
        iconClass: 'animate-spin'
      },
      'geocoded': {
        variant: 'secondary',
        className: 'bg-green-100 text-green-800 border-green-300',
        icon: MapPin,
        label: 'Geocodificado'
      },
      'failed': {
        variant: 'destructive',
        className: 'bg-red-100 text-red-800 border-red-300',
        icon: MapPinOff,
        label: 'Falhou'
      }
    };
    
    const statusConfig = config[status];
    if (!statusConfig) return null;
    
    const Icon = statusConfig.icon;
    
    return (
      <Badge variant={statusConfig.variant} className={statusConfig.className}>
        <Icon className={`h-3 w-3 mr-1 ${statusConfig.iconClass || ''}`} />
        {statusConfig.label}
      </Badge>
    );
  };

  const handleReprocessGeocode = async (ticketId: string, address: string) => {
    try {
      setReprocessingTicketId(ticketId);
      
      // Marcar como processing
      await supabase
        .from('tickets')
        .update({ geocoding_status: 'processing' })
        .eq('id', ticketId);
      
      // Forçar geocodificação com force_refresh para ignorar cache
      const result = await geocodeAddress(address, ticketId, true);
      
      if (result) {
        toast({
          title: 'Sucesso',
          description: `Endereço geocodificado: ${result.latitude?.toFixed(5)}, ${result.longitude?.toFixed(5)}`,
        });
        loadData();
      }
    } catch (error: any) {
      logger.error('Erro ao reprocessar geocodificação:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao geocodificar endereço',
        variant: 'destructive'
      });
    } finally {
      setReprocessingTicketId(null);
    }
  };

  const getEquipamentoIcon = (tipo: string) => {
    return <Settings className="h-4 w-4" />;
  };

  if (loading && tickets.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tickets</h1>
          <p className="text-muted-foreground">Gerencie solicitações de manutenção</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingTicket(null); setSelectedUfvSolarzForm(''); form.reset(); }}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Ticket
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTicket ? 'Editar Ticket' : 'Criar Novo Ticket'}</DialogTitle>
              <DialogDescription>
                {editingTicket ? 'Atualize os dados do ticket' : 'Preencha os dados para criar um novo ticket'}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="titulo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Título</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Manutenção em painel solar" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* UFV/SolarZ - com auto-preenchimento */}
                  <FormItem>
                    <FormLabel>UFV/SolarZ</FormLabel>
                    <Select 
                      value={selectedUfvSolarzForm}
                      onValueChange={(value) => {
                        setSelectedUfvSolarzForm(value);
                        // Buscar cliente associado e preencher automaticamente
                        const clienteAssociado = clientes.find((c: any) => c.ufv_solarz === value);
                        if (clienteAssociado) {
                          form.setValue('cliente_id', clienteAssociado.id);
                          const endereco = `${clienteAssociado.endereco || ''}, ${clienteAssociado.cidade || ''}, ${clienteAssociado.estado || ''} - ${clienteAssociado.cep || ''}`.trim().replace(/^,\s*|,\s*$/, '');
                          form.setValue('endereco_servico', endereco);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a UFV/SolarZ" />
                      </SelectTrigger>
                      <SelectContent>
                        {ufvSolarzListForForm.map((ufv) => (
                          <SelectItem key={ufv} value={ufv}>
                            {ufv}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="cliente_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cliente</FormLabel>
                        <Select onValueChange={(value) => {
                          field.onChange(value);
                          // Auto-preencher endereço baseado no cliente selecionado
                          const clienteSelecionado = clientes.find((c: any) => c.id === value);
                          if (clienteSelecionado) {
                            const endereco = `${clienteSelecionado.endereco || ''}, ${clienteSelecionado.cidade || ''}, ${clienteSelecionado.estado || ''} - ${clienteSelecionado.cep || ''}`.trim().replace(/^,\s*|,\s*$/, '');
                            form.setValue('endereco_servico', endereco);
                            // Atualizar o UFV/SolarZ selecionado
                            if (clienteSelecionado.ufv_solarz) {
                              setSelectedUfvSolarzForm(clienteSelecionado.ufv_solarz);
                            }
                          }
                        }} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um cliente" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {clientes.map((cliente: any) => (
                              <SelectItem key={cliente.id} value={cliente.id}>
                                {cliente.empresa || cliente.profiles?.nome}
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
                    name="descricao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Descreva o problema..." rows={1} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="endereco_servico"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endereço do Serviço</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Endereço completo onde o serviço será realizado..." rows={2} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="equipamento_tipo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Equipamento</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="painel_solar">Painel Solar</SelectItem>
                            <SelectItem value="inversor">Inversor</SelectItem>
                            <SelectItem value="controlador_carga">Controlador de Carga</SelectItem>
                            <SelectItem value="bateria">Bateria</SelectItem>
                            <SelectItem value="cabeamento">Cabeamento</SelectItem>
                            <SelectItem value="estrutura">Estrutura</SelectItem>
                            <SelectItem value="monitoramento">Sistema de Monitoramento</SelectItem>
                            <SelectItem value="outros">Outros</SelectItem>
                          </SelectContent>
                        </Select>
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
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="baixa">Baixa</SelectItem>
                            <SelectItem value="media">Média</SelectItem>
                            <SelectItem value="alta">Alta</SelectItem>
                            <SelectItem value="critica">Crítica</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="endereco_servico"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endereço do Serviço</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Endereço completo onde o serviço será realizado..." rows={2} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="data_servico"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Serviço</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="data_vencimento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data Limite (Vencimento)</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="horario_previsto_inicio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Horário Previsto</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} placeholder="08:00" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {form.watch('data_servico') && form.watch('data_vencimento') && new Date(form.watch('data_servico')!) > new Date(form.watch('data_vencimento')!) && (
                  <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                    <Clock className="h-4 w-4 shrink-0" />
                    <span>A data de serviço está após a data limite de vencimento.</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="tempo_estimado"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tempo Estimado (horas)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                            placeholder="Ex: 4"
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
                        <Textarea {...field} placeholder="Informações adicionais..." rows={2} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="anexos"
                  render={() => (
                    <FormItem>
                      <FormLabel>Anexos</FormLabel>
                      <FormControl>
                        <FileUpload
                          ticketId={editingTicket?.id || 'temp-' + Date.now()}
                          existingFiles={attachments}
                          onFilesChange={setAttachments}
                          maxFiles={5}
                          maxSizeMB={10}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Salvando...' : editingTicket ? 'Atualizar' : 'Criar Ticket'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar tickets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="aberto">Abertos</TabsTrigger>
          <TabsTrigger value="aprovado">Aprovados</TabsTrigger>
          <TabsTrigger value="ordem_servico_gerada">OS Gerada</TabsTrigger>
          <TabsTrigger value="em_execucao">Em Execução</TabsTrigger>
          <TabsTrigger value="concluido">Concluídos</TabsTrigger>
          <TabsTrigger value="cancelado">Cancelados</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {filteredTickets.length === 0 ? (
            <EmptyState
              icon={TicketIcon}
              title="Nenhum ticket encontrado"
              description={debouncedSearchTerm ? 'Tente ajustar os filtros de busca' : 'Crie seu primeiro ticket para começar'}
              actionLabel={!debouncedSearchTerm ? "Criar Ticket" : undefined}
              onAction={!debouncedSearchTerm ? () => setIsDialogOpen(true) : undefined}
            />
          ) : (
            <div className="grid gap-4">
              {filteredTickets.map((ticket) => (
                <Card key={ticket.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{ticket.titulo}</CardTitle>
                          <Badge variant="outline" className="text-xs">
                            {ticket.numero_ticket}
                          </Badge>
                        </div>
                        <CardDescription className="flex items-center gap-2 flex-wrap">
                          <span>Cliente: {ticket.clientes?.empresa || ticket.clientes?.profiles?.nome}</span>
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs flex items-center gap-1">
                            <Star className="h-3 w-3" />
                            P{ticket.clientes?.prioridade ?? 5}
                          </Badge>
                          {ticket.clientes?.ufv_solarz && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                              UFV/SolarZ: {ticket.clientes.ufv_solarz}
                            </Badge>
                          )}
                        </CardDescription>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge className={getStatusColor(ticket.status)}>
                          {ticket.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                        <Badge className={getPrioridadeColor(ticket.prioridade)}>
                          {ticket.prioridade.toUpperCase()}
                        </Badge>
                        {getGeocodingStatusBadge(ticket.geocoding_status)}
                        {(ticket.status === 'ordem_servico_gerada' || ticket.status === 'em_execucao' || ticket.status === 'concluido') && ticket.ordens_servico?.[0] && (
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                            <FileText className="h-3 w-3 mr-1" />
                            {ticket.ordens_servico[0].numero_os}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">{ticket.descricao}</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          {getEquipamentoIcon(ticket.equipamento_tipo)}
                          <span>{ticket.equipamento_tipo.replace('_', ' ')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <span className="truncate">{ticket.endereco_servico}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>{new Date(ticket.data_abertura).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>

                      {ticket.tempo_estimado && (
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4" />
                          <span>{ticket.tempo_estimado} horas estimadas</span>
                        </div>
                      )}

                      {ticket.tecnico_responsavel_id && ticket.prestadores && (
                        <p className="text-sm text-muted-foreground">
                          <strong>Técnico:</strong> {ticket.prestadores.nome}
                        </p>
                      )}

                      {/* Status de coordenadas */}
                      {ticket.latitude && ticket.longitude && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4 text-green-600" />
                          <span>
                            Coordenadas: {Number(ticket.latitude).toFixed(6)}, {Number(ticket.longitude).toFixed(6)}
                          </span>
                        </div>
                      )}

                      {/* Botão reprocessar geocodificação */}
                      {(ticket.geocoding_status === 'failed' || ticket.geocoding_status === 'pending' || !ticket.latitude || !ticket.longitude) && (profile?.role === 'admin' || profile?.role === 'area_tecnica') && (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReprocessGeocode(ticket.id, ticket.endereco_servico)}
                            disabled={reprocessingTicketId === ticket.id || geocoding}
                            className="border-orange-300 text-orange-700 hover:bg-orange-50"
                          >
                            {reprocessingTicketId === ticket.id ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Geocodificando...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                {ticket.geocoding_status === 'pending' ? 'Geocodificar' : 'Regeocodificar'}
                              </>
                            )}
                          </Button>
                        </div>
                      )}

                      {/* Botões de ação conforme status e role */}
                      {(profile?.role === 'admin' || profile?.role === 'area_tecnica') && (
                        <div className="flex flex-wrap gap-2 pt-2 border-t">
                          {ticket.status === 'aberto' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleApprove(ticket.id)}
                                disabled={loading}
                                className="flex items-center gap-2"
                              >
                                <CheckCircle className="h-4 w-4" />
                                Aprovar
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleReject(ticket.id)}
                                disabled={loading}
                                className="flex items-center gap-2"
                              >
                                <XCircle className="h-4 w-4" />
                                Rejeitar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(ticket)}
                              >
                                Editar
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="destructive">
                                    Excluir
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja excluir este ticket? Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteTicket(ticket.id)}>
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}

                          {ticket.status === 'aprovado' && !ticket.tecnico_responsavel_id && (
                            <>
                              <Select onValueChange={(value) => handleAssignTechnician(ticket.id, value)}>
                                <SelectTrigger className="h-8 w-[200px]">
                                  <SelectValue placeholder="Atribuir técnico" />
                                </SelectTrigger>
                                <SelectContent>
                                  {prestadores.map((prestador) => (
                                    <SelectItem key={prestador.id} value={prestador.id}>
                                      {prestador.nome}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(ticket)}
                              >
                                Editar
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="destructive">
                                    Excluir
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja excluir este ticket? Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteTicket(ticket.id)}>
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}

                          {ticket.status === 'aprovado' && ticket.tecnico_responsavel_id && (
                            <>
                              <Select onValueChange={(value) => handleAssignTechnician(ticket.id, value)} defaultValue={ticket.tecnico_responsavel_id}>
                                <SelectTrigger className="h-8 w-[200px]">
                                  <SelectValue placeholder="Trocar técnico" />
                                </SelectTrigger>
                                <SelectContent>
                                  {prestadores.map((prestador) => (
                                    <SelectItem key={prestador.id} value={prestador.id}>
                                      {prestador.nome}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                onClick={() => handleGenerateOS(ticket.id)}
                                disabled={generatingOsId === ticket.id}
                                className="flex items-center gap-2"
                              >
                                <FileText className="h-4 w-4" />
                                {generatingOsId === ticket.id ? 'Gerando...' : 'Gerar Ordem de Serviço'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(ticket)}
                              >
                                Editar
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="destructive">
                                    Excluir
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja excluir este ticket? Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteTicket(ticket.id)}>
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}

                          {(ticket.status === 'ordem_servico_gerada' || ticket.status === 'em_execucao') && (
                            <Select onValueChange={(value) => handleAssignTechnician(ticket.id, value)} defaultValue={ticket.tecnico_responsavel_id || undefined}>
                              <SelectTrigger className="h-8 w-[200px]">
                                <SelectValue placeholder="Trocar técnico" />
                              </SelectTrigger>
                              <SelectContent>
                                {prestadores.map((prestador) => (
                                  <SelectItem key={prestador.id} value={prestador.id}>
                                    {prestador.nome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}

                          {(ticket.status === 'ordem_servico_gerada' || ticket.status === 'em_execucao' || ticket.status === 'concluido') && (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={async () => {
                                  try {
                                    const os = ticket.ordens_servico?.[0];
                                    if (!os) {
                                      toast({
                                        title: 'Aviso',
                                        description: 'OS não encontrada',
                                        variant: 'default'
                                      });
                                      return;
                                    }

                                    if (os.pdf_url) {
                                      // Extrair apenas o caminho do arquivo
                                      const filePath = os.pdf_url.replace('ordens-servico/', '');
                                      
                                      const { data: signedUrlData, error } = await supabase.storage
                                        .from('ordens-servico')
                                        .createSignedUrl(filePath, 60 * 60 * 24 * 7);
                                      
                                      if (error) {
                                        logger.error('Erro ao gerar URL:', error);
                                        throw error;
                                      }
                                      
                                      if (signedUrlData?.signedUrl) {
                                        window.open(signedUrlData.signedUrl, '_blank');
                                      } else {
                                        toast({
                                          title: 'Aviso',
                                          description: 'PDF ainda não disponível',
                                          variant: 'default'
                                        });
                                      }
                                    } else {
                                      toast({
                                        title: 'Aviso',
                                        description: 'PDF ainda não gerado',
                                        variant: 'default'
                                      });
                                    }
                                  } catch (error: any) {
                                    logger.error('Erro ao abrir OS:', error);
                                    toast({
                                      title: 'Erro',
                                      description: 'Erro ao abrir OS: ' + error.message,
                                      variant: 'destructive'
                                    });
                                  }
                                }}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Ver OS {ticket.ordens_servico?.[0]?.numero_os}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(ticket)}
                              >
                                Editar
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="destructive">
                                    Excluir
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja excluir este ticket? Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteTicket(ticket.id)}>
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}

                          {(ticket.status === 'em_execucao' || ticket.status === 'concluido') && (
                            <>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={async () => {
                                  try {
                                    const { data: os } = await supabase
                                      .from('ordens_servico')
                                      .select('pdf_url')
                                      .eq('ticket_id', ticket.id)
                                      .single();
                                    
                                    if (os?.pdf_url) {
                                      const { data: signedUrlData } = await supabase.storage
                                        .from('ordens-servico')
                                        .createSignedUrl(os.pdf_url, 60 * 60 * 24 * 7);
                                      
                                      if (signedUrlData?.signedUrl) {
                                        window.open(signedUrlData.signedUrl, '_blank');
                                      }
                                    }
                                  } catch (error) {
                                    console.error('Erro ao abrir OS:', error);
                                  }
                                }}
                              >
                                <Download className="h-4 w-4 mr-1" />
                                Ver OS
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(ticket)}
                              >
                                Editar
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="destructive">
                                    Excluir
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja excluir este ticket? Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteTicket(ticket.id)}>
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}

                          {(ticket.status === 'rejeitado' || ticket.status === 'cancelado') && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive">
                                  Excluir
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja excluir este ticket {ticket.status === 'cancelado' ? 'cancelado' : 'rejeitado'}? Esta ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteTicket(ticket.id)}>
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      )}

                      {profile?.role !== 'admin' && profile?.role !== 'area_tecnica' && (
                        <div className="flex justify-end pt-2 border-t">
                          <span className="text-xs text-muted-foreground">
                            Criado em {new Date(ticket.created_at).toLocaleString('pt-BR')}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Tickets;