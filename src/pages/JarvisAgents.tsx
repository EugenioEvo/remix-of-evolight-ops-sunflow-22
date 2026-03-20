import { useState, useMemo } from "react";
import { 
  Eye, Heart, Brain, Send, BarChart, FileText, 
  Clock, Zap, Timer, Activity
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useSolarAgentLogs } from "@/hooks/queries/useSolar";

const AGENTS = [
  {
    key: "monitor_claude",
    name: "Monitor",
    description: "Sincroniza plantas e detecta alertas via SolarZ",
    icon: Eye,
    info: "Cron ativo: a cada 5 minutos",
    hasAction: false,
  },
  {
    key: "encantador",
    name: "Encantador",
    description: "Cadastro inteligente de clientes e prontuários",
    icon: Heart,
    hasAction: false,
  },
  {
    key: "jarvis_claude",
    name: "JARVIS Orchestrator",
    description: "Decisões com IA para alertas não-críticos",
    icon: Brain,
    info: "Claude API + fallback por regras",
    hasAction: false,
  },
  {
    key: "dispatcher",
    name: "Dispatcher",
    description: "Cria tickets e OS automaticamente",
    icon: Send,
    hasAction: false,
  },
  {
    key: "analista_claude",
    name: "Analista",
    description: "KPIs e métricas consolidadas",
    icon: BarChart,
    hasAction: true,
    actionLabel: "Gerar KPIs",
  },
  {
    key: "relator",
    name: "Relator",
    description: "Relatório mensal por cliente",
    icon: FileText,
    info: "Cron mensal: dia 1 às 6h",
    hasAction: false,
  },
];

const AUTOMATIONS = [
  { title: "Monitor (pg_cron)", status: "Ativo", detail: "A cada 5 minutos", icon: Timer },
  { title: "Trigger pós-RME", status: "Ativo", detail: "Chama Verificador quando RME é aprovado", icon: Zap },
  { title: "Relatório mensal", status: "Ativo", detail: "Dia 1 de cada mês às 6:00", icon: Clock },
];

function statusBadge(status: string | null) {
  const s = (status || "").toLowerCase();
  if (s === "success") return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100">success</Badge>;
  if (s === "error") return <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100">error</Badge>;
  if (s === "partial") return <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">partial</Badge>;
  return <Badge variant="outline">{status || "—"}</Badge>;
}

function timeAgo(date: string | null) {
  if (!date) return "—";
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
  } catch { return "—"; }
}

export default function JarvisAgents() {
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const { data: allLogs, isLoading } = useSolarAgentLogs({ limit: 100 });
  const { data: filteredLogs, isLoading: isFilteredLoading } = useSolarAgentLogs(
    agentFilter !== "all" ? { agentName: agentFilter, limit: 20 } : { limit: 20 }
  );

  const lastByAgent = useMemo(() => {
    const map: Record<string, any> = {};
    if (!allLogs) return map;
    for (const log of allLogs) {
      if (!map[log.agent_name]) map[log.agent_name] = log;
    }
    return map;
  }, [allLogs]);

  return (
    <div className="p-4 md:p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          JARVIS — Centro de Operações
        </h1>
        <p className="text-muted-foreground mt-1">
          Monitoramento e controle dos agentes de IA
        </p>
      </div>

      {/* Agent Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {AGENTS.map((agent) => {
          const Icon = agent.icon;
          const last = lastByAgent[agent.key];
          return (
            <Card key={agent.key} className="relative overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base">{agent.name}</CardTitle>
                    <CardDescription className="text-xs mt-0.5 line-clamp-1">
                      {agent.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-2.5">
                {isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ) : last ? (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Status</span>
                      {statusBadge(last.status)}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Última execução</span>
                      <span className="text-xs tabular-nums">{timeAgo(last.created_at)}</span>
                    </div>
                    {last.duration_ms != null && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Duração</span>
                        <span className="text-xs tabular-nums">{(last.duration_ms / 1000).toFixed(1)}s</span>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Sem execuções registradas</p>
                )}
                {agent.info && (
                  <p className="text-xs text-muted-foreground border-t pt-2 mt-2">{agent.info}</p>
                )}
                {agent.hasAction && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-1"
                    onClick={() => toast.info("Funcionalidade em breve")}
                  >
                    {agent.actionLabel}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Logs Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-semibold text-foreground">Últimas execuções</h2>
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrar agente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os agentes</SelectItem>
              {AGENTS.map((a) => (
                <SelectItem key={a.key} value={a.key}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agente</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Duração</TableHead>
                <TableHead className="text-right">Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isFilteredLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filteredLogs && filteredLogs.length > 0 ? (
                filteredLogs.map((log: any) => {
                  const agent = AGENTS.find((a) => a.key === log.agent_name);
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium text-sm">
                        {agent?.name || log.agent_name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {log.action}
                      </TableCell>
                      <TableCell>{statusBadge(log.status)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {log.duration_ms != null ? `${(log.duration_ms / 1000).toFixed(1)}s` : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                        {format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhum log encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Automation Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Automação</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {AUTOMATIONS.map((auto) => {
            const Icon = auto.icon;
            return (
              <Card key={auto.title}>
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="rounded-lg bg-emerald-50 p-2 shrink-0">
                    <Icon className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{auto.title}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Activity className="h-3 w-3 text-emerald-500" />
                      <span className="text-xs text-emerald-600 font-medium">{auto.status}</span>
                      <span className="text-xs text-muted-foreground">— {auto.detail}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
