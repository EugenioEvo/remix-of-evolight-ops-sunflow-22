import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from '@/services/api';
import { useAuth } from "@/hooks/useAuth";
import { useTicketsRealtime } from "@/hooks/useTicketsRealtime";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileText, Eye, Calendar, MapPin, User, Play, Edit, Phone, Navigation, ClipboardList, AlertCircle, CheckCircle2, Info, Filter } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { TechnicianBreadcrumb } from "@/components/TechnicianBreadcrumb";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useTechnicianStore } from "@/hooks/useTechnicianStore";
import { generateOSPDF } from "@/utils/generateOSPDF";

interface OrdemServico {
  id: string;
  numero_os: string;
  data_emissao: string;
  data_programada: string | null;
  pdf_url: string | null;
  ticket_id: string;
  hora_inicio?: string;
  hora_fim?: string;
  equipe?: string[];
  servico_solicitado?: string;
  inspetor_responsavel?: string;
  tipo_trabalho?: string[];
  tickets: {
    id: string;
    numero_ticket: string;
    titulo: string;
    descricao?: string;
    endereco_servico: string;
    prioridade: string;
    status: string;
    data_inicio_execucao: string | null;
    clientes: {
      empresa: string;
      endereco?: string;
      cidade?: string;
      estado?: string;
      profiles?: {
        telefone?: string;
      };
    };
  };
}

