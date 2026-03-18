import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from '@/services/api';
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoadingState } from "./LoadingState";
import { EmptyState } from "./EmptyState";
import { ClipboardList, Clock, CheckCircle2, AlertCircle, MapPin, FileText, Calendar, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OSStats {
  pendentes: number;
  emExecucao: number;
  concluidasHoje: number;
  totalConcluidas: number;
}

const TechnicianDashboard = () => {
  const [stats, setStats] = useState<OSStats>({ pendentes: 0, emExecucao: 0, concluidasHoje: 0, totalConcluidas: 0 });
  const [recentOS, setRecentOS] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboardData();
  }, [profile]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Buscar ID do técnico
      const { data: tecnicoData } = await supabase
        .from("tecnicos")
        .select("id")
        .eq("profile_id", profile?.id)
        .single();

      if (!tecnicoData) return;

      // Buscar todas as OS do técnico
      const { data: osData } = await supabase
        .from("ordens_servico")
        .select(`
          *,
          data_programada,
          hora_inicio,
          hora_fim,
          tickets!inner(
            status,
            titulo,
            numero_ticket,
            endereco_servico,
            prioridade,
            data_conclusao,
            clientes(empresa)
          )
        `)
        .eq("tecnico_id", tecnicoData.id)
        .order("data_programada", { ascending: true });

      if (osData) {
        const hoje = new Date().toISOString().split('T')[0];
        
        setStats({
          pendentes: osData.filter(os => os.tickets.status === 'ordem_servico_gerada').length,
          emExecucao: osData.filter(os => os.tickets.status === 'em_execucao').length,
          concluidasHoje: osData.filter(os => 
            os.tickets.status === 'concluido' && 
            os.tickets.data_conclusao?.startsWith(hoje)
          ).length,
          totalConcluidas: osData.filter(os => os.tickets.status === 'concluido').length,
        });

        // OS recentes (não concluídas)
        setRecentOS(osData.filter(os => os.tickets.status !== 'concluido').slice(0, 5));
      }
    } catch (error) {
      logger.error("Erro ao carregar dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold">Meu Dashboard</h1>
          <p className="text-sm text-muted-foreground">Carregando seus dados...</p>
        </div>
        <LoadingState variant="card" count={4} />
      </div>
    );
  }

  const hasNoOS = stats.pendentes === 0 && stats.emExecucao === 0 && stats.totalConcluidas === 0;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
          <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8" />
          Meu Dashboard
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Bem-vindo, <span className="font-medium">{profile?.nome}</span>
        </p>
      </div>

      {hasNoOS && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Você ainda não possui ordens de serviço atribuídas. Aguarde a atribuição de uma OS pela equipe técnica.
          </AlertDescription>
        </Alert>
      )}

      {/* Cards de Estatísticas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">OS Pendentes</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendentes}</div>
            <p className="text-xs text-muted-foreground">Aguardando início</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Execução</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.emExecucao}</div>
            <p className="text-xs text-muted-foreground">Trabalhos ativos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Concluídas Hoje</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.concluidasHoje}</div>
            <p className="text-xs text-muted-foreground">Trabalhos finalizados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Concluídas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalConcluidas}</div>
            <p className="text-xs text-muted-foreground">Histórico completo</p>
          </CardContent>
        </Card>
      </div>

      {/* Horário de Hoje */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Meu Horário de Hoje
          </CardTitle>
          <CardDescription>Suas OS agendadas para hoje em ordem de execução</CardDescription>
        </CardHeader>
        <CardContent>
          {recentOS
            .filter(os => {
              if (!os.data_programada) return false;
              const today = new Date().toISOString().split('T')[0];
              return os.data_programada.startsWith(today);
            })
            .sort((a, b) => {
              if (!a.hora_inicio || !b.hora_inicio) return 0;
              return a.hora_inicio.localeCompare(b.hora_inicio);
            })
            .length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma OS agendada para hoje
            </p>
          ) : (
            <div className="space-y-3">
              {recentOS
                .filter(os => {
                  if (!os.data_programada) return false;
                  const today = new Date().toISOString().split('T')[0];
                  return os.data_programada.startsWith(today);
                })
                .sort((a, b) => {
                  if (!a.hora_inicio || !b.hora_inicio) return 0;
                  return a.hora_inicio.localeCompare(b.hora_inicio);
                })
                .map((os) => (
                  <div key={os.id} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex items-center justify-center w-16 h-16 rounded-lg bg-primary/10">
                        <div className="text-center">
                          <div className="text-lg font-bold text-primary">
                            {os.hora_inicio ? os.hora_inicio.substring(0, 5) : '--:--'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {os.hora_fim ? os.hora_fim.substring(0, 5) : '--:--'}
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm truncate">{os.numero_os}</p>
                          <Badge variant={os.tickets.status === 'em_execucao' ? 'default' : 'outline'} className="flex-shrink-0">
                            {os.tickets.status === 'em_execucao' ? 'Em Execução' : 'Pendente'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{os.tickets.titulo}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{os.tickets.endereco_servico}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
          <Button 
            onClick={() => navigate("/routes")} 
            variant="outline" 
            className="w-full mt-4"
          >
            <MapPin className="mr-2 h-4 w-4" />
            Ver Rota Completa no Mapa
          </Button>
        </CardContent>
      </Card>

      {/* Ações Rápidas */}
      <Card>
        <CardHeader>
          <CardTitle>Ações Rápidas</CardTitle>
          <CardDescription>Acesso rápido às suas funções principais</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={() => navigate("/minhas-os")} className="flex-1 min-w-[200px]">
            <ClipboardList className="mr-2 h-4 w-4" />
            Ver Minhas OS
          </Button>
          <Button onClick={() => navigate("/agenda")} variant="outline" className="flex-1 min-w-[200px]">
            <Clock className="mr-2 h-4 w-4" />
            Ver Agenda
          </Button>
          <Button onClick={() => navigate("/rme")} variant="outline" className="flex-1 min-w-[200px]">
            <FileText className="mr-2 h-4 w-4" />
            Preencher RME
          </Button>
        </CardContent>
      </Card>

      {/* OS Recentes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Ordens de Serviço Ativas
          </CardTitle>
          <CardDescription>Suas OS pendentes e em execução</CardDescription>
        </CardHeader>
        <CardContent>
          {recentOS.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma OS ativa no momento
            </p>
          ) : (
            <div className="space-y-3">
              {recentOS.map((os) => (
                <div key={os.id} className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm">{os.numero_os}</p>
                      <Badge variant={os.tickets.status === 'em_execucao' ? 'default' : 'outline'}>
                        {os.tickets.status === 'em_execucao' ? 'Em Execução' : 'Pendente'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{os.tickets.titulo}</p>
                    <p className="text-xs text-muted-foreground">{os.tickets.clientes?.empresa}</p>
                  </div>
                  <Button 
                    size="sm" 
                    onClick={() => navigate("/minhas-os")}
                    variant="ghost"
                  >
                    Ver Detalhes
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TechnicianDashboard;
