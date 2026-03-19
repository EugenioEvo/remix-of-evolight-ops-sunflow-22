import React, { useState, useEffect } from 'react';
import logger from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { exportToExcel, exportToCSV, exportToPDF } from '@/utils/exportHelpers';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { 
  Download, 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Users,
  Calendar,
  TrendingUp
} from 'lucide-react';

const Relatorios = () => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [rmes, setRmes] = useState<any[]>([]);
  const [ordensServico, setOrdensServico] = useState<any[]>([]);
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const { user, profile } = useAuth();
  const { toast } = useToast();

  const loadData = async () => {
    try {
      setLoading(true);

      // Carregar tickets
      const { data: ticketsData } = await supabase
        .from('tickets')
        .select(`
          *,
          clientes!inner(
            empresa,
            profiles!inner(nome)
          ),
          tecnicos(
            profiles!inner(nome)
          )
        `)
        .gte('created_at', `${dateRange.start}T00:00:00`)
        .lte('created_at', `${dateRange.end}T23:59:59`)
        .order('created_at', { ascending: false });

      setTickets(ticketsData || []);

      // Carregar RMEs
      const { data: rmeData } = await supabase
        .from('rme_relatorios')
        .select(`
          *,
          status_aprovacao,
          data_aprovacao,
          tickets!inner(titulo, numero_ticket),
          tecnicos!inner(profiles!inner(nome))
        `)
        .gte('created_at', `${dateRange.start}T00:00:00`)
        .lte('created_at', `${dateRange.end}T23:59:59`)
        .order('created_at', { ascending: false });

      setRmes(rmeData || []);

      // Carregar ordens de serviço
      const { data: osData } = await supabase
        .from('ordens_servico')
        .select(`
          *,
          tickets!inner(titulo),
          tecnicos!inner(profiles!inner(nome))
        `)
        .gte('created_at', `${dateRange.start}T00:00:00`)
        .lte('created_at', `${dateRange.end}T23:59:59`)
        .order('created_at', { ascending: false });

      setOrdensServico(osData || []);

      // Carregar técnicos
      const { data: tecnicosData } = await supabase
        .from('tecnicos')
        .select(`
          *,
          profiles!inner(nome, email)
        `);

      setTecnicos(tecnicosData || []);

      // Carregar clientes
      const { data: clientesData } = await supabase
        .from('clientes')
        .select(`
          *,
          profiles!inner(nome, email)
        `);

      setClientes(clientesData || []);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar dados dos relatórios',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [dateRange]);

  const getTicketsByStatus = () => {
    const statusCounts = tickets.reduce((acc, ticket) => {
      acc[ticket.status] = (acc[ticket.status] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(statusCounts).map(([status, count]) => ({
      status: status.replace('_', ' ').toUpperCase(),
      count: count as number,
    }));
  };

  const getTicketsByPriority = () => {
    const priorityCounts = tickets.reduce((acc, ticket) => {
      acc[ticket.prioridade] = (acc[ticket.prioridade] || 0) + 1;
      return acc;
    }, {});

    const colors = {
      'baixa': '#10B981',
      'media': '#F59E0B', 
      'alta': '#F97316',
      'critica': '#EF4444'
    };

    return Object.entries(priorityCounts).map(([priority, count]) => ({
      name: priority.toUpperCase(),
      value: count as number,
      color: colors[priority as keyof typeof colors] || '#6B7280'
    }));
  };

  const getTicketsByMonth = () => {
    const monthCounts = tickets.reduce((acc, ticket) => {
      const month = new Date(ticket.created_at).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(monthCounts).map(([month, count]) => ({
      month,
      tickets: count as number,
    }));
  };

  const getTechnicianPerformance = () => {
    const technicianStats = tecnicos.map(tecnico => {
      const technicianRMEs = rmes.filter(rme => rme.tecnico_id === tecnico.id);
      const technicianTickets = tickets.filter(ticket => ticket.tecnico_responsavel_id === tecnico.id);
      
      return {
        nome: tecnico.profiles.nome,
        tickets_atribuidos: technicianTickets.length,
        rmes_completados: technicianRMEs.length,
        taxa_conclusao: technicianTickets.length > 0 
          ? Math.round((technicianRMEs.length / technicianTickets.length) * 100) 
          : 0
      };
    });

    return technicianStats.filter(stat => stat.tickets_atribuidos > 0 || stat.rmes_completados > 0);
  };

  const handleExport = (format: 'excel' | 'csv' | 'pdf') => {
    const ticketsData = tickets.map(t => ({
      'Número': t.numero_ticket,
      'Título': t.titulo,
      'Status': t.status,
      'Prioridade': t.prioridade,
      'Cliente': t.clientes?.empresa || t.clientes?.profiles?.nome,
      'Criado em': new Date(t.created_at).toLocaleDateString('pt-BR')
    }));

    const filename = `relatorio_tickets_${dateRange.start}_${dateRange.end}`;

    if (format === 'excel') {
      exportToExcel(ticketsData, filename);
      toast({ title: 'Exportado com sucesso!', description: 'Relatório exportado para Excel.' });
    } else if (format === 'csv') {
      exportToCSV(ticketsData, filename);
      toast({ title: 'Exportado com sucesso!', description: 'Relatório exportado para CSV.' });
    } else if (format === 'pdf') {
      const columns = [
        { header: 'Número', dataKey: 'Número' },
        { header: 'Título', dataKey: 'Título' },
        { header: 'Status', dataKey: 'Status' },
        { header: 'Prioridade', dataKey: 'Prioridade' },
        { header: 'Cliente', dataKey: 'Cliente' },
        { header: 'Criado em', dataKey: 'Criado em' }
      ];
      exportToPDF(ticketsData, filename, 'Relatório de Tickets', columns);
      toast({ title: 'Exportado com sucesso!', description: 'Relatório exportado para PDF.' });
    }
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground">Dashboard de métricas e análises</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="w-40"
            />
            <span>até</span>
            <Input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="w-40"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExport('excel')}>
                Exportar Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('csv')}>
                Exportar CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pdf')}>
                Exportar PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Tickets</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tickets.length}</div>
            <p className="text-xs text-muted-foreground">
              no período selecionado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">RMEs Concluídos</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rmes.length}</div>
            <p className="text-xs text-muted-foreground">
              relatórios finalizados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ordens de Serviço</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ordensServico.length}</div>
            <p className="text-xs text-muted-foreground">
              geradas no período
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conclusão</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tickets.length > 0 ? Math.round((rmes.length / tickets.length) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              tickets concluídos
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="tecnicos">Produtividade</TabsTrigger>
          <TabsTrigger value="rmes">RMEs e Aprovações</TabsTrigger>
          <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico de Status */}
            <Card>
              <CardHeader>
                <CardTitle>Tickets por Status</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={getTicketsByStatus()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="status" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Gráfico de Prioridade */}
            <Card>
              <CardHeader>
                <CardTitle>Tickets por Prioridade</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={getTicketsByPriority()}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {getTicketsByPriority().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico Temporal */}
          <Card>
            <CardHeader>
              <CardTitle>Evolução de Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={getTicketsByMonth()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="tickets" stroke="#8884d8" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tecnicos" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance dos Técnicos</CardTitle>
              <CardDescription>Produtividade e taxa de conclusão por técnico</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={getTechnicianPerformance()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nome" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="tickets_atribuidos" fill="#8884d8" name="Tickets Atribuídos" />
                  <Bar dataKey="rmes_completados" fill="#82ca9d" name="RMEs Completados" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {getTechnicianPerformance().map((tecnico, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="text-lg">{tecnico.nome}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-blue-600">{tecnico.tickets_atribuidos}</div>
                      <p className="text-sm text-muted-foreground">Tickets Atribuídos</p>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600">{tecnico.rmes_completados}</div>
                      <p className="text-sm text-muted-foreground">RMEs Completados</p>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-purple-600">{tecnico.taxa_conclusao}%</div>
                      <p className="text-sm text-muted-foreground">Taxa de Conclusão</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="rmes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status de Aprovação dos RMEs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-yellow-600">
                    {rmes.filter(r => r.status_aprovacao === 'pendente').length}
                  </div>
                  <p className="text-sm text-muted-foreground">Pendentes</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {rmes.filter(r => r.status_aprovacao === 'aprovado').length}
                  </div>
                  <p className="text-sm text-muted-foreground">Aprovados</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">
                    {rmes.filter(r => r.status_aprovacao === 'rejeitado').length}
                  </div>
                  <p className="text-sm text-muted-foreground">Rejeitados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="detalhes" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Lista de Tickets Recentes */}
            <Card>
              <CardHeader>
                <CardTitle>Tickets Recentes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {tickets.slice(0, 10).map((ticket) => (
                    <div key={ticket.id} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <p className="font-medium">{ticket.titulo}</p>
                        <p className="text-sm text-muted-foreground">
                          {ticket.clientes?.empresa || ticket.clientes?.profiles?.nome}
                        </p>
                      </div>
                      <Badge variant="outline">{ticket.status.replace('_', ' ')}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Lista de RMEs Recentes */}
            <Card>
              <CardHeader>
                <CardTitle>RMEs Recentes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {rmes.slice(0, 10).map((rme) => (
                    <div key={rme.id} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <p className="font-medium">{rme.tickets?.titulo}</p>
                        <p className="text-sm text-muted-foreground">
                          Técnico: {rme.tecnicos?.profiles?.nome}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {new Date(rme.data_execucao).toLocaleDateString('pt-BR')}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Relatorios;