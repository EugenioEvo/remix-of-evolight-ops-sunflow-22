import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/services/api';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, CheckCircle, AlertCircle, User, Download } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface Tecnico {
  id: string;
  nome: string;
}

interface WorkloadData {
  data: string;
  total_os: number;
  total_minutos: number;
  os_pendentes: number;
  os_concluidas: number;
}

interface TecnicoStats {
  totalOS: number;
  totalHoras: number;
  osPendentes: number;
  osConcluidas: number;
  disponibilidade: number;
  workloadByDay: WorkloadData[];
}

const CargaTrabalho = () => {
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [selectedTecnico, setSelectedTecnico] = useState<string>('');
  const [stats, setStats] = useState<TecnicoStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadTecnicos();
  }, []);

  useEffect(() => {
    if (selectedTecnico) {
      loadWorkloadData();
    }
  }, [selectedTecnico, selectedMonth]);

  const loadTecnicos = async () => {
    const { data } = await supabase
      .from('tecnicos')
      .select('id, profiles!inner(nome)')
      .order('profiles(nome)');
    
    if (data) {
      const tecnicosFormatted = data.map(t => ({
        id: t.id,
        nome: (t.profiles as any).nome
      }));
      setTecnicos(tecnicosFormatted);
      if (tecnicosFormatted.length > 0) {
        setSelectedTecnico(tecnicosFormatted[0].id);
      }
    }
  };

  const loadWorkloadData = async () => {
    setLoading(true);
    try {
      const start = startOfMonth(selectedMonth);
      const end = endOfMonth(selectedMonth);

      // Buscar dados usando a função do banco
      const { data: workloadData, error } = await supabase
        .rpc('get_technician_workload', {
          p_tecnico_id: selectedTecnico,
          p_start_date: format(start, 'yyyy-MM-dd'),
          p_end_date: format(end, 'yyyy-MM-dd')
        });

      if (error) throw error;

      if (workloadData && workloadData.length > 0) {
        const totalOS = workloadData.reduce((sum: number, day: WorkloadData) => sum + day.total_os, 0);
        const totalMinutos = workloadData.reduce((sum: number, day: WorkloadData) => sum + day.total_minutos, 0);
        const osPendentes = workloadData.reduce((sum: number, day: WorkloadData) => sum + day.os_pendentes, 0);
        const osConcluidas = workloadData.reduce((sum: number, day: WorkloadData) => sum + day.os_concluidas, 0);
        
        // Calcular disponibilidade (assumindo 8h/dia útil, 22 dias úteis/mês)
        const horasDisponiveis = 22 * 8 * 60; // em minutos
        const disponibilidade = Math.max(0, Math.min(100, (totalMinutos / horasDisponiveis) * 100));

        setStats({
          totalOS,
          totalHoras: Math.round(totalMinutos / 60 * 10) / 10,
          osPendentes,
          osConcluidas,
          disponibilidade: Math.round(disponibilidade),
          workloadByDay: workloadData
        });
      } else {
        setStats({
          totalOS: 0,
          totalHoras: 0,
          osPendentes: 0,
          osConcluidas: 0,
          disponibilidade: 0,
          workloadByDay: []
        });
      }
    } catch (error) {
      logger.error('Erro ao carregar carga de trabalho:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDisponibilidadeColor = (disponibilidade: number) => {
    if (disponibilidade < 50) return 'text-green-600';
    if (disponibilidade < 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getDisponibilidadeStatus = (disponibilidade: number) => {
    if (disponibilidade < 50) return 'Disponível';
    if (disponibilidade < 80) return 'Moderado';
    return 'Sobrecarregado';
  };

  const exportToPDF = async () => {
    if (!stats || !selectedTecnico) return;

    setExporting(true);
    try {
      const tecnico = tecnicos.find(t => t.id === selectedTecnico);
      const mesNome = format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR });

      const doc = new jsPDF();
      
      // Header
      doc.setFillColor(245, 158, 11); // amber-500
      doc.rect(0, 0, 210, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.text('SunFlow', 15, 20);
      doc.setFontSize(12);
      doc.text('Relatório de Carga de Trabalho', 15, 30);
      
      // Informações do relatório
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(16);
      doc.text(`Técnico: ${tecnico?.nome || 'N/A'}`, 15, 55);
      doc.setFontSize(12);
      doc.text(`Período: ${mesNome}`, 15, 63);
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 15, 70);

      // Métricas principais
      let yPos = 85;
      
      doc.setFillColor(249, 250, 251);
      doc.rect(15, yPos, 180, 50, 'F');
      
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Resumo do Mês', 20, yPos + 10);
      
      doc.setFont(undefined, 'normal');
      doc.setFontSize(11);
      
      const metricas = [
        `Total de OS: ${stats.totalOS}`,
        `Total de Horas: ${stats.totalHoras}h`,
        `OS Pendentes: ${stats.osPendentes}`,
        `OS Concluídas: ${stats.osConcluidas}`,
      ];
      
      metricas.forEach((metrica, idx) => {
        doc.text(metrica, 25, yPos + 22 + (idx * 7));
      });

      yPos += 55;

      // Disponibilidade
      doc.setFillColor(239, 246, 255);
      doc.rect(15, yPos, 180, 30, 'F');
      
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Disponibilidade', 20, yPos + 10);
      
      doc.setFont(undefined, 'normal');
      doc.setFontSize(11);
      
      const statusCor = stats.disponibilidade < 50 ? [34, 197, 94] : 
                        stats.disponibilidade < 80 ? [234, 179, 8] : [239, 68, 68];
      
      doc.setTextColor(statusCor[0], statusCor[1], statusCor[2]);
      doc.text(`${stats.disponibilidade}% - ${getDisponibilidadeStatus(stats.disponibilidade)}`, 25, yPos + 20);
      doc.setTextColor(0, 0, 0);
      doc.text(`Ocupado: ${stats.totalHoras}h | Disponível: ${Math.max(0, 176 - stats.totalHoras)}h`, 25, yPos + 27);

      yPos += 40;

      // Gráfico de barra simplificado (distribuição diária)
      if (stats.workloadByDay.length > 0) {
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Distribuição Diária', 15, yPos);
        
        yPos += 10;

        // Tabela de distribuição
        const tableData = stats.workloadByDay.map(day => {
          const horas = Math.round(day.total_minutos / 60 * 10) / 10;
          return [
            format(new Date(day.data), "dd/MM (EEE)", { locale: ptBR }),
            day.total_os.toString(),
            `${horas}h`,
            day.os_pendentes.toString(),
            day.os_concluidas.toString()
          ];
        });

        (doc as any).autoTable({
          startY: yPos,
          head: [['Data', 'OS', 'Horas', 'Pendentes', 'Concluídas']],
          body: tableData,
          theme: 'grid',
          headStyles: { fillColor: [245, 158, 11], textColor: 255 },
          styles: { fontSize: 9, cellPadding: 3 },
          columnStyles: {
            0: { cellWidth: 40 },
            1: { cellWidth: 20, halign: 'center' },
            2: { cellWidth: 30, halign: 'center' },
            3: { cellWidth: 30, halign: 'center' },
            4: { cellWidth: 30, halign: 'center' },
          }
        });
      }

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(128, 128, 128);
        doc.text(
          `Página ${i} de ${pageCount}`,
          doc.internal.pageSize.width / 2,
          doc.internal.pageSize.height - 10,
          { align: 'center' }
        );
      }

      // Salvar PDF
      const fileName = `carga_trabalho_${tecnico?.nome.replace(/\s+/g, '_')}_${format(selectedMonth, 'yyyy_MM')}.pdf`;
      doc.save(fileName);

      toast({
        title: 'PDF exportado',
        description: `Relatório salvo como ${fileName}`
      });
    } catch (error: any) {
      console.error('Erro ao exportar PDF:', error);
      toast({
        title: 'Erro ao exportar',
        description: 'Não foi possível gerar o PDF',
        variant: 'destructive'
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Carga de Trabalho</h1>
          <p className="text-muted-foreground">Visualize a distribuição de trabalho dos técnicos</p>
        </div>
        {stats && (
          <Button 
            onClick={exportToPDF} 
            disabled={exporting}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            {exporting ? 'Gerando PDF...' : 'Exportar PDF'}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Técnico</label>
          <Select value={selectedTecnico} onValueChange={setSelectedTecnico}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tecnicos.map(tec => (
                <SelectItem key={tec.id} value={tec.id}>
                  {tec.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Mês</label>
          <Select 
            value={format(selectedMonth, 'yyyy-MM')} 
            onValueChange={(value) => {
              const [year, month] = value.split('-').map(Number);
              setSelectedMonth(new Date(year, month - 1, 1));
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => {
                const date = new Date();
                date.setMonth(date.getMonth() - 6 + i);
                return (
                  <SelectItem key={i} value={format(date, 'yyyy-MM')}>
                    {format(date, "MMMM 'de' yyyy", { locale: ptBR })}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          Carregando dados...
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de OS</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalOS}</div>
                <p className="text-xs text-muted-foreground">
                  Agendadas este mês
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Horas</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalHoras}h</div>
                <p className="text-xs text-muted-foreground">
                  Tempo estimado
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">OS Pendentes</CardTitle>
                <AlertCircle className="h-4 w-4 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{stats.osPendentes}</div>
                <p className="text-xs text-muted-foreground">
                  Aguardando execução
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">OS Concluídas</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.osConcluidas}</div>
                <p className="text-xs text-muted-foreground">
                  Finalizadas
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Disponibilidade
              </CardTitle>
              <CardDescription>
                Percentual de ocupação do técnico no mês (baseado em 176h mensais)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`text-4xl font-bold ${getDisponibilidadeColor(stats.disponibilidade)}`}>
                    {stats.disponibilidade}%
                  </div>
                  <Badge 
                    variant={stats.disponibilidade < 50 ? 'default' : stats.disponibilidade < 80 ? 'secondary' : 'destructive'}
                  >
                    {getDisponibilidadeStatus(stats.disponibilidade)}
                  </Badge>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <p>Ocupado: {stats.totalHoras}h</p>
                  <p>Disponível: {Math.max(0, 176 - stats.totalHoras)}h</p>
                </div>
              </div>
              <Progress value={stats.disponibilidade} className="h-3" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Distribuição Diária</CardTitle>
              <CardDescription>
                Carga de trabalho por dia do mês
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats.workloadByDay.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma OS agendada neste mês
                </div>
              ) : (
                <div className="space-y-2">
                  {stats.workloadByDay.map((day) => {
                    const horas = Math.round(day.total_minutos / 60 * 10) / 10;
                    const percentual = Math.min(100, (day.total_minutos / (8 * 60)) * 100);
                    
                    return (
                      <div key={day.data} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">
                            {format(new Date(day.data), "dd/MM/yyyy (EEEE)", { locale: ptBR })}
                          </span>
                          <div className="flex gap-4 text-muted-foreground">
                            <span>{day.total_os} OS</span>
                            <span>{horas}h</span>
                            <span className="text-yellow-600">{day.os_pendentes} pendentes</span>
                            <span className="text-green-600">{day.os_concluidas} concluídas</span>
                          </div>
                        </div>
                        <Progress value={percentual} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
};

export default CargaTrabalho;
