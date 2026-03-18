import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Clock, AlertTriangle, TrendingUp, Calendar } from "lucide-react";
import { useEffect, useState } from "react";
import { logger } from '@/services/api';
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PresenceStats {
  total: number;
  confirmadas: number;
  pendentes: number;
  atrasadas: number;
  taxaConfirmacao: number;
}

export const PresenceDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<'week' | 'month'>('week');
  const [stats, setStats] = useState<PresenceStats>({
    total: 0,
    confirmadas: 0,
    pendentes: 0,
    atrasadas: 0,
    taxaConfirmacao: 0
  });

  useEffect(() => {
    loadStats();
  }, [periodFilter]);

  const loadStats = async () => {
    try {
      const now = new Date();
      const startDate = periodFilter === 'week' 
        ? startOfWeek(now, { locale: ptBR })
        : startOfMonth(now);
      const endDate = periodFilter === 'week'
        ? endOfWeek(now, { locale: ptBR })
        : endOfMonth(now);

      const { data, error } = await supabase
        .from('ordens_servico')
        .select(`
          id,
          presence_confirmed_at,
          data_programada,
          tickets!inner(status)
        `)
        .gte('data_programada', startDate.toISOString())
        .lte('data_programada', endDate.toISOString())
        .in('tickets.status', ['ordem_servico_gerada', 'em_execucao', 'concluido']);

      if (error) throw error;

      const total = data?.length || 0;
      const confirmadas = data?.filter(os => os.presence_confirmed_at).length || 0;
      const agora = new Date();
      const atrasadas = data?.filter(os => 
        !os.presence_confirmed_at && 
        new Date(os.data_programada) < agora
      ).length || 0;
      const pendentes = total - confirmadas - atrasadas;
      const taxaConfirmacao = total > 0 ? Math.round((confirmadas / total) * 100) : 0;

      setStats({
        total,
        confirmadas,
        pendentes,
        atrasadas,
        taxaConfirmacao
      });
    } catch (error) {
      logger.error('Erro ao carregar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ 
    title, 
    value, 
    icon: Icon, 
    color, 
    bgColor 
  }: { 
    title: string; 
    value: number; 
    icon: any; 
    color: string; 
    bgColor: string;
  }) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-2">{value}</p>
          </div>
          <div className={`p-4 rounded-full ${bgColor}`}>
            <Icon className={`h-6 w-6 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-20 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex items-center gap-2">
        <Badge 
          variant={periodFilter === 'week' ? 'default' : 'outline'}
          className="cursor-pointer"
          onClick={() => setPeriodFilter('week')}
        >
          Esta Semana
        </Badge>
        <Badge 
          variant={periodFilter === 'month' ? 'default' : 'outline'}
          className="cursor-pointer"
          onClick={() => setPeriodFilter('month')}
        >
          Este Mês
        </Badge>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total de OS"
          value={stats.total}
          icon={Calendar}
          color="text-blue-600"
          bgColor="bg-blue-100"
        />
        <StatCard
          title="Confirmadas"
          value={stats.confirmadas}
          icon={CheckCircle}
          color="text-green-600"
          bgColor="bg-green-100"
        />
        <StatCard
          title="Pendentes"
          value={stats.pendentes}
          icon={Clock}
          color="text-yellow-600"
          bgColor="bg-yellow-100"
        />
        <StatCard
          title="Atrasadas"
          value={stats.atrasadas}
          icon={AlertTriangle}
          color="text-red-600"
          bgColor="bg-red-100"
        />
      </div>

      {/* Taxa de Confirmação */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Taxa de Confirmação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {stats.confirmadas} de {stats.total} confirmadas
              </span>
              <span className="text-2xl font-bold">{stats.taxaConfirmacao}%</span>
            </div>
            <Progress value={stats.taxaConfirmacao} className="h-3" />
            
            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="text-center">
                <div className="w-full h-2 bg-green-500 rounded mb-1" />
                <p className="text-xs text-muted-foreground">Confirmadas</p>
                <p className="text-sm font-medium">{stats.confirmadas}</p>
              </div>
              <div className="text-center">
                <div className="w-full h-2 bg-yellow-500 rounded mb-1" />
                <p className="text-xs text-muted-foreground">Pendentes</p>
                <p className="text-sm font-medium">{stats.pendentes}</p>
              </div>
              <div className="text-center">
                <div className="w-full h-2 bg-red-500 rounded mb-1" />
                <p className="text-xs text-muted-foreground">Atrasadas</p>
                <p className="text-sm font-medium">{stats.atrasadas}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