const MinhasOS = () => {
  const [ordensServico, setOrdensServico] = useState<OrdemServico[]>([]);
  const [loading, setLoading] = useState(true);
  const [prioridadeFiltro, setPrioridadeFiltro] = useState<string>('todas');
  const [periodoFiltro, setPeriodoFiltro] = useState<string>('todos');
  const [activeTab, setActiveTab] = useState<string>('pendentes');
  const [startingId, setStartingId] = useState<string | null>(null);
  const [navigating, setNavigating] = useState<string | null>(null);
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { tecnicoId, setTecnicoId, shouldRefetch, setOrdensServico: setCachedOS } = useTechnicianStore();

  const isTecnico = profile?.role === "tecnico_campo";
  const isAreaTecnica = profile?.role === "area_tecnica" || profile?.role === "admin";
  const canViewOS = isTecnico || isAreaTecnica;

  // Auto-reload quando houver mudanças em tickets/OS
  useTicketsRealtime({
    onTicketChange: () => {
      if (canViewOS) {
        loadOrdensServico();
      }
    }
  });

  useEffect(() => {
    if (canViewOS) {
      loadOrdensServico();
    }
  }, [canViewOS]);

  const loadOrdensServico = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from("ordens_servico")
        .select(`
          *,
          data_programada,
          hora_inicio,
          hora_fim,
          equipe,
          servico_solicitado,
          inspetor_responsavel,
          tipo_trabalho,
          tickets!inner (
            id,
            numero_ticket,
            titulo,
            descricao,
            endereco_servico,
            prioridade,
            status,
            data_inicio_execucao,
            clientes (
              empresa,
              endereco,
              cidade,
              estado,
              profiles!clientes_profile_id_fkey(telefone)
            )
          )
        `)
        .order("data_emissao", { ascending: false });

      // Se for técnico de campo, filtrar apenas suas OSs
      if (isTecnico) {
        const { data: tecnicoData, error: tecnicoError } = await supabase
          .from("tecnicos")
          .select("id")
          .eq("profile_id", profile?.id)
          .single();

        if (tecnicoError) {
          toast({
            title: "Erro ao carregar perfil",
            description: "Seu usuário não está vinculado a um perfil de técnico. Solicite à área técnica o cadastro do seu usuário como técnico ou ajuste o e-mail.",
            variant: "destructive",
          });
          throw tecnicoError;
        }
        
        query = query.eq("tecnico_id", tecnicoData.id);
      }
      // Área técnica e admin veem todas as OSs

      const { data: osData, error: osError } = await query;

      if (osError) throw osError;

      setOrdensServico(osData || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar ordens de serviço",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleIniciarExecucao = async (os: OrdemServico) => {
    setStartingId(os.id);
    try {
      const { error } = await supabase
        .from("tickets")
        .update({ 
          status: "em_execucao",
          data_inicio_execucao: new Date().toISOString()
        })
        .eq("id", os.ticket_id);

      if (error) {
        // Mensagem de erro específica para permissão negada
        if (error.code === '42501' || error.message?.includes('permission') || error.message?.includes('policy')) {
          toast({
            title: "Sem permissão para iniciar execução",
            description: "Você não tem permissão para alterar o status deste ticket. Fale com o administrador.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      // Recarregar IMEDIATAMENTE após a atualização
      await loadOrdensServico();

      toast({
        title: "Execução iniciada!",
        description: "A OS foi movida para a aba 'Em Execução'. Agora você pode preencher o RME.",
      });

      // Mudar para a aba "Em Execução" APÓS recarregar
      setActiveTab('execucao');
    } catch (error: any) {
      toast({
        title: "Erro ao iniciar execução",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setStartingId(null);
    }
  };

  const handlePreencherRME = async (os: OrdemServico) => {
    setNavigating(os.id);
    // Pequeno delay para garantir que o banco está sincronizado
    await new Promise(resolve => setTimeout(resolve, 300));
    navigate(`/rme?os=${os.id}`);
  };

  const handleVerOS = async (os: OrdemServico) => {
    try {
      // Gerar PDF formatado usando a função de geração
      const pdfData = {
        numero_os: os.numero_os,
        data_programada: os.data_programada || new Date().toISOString(),
        equipe: os.equipe || ['Não informado'],
        cliente: os.tickets.clientes?.empresa || 'Não informado',
        endereco: `${os.tickets.clientes?.endereco || os.tickets.endereco_servico}, ${os.tickets.clientes?.cidade || ''} - ${os.tickets.clientes?.estado || ''}`,
        servico_solicitado: os.servico_solicitado || 'MANUTENÇÃO',
        hora_marcada: os.hora_inicio || '00:00',
        descricao: os.tickets.descricao || os.tickets.titulo || '',
        inspetor_responsavel: os.inspetor_responsavel || 'TODOS',
        tipo_trabalho: os.tipo_trabalho || []
      };

      const pdfBlob = await generateOSPDF(pdfData);

      // Criar link de download direto
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `OS_${os.numero_os}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Limpar URL após download
      setTimeout(() => URL.revokeObjectURL(url), 100);

      toast({
        title: "PDF baixado",
        description: `Ordem de serviço ${os.numero_os} baixada com sucesso.`,
      });
    } catch (error: any) {
      console.error('Erro ao gerar PDF:', error);
      toast({
        title: "Erro ao abrir PDF",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleLigarCliente = (telefone?: string) => {
    if (!telefone) {
      toast({
        title: "Telefone não disponível",
        description: "Este cliente não possui telefone cadastrado.",
        variant: "destructive",
      });
      return;
    }
    window.location.href = `tel:${telefone}`;
  };

  const handleAbrirMapa = (endereco: string) => {
    const encodedAddress = encodeURIComponent(endereco);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, "_blank");
  };

  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case "critica":
        return "destructive";
      case "alta":
        return "default";
      case "media":
        return "secondary";
      case "baixa":
        return "outline";
      default:
        return "outline";
    }
  };

  const getStatusBadge = (status: string) => {
    const labels: Record<string, { label: string; variant: any }> = {
      'ordem_servico_gerada': { label: 'Pendente', variant: 'outline' },
      'em_execucao': { label: 'Em Execução', variant: 'default' },
      'concluido': { label: 'Concluído', variant: 'secondary' },
    };
    return labels[status] || { label: status, variant: 'outline' };
  };

  const renderOSCard = (os: OrdemServico) => {
    const statusBadge = getStatusBadge(os.tickets.status);
    const isPendente = os.tickets.status === 'ordem_servico_gerada';
    const emExecucao = os.tickets.status === 'em_execucao';
    const concluido = os.tickets.status === 'concluido';

    return (
      <Card key={os.id} className="hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 min-w-0 flex-1">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2 truncate">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                <span className="truncate">{os.numero_os}</span>
              </CardTitle>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-xs">
                  {os.tickets.numero_ticket}
                </Badge>
                {isPendente && (
                  <Badge variant="secondary" className="text-xs flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    <span className="hidden sm:inline">Próximo: Iniciar</span>
                    <span className="sm:hidden">Iniciar</span>
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1 items-end flex-shrink-0">
              <Badge variant={getPrioridadeColor(os.tickets.prioridade)} className="text-xs">
                {os.tickets.prioridade}
              </Badge>
              <Badge variant={statusBadge.variant as any} className="text-xs">
                {statusBadge.label}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium text-sm mb-2">{os.tickets.titulo}</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span className="line-clamp-1">{os.tickets.clientes?.empresa || 'Cliente não definido'}</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span className="line-clamp-2">{os.tickets.endereco_servico}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                Emitida: {format(new Date(os.data_emissao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            </div>
            {os.data_programada && (
              <div className="flex items-center gap-2 text-primary font-medium">
                <Calendar className="h-4 w-4" />
                <span>
                  Agendada: {format(new Date(os.data_programada), "dd/MM/yyyy", { locale: ptBR })}
                  {/* @ts-ignore */}
                  {os.hora_inicio && os.hora_fim && ` às ${os.hora_inicio} - ${os.hora_fim}`}
                </span>
                {new Date(os.data_programada).toDateString() === new Date().toDateString() && (
                  <Badge variant="default" className="ml-2">HOJE</Badge>
                )}
              </div>
            )}
            {os.tickets.data_inicio_execucao && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>
                  Iniciada: {format(new Date(os.tickets.data_inicio_execucao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
              </div>
            )}
          </div>

          {/* Ações Rápidas */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleLigarCliente(os.tickets.clientes?.profiles?.telefone)}
              disabled={!os.tickets.clientes?.profiles?.telefone}
              className="flex-1"
            >
              <Phone className="h-4 w-4 mr-1" />
              Ligar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAbrirMapa(os.tickets.endereco_servico)}
              className="flex-1"
            >
              <Navigation className="h-4 w-4 mr-1" />
              Mapa
            </Button>
          </div>

          {/* Botões de Ação Principal */}
          <div className="space-y-2">
            {isPendente && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => handleIniciarExecucao(os)}
                      className="w-full"
                      disabled={startingId === os.id}
                    >
                      {startingId === os.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Iniciando...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Iniciar Execução
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Inicie a execução para depois preencher o RME</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {emExecucao && (
              <Button
                onClick={() => handlePreencherRME(os)}
                className="w-full"
                disabled={navigating === os.id}
              >
                {navigating === os.id ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Carregando RME...
                  </>
                ) : (
                  <>
                    <Edit className="h-4 w-4 mr-2" />
                    Preencher RME
                  </>
                )}
              </Button>
            )}

            {isPendente && (
              <Badge variant="outline" className="w-full justify-center py-2">
                <ClipboardList className="h-3 w-3 mr-1" />
                Próximo: Iniciar Execução
              </Badge>
            )}

            {emExecucao && (
              <Badge variant="default" className="w-full justify-center py-2">
                <Edit className="h-3 w-3 mr-1" />
                Próximo: Preencher RME
              </Badge>
            )}

            <Button
              onClick={() => handleVerOS(os)}
              variant="outline"
              className="w-full"
            >
              <Eye className="h-4 w-4 mr-2" />
              Ver OS em PDF
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (!canViewOS) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              Esta página é exclusiva para técnicos de campo e área técnica.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <TechnicianBreadcrumb current="minhas-os" />
        <LoadingState variant="card" count={6} />
      </div>
    );
  }

  // Aplicar filtros
  let osFiltradas = ordensServico;
  
  if (prioridadeFiltro !== 'todas') {
    osFiltradas = osFiltradas.filter(os => os.tickets.prioridade === prioridadeFiltro);
  }

  const pendentes = osFiltradas.filter(os => os.tickets.status === 'ordem_servico_gerada');
  const emExecucao = osFiltradas.filter(os => os.tickets.status === 'em_execucao');
  const concluidas = osFiltradas.filter(os => os.tickets.status === 'concluido');

  return (
    <TooltipProvider>
      <div className="p-4 sm:p-6 space-y-6">
        <TechnicianBreadcrumb current="minhas-os" />
        
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6 sm:h-8 sm:w-8" />
            Minhas Ordens de Serviço
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Gerencie suas ordens de serviço por status
          </p>
        </div>

        {/* Filtros */}
        {ordensServico.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Prioridade
                  </label>
                  <Select value={prioridadeFiltro} onValueChange={setPrioridadeFiltro}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as prioridades" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas</SelectItem>
                      <SelectItem value="critica">Crítica</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="baixa">Baixa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(prioridadeFiltro !== 'todas') && (
                  <div className="flex items-end">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setPrioridadeFiltro('todas');
                        setPeriodoFiltro('todos');
                      }}
                    >
                      Limpar Filtros
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {ordensServico.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Nenhuma OS atribuída"
            description="Você ainda não possui ordens de serviço atribuídas. Aguarde a atribuição de uma OS pela equipe técnica."
          />
        ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pendentes" className="relative">
              Pendentes
              {pendentes.length > 0 && (
                <Badge className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center">
                  {pendentes.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="execucao" className="relative">
              Em Execução
              {emExecucao.length > 0 && (
                <Badge className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center">
                  {emExecucao.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="concluidas">
              Concluídas
              {concluidas.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center">
                  {concluidas.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pendentes" className="mt-6">
            {pendentes.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="Nenhuma OS pendente"
                description="Todas as suas ordens de serviço já foram iniciadas ou concluídas."
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pendentes.map(renderOSCard)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="execucao" className="mt-6">
            {emExecucao.length === 0 ? (
              <EmptyState
                icon={Play}
                title="Nenhuma OS em execução"
                description="Inicie a execução de uma OS pendente para que ela apareça aqui."
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {emExecucao.map(renderOSCard)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="concluidas" className="mt-6">
            {concluidas.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="Nenhuma OS concluída"
                description="As ordens de serviço concluídas aparecerão aqui após o preenchimento do RME."
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {concluidas.map(renderOSCard)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
      </div>
    </TooltipProvider>
  );
};

export default MinhasOS;
