import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, CheckCircle, Clock, FileText, Wrench, ClipboardCheck } from "lucide-react";
import { useDashboardStats } from '@/hooks/queries/useDashboard';

const DashboardStats = () => {
  const { data: stats, isLoading } = useDashboardStats();

  const statsConfig = [
    {
      title: "Tickets Abertos",
      value: stats?.ticketsAbertos ?? 0,
      icon: Clock,
      className: "bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200",
      iconColor: "text-primary"
    },
    {
      title: "Críticos/Urgentes", 
      value: stats?.ticketsCriticos ?? 0,
      icon: AlertTriangle,
      className: "bg-gradient-to-br from-red-50 to-red-100 border-red-200",
      iconColor: "text-destructive"
    },
    {
      title: "Finalizados Hoje",
      value: stats?.ticketsHoje ?? 0,
      icon: CheckCircle,
      className: "bg-gradient-to-br from-green-50 to-green-100 border-green-200", 
      iconColor: "text-success"
    },
    {
      title: "OS Geradas Hoje",
      value: stats?.osGeradas ?? 0,
      icon: FileText,
      className: "bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200",
      iconColor: "text-purple-600"
    },
    {
      title: "Em Execução",
      value: stats?.emExecucao ?? 0,
      icon: Wrench,
      className: "bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200",
      iconColor: "text-secondary"
    },
    {
      title: "Total Concluídos",
      value: stats?.concluidos ?? 0,
      icon: ClipboardCheck,
      className: "bg-gradient-to-br from-teal-50 to-teal-100 border-teal-200",
      iconColor: "text-teal-600"
    }
  ];

  if (isLoading) {
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
