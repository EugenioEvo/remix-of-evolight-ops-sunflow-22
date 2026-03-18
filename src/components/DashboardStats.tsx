import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, CheckCircle, Clock, FileText, Wrench, ClipboardCheck } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';

const DashboardStats = () => {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    ticketsAbertos: 0,
    ticketsCriticos: 0,
    ticketsHoje: 0,
    osGeradas: 0,
    emExecucao: 0,
    concluidos: 0,
  });
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    try {
      setLoading(true);
      
      // Chamar RPC que retorna todas as estatísticas de uma vez
      const { data, error } = await supabase.rpc('get_dashboard_stats');

      if (error) {
        logger.error('Erro ao carregar estatísticas:', error);
        return;
      }

      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const statsData = data as {
          tickets_abertos: number;
          tickets_criticos: number;
          tickets_hoje: number;
          os_geradas: number;
          em_execucao: number;
          concluidos: number;
        };

        setStats({
          ticketsAbertos: statsData.tickets_abertos || 0,
          ticketsCriticos: statsData.tickets_criticos || 0,
          ticketsHoje: statsData.tickets_hoje || 0,
          osGeradas: statsData.os_geradas || 0,
          emExecucao: statsData.em_execucao || 0,
          concluidos: statsData.concluidos || 0,
        });
      }
    } catch (error) {
      logger.error('Erro ao carregar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    
    // Atualizar stats a cada 30 segundos
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const statsConfig = [
    {
      title: "Tickets Abertos",
      value: stats.ticketsAbertos,
      icon: Clock,
      className: "bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200",
      iconColor: "text-primary"
    },
    {
      title: "Críticos/Urgentes", 
      value: stats.ticketsCriticos,
      icon: AlertTriangle,
      className: "bg-gradient-to-br from-red-50 to-red-100 border-red-200",
      iconColor: "text-destructive"
    },
    {
      title: "Finalizados Hoje",
      value: stats.ticketsHoje,
      icon: CheckCircle,
      className: "bg-gradient-to-br from-green-50 to-green-100 border-green-200", 
      iconColor: "text-success"
    },
    {
      title: "OS Geradas Hoje",
      value: stats.osGeradas,
      icon: FileText,
      className: "bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200",
      iconColor: "text-purple-600"
    },
    {
      title: "Em Execução",
      value: stats.emExecucao,
      icon: Wrench,
      className: "bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200",
      iconColor: "text-secondary"
    },
    {
      title: "Total Concluídos",
      value: stats.concluidos,
      icon: ClipboardCheck,
      className: "bg-gradient-to-br from-teal-50 to-teal-100 border-teal-200",
      iconColor: "text-teal-600"
    }
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-20 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
      {statsConfig.map((stat) => (
        <Card key={stat.title} className={`${stat.className} shadow-sm hover:shadow-md transition-all duration-300`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  {stat.title}
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {stat.value}
                </p>
              </div>
              <div className={`p-3 rounded-full bg-white/80 ${stat.iconColor}`}>
                <stat.icon className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default React.memo(DashboardStats);
