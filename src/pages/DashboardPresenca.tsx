import { useState, useEffect, useMemo, useRef } from "react";
import logger from '@/lib/logger';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Users, MapPin, Filter, FileDown, FileSpreadsheet } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PresenceDashboard } from "@/components/PresenceDashboard";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface OrdemServicoPresenca {
  id: string;
  numero_os: string;
  data_programada: string;
  hora_inicio: string;
  hora_fim: string;
  presence_confirmed_at: string | null;
  presence_confirmed_by: string | null;
  ticket_id: string;
  tecnico_id: string;
  tecnicos: {
    id: string;
    profiles: {
      nome: string;
    };
  } | null;
  tickets: {
    numero_ticket: string;
    titulo: string;
    endereco_servico: string;
    clientes: {
      empresa: string;
    } | null;
  } | null;
}

interface Tecnico {
  id: string;
  profiles: {
    nome: string;
  };
}

export default function DashboardPresenca() {
  const [ordensServico, setOrdensServico] = useState<OrdemServicoPresenca[]>([]);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [filtroTecnico, setFiltroTecnico] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroHorario, setFiltroHorario] = useState<string>("todos");
  const [stats, setStats] = useState({
    total: 0,
    confirmadas: 0,
    pendentes: 0,
  });
  const previousOSRef = useRef<Map<string, boolean>>(new Map());

  // Função para tocar som de notificação
  const playNotificationSound = () => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);

    // Segunda nota
    setTimeout(() => {
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();

      osc2.connect(gain2);
      gain2.connect(audioContext.destination);

      osc2.frequency.value = 1000;
      osc2.type = 'sine';

      gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      osc2.start(audioContext.currentTime);
      osc2.stop(audioContext.currentTime + 0.3);
    }, 150);
  };

  const loadTecnicos = async () => {
    try {
      const { data, error } = await supabase
        .from("tecnicos")
        .select(`
          id,
          profiles (
            nome
          )
        `)
        .order("profiles(nome)", { ascending: true });

      if (error) throw error;
      setTecnicos((data || []) as Tecnico[]);
    } catch (error) {
      logger.error("Erro ao carregar técnicos:", error);
    }
  };

  const loadOrdensServico = async () => {
    try {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const amanha = new Date(hoje);
      amanha.setDate(amanha.getDate() + 1);

      const { data, error } = await supabase
        .from("ordens_servico")
        .select(`
          id,
          numero_os,
          data_programada,
          hora_inicio,
          hora_fim,
          presence_confirmed_at,
          presence_confirmed_by,
          ticket_id,
          tecnico_id,
          tecnicos (
            id,
            profiles (
              nome
            )
          ),
          tickets (
            numero_ticket,
            titulo,
            endereco_servico,
            clientes (
              empresa
            )
          )
        `)
        .gte("data_programada", hoje.toISOString())
        .lt("data_programada", amanha.toISOString())
        .order("hora_inicio", { ascending: true });

      if (error) throw error;

      const ordensServicoData = (data || []) as OrdemServicoPresenca[];
      
      // Detectar novas confirmações
      const currentOSMap = new Map(
        ordensServicoData.map(os => [os.id, !!os.presence_confirmed_at])
      );

      ordensServicoData.forEach(os => {
        const wasConfirmed = previousOSRef.current.get(os.id);
        const isConfirmed = !!os.presence_confirmed_at;

        // Nova confirmação detectada
        if (wasConfirmed === false && isConfirmed) {
          playNotificationSound();
          toast.success(
            `Presença confirmada: ${os.tecnicos?.profiles?.nome || 'Técnico'} - ${os.numero_os}`,
            {
              description: `Confirmado às ${format(new Date(os.presence_confirmed_at!), 'HH:mm', { locale: ptBR })}`
            }
          );
        }
      });

      previousOSRef.current = currentOSMap;
      setOrdensServico(ordensServicoData);
    } catch (error) {
      logger.error("Erro ao carregar ordens de serviço:", error);
      toast.error("Erro ao carregar ordens de serviço");
    } finally {
      setLoading(false);
    }
  };

  // Filtrar ordens de serviço baseado nos filtros
  const ordensServicoFiltradas = useMemo(() => {
    let filtradas = [...ordensServico];

    // Filtro por técnico
    if (filtroTecnico !== "todos") {
      filtradas = filtradas.filter(os => os.tecnico_id === filtroTecnico);
    }

    // Filtro por status
    if (filtroStatus !== "todos") {
      if (filtroStatus === "confirmada") {
        filtradas = filtradas.filter(os => os.presence_confirmed_at !== null);
      } else if (filtroStatus === "pendente") {
        filtradas = filtradas.filter(os => os.presence_confirmed_at === null);
      }
    }

    // Filtro por horário
    if (filtroHorario !== "todos") {
      filtradas = filtradas.filter(os => {
        if (!os.hora_inicio) return false;
        
        const hora = parseInt(os.hora_inicio.split(":")[0]);
        
        if (filtroHorario === "manha") {
          return hora >= 6 && hora < 12;
        } else if (filtroHorario === "tarde") {
          return hora >= 12 && hora < 18;
        } else if (filtroHorario === "noite") {
          return hora >= 18 || hora < 6;
        }
        
        return true;
      });
    }

    return filtradas;
  }, [ordensServico, filtroTecnico, filtroStatus, filtroHorario]);

  // Calcular estatísticas baseadas nas OS filtradas
  const statsFiltradas = useMemo(() => {
    const total = ordensServicoFiltradas.length;
    const confirmadas = ordensServicoFiltradas.filter(os => os.presence_confirmed_at).length;
    const pendentes = total - confirmadas;

    return { total, confirmadas, pendentes };
  }, [ordensServicoFiltradas]);

  useEffect(() => {
    loadTecnicos();
    loadOrdensServico();

    // Realtime subscription
    const channel = supabase
      .channel("presenca-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ordens_servico",
        },
        (payload) => {
          loadOrdensServico();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const limparFiltros = () => {
    setFiltroTecnico("todos");
    setFiltroStatus("todos");
    setFiltroHorario("todos");
  };

  const exportarPDF = () => {
    setExporting(true);
    try {
      const doc = new jsPDF();
      const dataAtual = format(new Date(), "dd/MM/yyyy", { locale: ptBR });
      
      // Cabeçalho
      doc.setFontSize(18);
      doc.text("Relatório de Confirmações de Presença", 14, 20);
      doc.setFontSize(12);
      doc.text(`Data: ${dataAtual}`, 14, 30);
      
      // Estatísticas gerais
      doc.setFontSize(10);
      doc.text(`Total de OS: ${statsFiltradas.total}`, 14, 40);
      doc.text(`Confirmadas: ${statsFiltradas.confirmadas}`, 14, 46);
      doc.text(`Pendentes: ${statsFiltradas.pendentes}`, 14, 52);
      
      // Agrupar por técnico
      const osPorTecnico = ordensServicoFiltradas.reduce((acc, os) => {
        const tecnicoNome = os.tecnicos?.profiles?.nome || "Não atribuído";
        if (!acc[tecnicoNome]) {
          acc[tecnicoNome] = [];
        }
        acc[tecnicoNome].push(os);
        return acc;
      }, {} as Record<string, OrdemServicoPresenca[]>);

      let yPosition = 60;

      Object.entries(osPorTecnico).forEach(([tecnico, osArray]) => {
        // Verificar se precisa de nova página
        if (yPosition > 250) {
          doc.addPage();
          yPosition = 20;
        }

        // Nome do técnico
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(tecnico, 14, yPosition);
        yPosition += 6;

        // Estatísticas do técnico
        const confirmadas = osArray.filter(os => os.presence_confirmed_at).length;
        const pendentes = osArray.length - confirmadas;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`Total: ${osArray.length} | Confirmadas: ${confirmadas} | Pendentes: ${pendentes}`, 14, yPosition);
        yPosition += 8;

        // Tabela de OS do técnico
        const tableData = osArray.map(os => [
          os.numero_os,
          os.hora_inicio ? `${os.hora_inicio.slice(0, 5)} - ${os.hora_fim?.slice(0, 5) || ''}` : '-',
          os.tickets?.titulo || '-',
          os.presence_confirmed_at 
            ? `✓ ${format(new Date(os.presence_confirmed_at), 'HH:mm', { locale: ptBR })}`
            : 'Pendente'
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [['OS', 'Horário', 'Descrição', 'Confirmação']],
          body: tableData,
          theme: 'striped',
          headStyles: { fillColor: [66, 66, 66], fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          columnStyles: {
            0: { cellWidth: 25 },
            1: { cellWidth: 35 },
            2: { cellWidth: 80 },
            3: { cellWidth: 40 }
          },
          margin: { left: 14 },
        });

        yPosition = (doc as any).lastAutoTable.finalY + 10;
      });

      // Rodapé com data/hora de geração
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(
          `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} - Página ${i} de ${totalPages}`,
          14,
          doc.internal.pageSize.height - 10
        );
      }

      doc.save(`confirmacoes_presenca_${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast.success("PDF exportado com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      toast.error("Erro ao exportar PDF");
    } finally {
      setExporting(false);
    }
  };

  const exportarExcel = () => {
    setExporting(true);
    try {
      // Agrupar por técnico
      const osPorTecnico = ordensServicoFiltradas.reduce((acc, os) => {
        const tecnicoNome = os.tecnicos?.profiles?.nome || "Não atribuído";
        if (!acc[tecnicoNome]) {
          acc[tecnicoNome] = [];
        }
        acc[tecnicoNome].push(os);
        return acc;
      }, {} as Record<string, OrdemServicoPresenca[]>);

      const workbook = XLSX.utils.book_new();

      // Planilha de resumo
      const resumoData = [
        ["RELATÓRIO DE CONFIRMAÇÕES DE PRESENÇA"],
        [`Data: ${format(new Date(), "dd/MM/yyyy", { locale: ptBR })}`],
        [],
        ["ESTATÍSTICAS GERAIS"],
        ["Total de OS", statsFiltradas.total],
        ["Confirmadas", statsFiltradas.confirmadas],
        ["Pendentes", statsFiltradas.pendentes],
        [`Percentual de Confirmação`, `${statsFiltradas.total > 0 ? Math.round((statsFiltradas.confirmadas / statsFiltradas.total) * 100) : 0}%`],
        [],
        ["RESUMO POR TÉCNICO"],
        ["Técnico", "Total OS", "Confirmadas", "Pendentes", "% Confirmação"]
      ];

      Object.entries(osPorTecnico).forEach(([tecnico, osArray]) => {
        const confirmadas = osArray.filter(os => os.presence_confirmed_at).length;
        const pendentes = osArray.length - confirmadas;
        const percentual = Math.round((confirmadas / osArray.length) * 100);
        resumoData.push([tecnico, osArray.length, confirmadas, pendentes, `${percentual}%`]);
      });

      const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
      XLSX.utils.book_append_sheet(workbook, wsResumo, "Resumo");

      // Planilha detalhada
      const detalhesData = [
        ["Técnico", "OS", "Horário", "Cliente", "Descrição", "Endereço", "Status", "Hora Confirmação"]
      ];

      Object.entries(osPorTecnico).forEach(([tecnico, osArray]) => {
        osArray.forEach(os => {
          detalhesData.push([
            tecnico,
            os.numero_os,
            os.hora_inicio ? `${os.hora_inicio.slice(0, 5)} - ${os.hora_fim?.slice(0, 5) || ''}` : '-',
            os.tickets?.clientes?.empresa || '-',
            os.tickets?.titulo || '-',
            os.tickets?.endereco_servico || '-',
            os.presence_confirmed_at ? 'Confirmada' : 'Pendente',
            os.presence_confirmed_at 
              ? format(new Date(os.presence_confirmed_at), 'HH:mm', { locale: ptBR })
              : '-'
          ]);
        });
      });

      const wsDetalhes = XLSX.utils.aoa_to_sheet(detalhesData);
      XLSX.utils.book_append_sheet(workbook, wsDetalhes, "Detalhes");

      XLSX.writeFile(workbook, `confirmacoes_presenca_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
      toast.success("Excel exportado com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar Excel:", error);
      toast.error("Erro ao exportar Excel");
    } finally {
      setExporting(false);
    }
  };


  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  const temFiltrosAtivos = filtroTecnico !== "todos" || filtroStatus !== "todos" || filtroHorario !== "todos";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard de Confirmações</h1>
          <p className="text-muted-foreground">
            Acompanhamento em tempo real das confirmações de presença do dia
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={exportarPDF}
            disabled={exporting || ordensServicoFiltradas.length === 0}
            variant="outline"
          >
            <FileDown className="h-4 w-4 mr-2" />
            Exportar PDF
          </Button>
          <Button
            onClick={exportarExcel}
            disabled={exporting || ordensServicoFiltradas.length === 0}
            variant="outline"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
        </div>
      </div>

      {/* Dashboard de Estatísticas */}
      <PresenceDashboard />

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Técnico</label>
              <Select value={filtroTecnico} onValueChange={setFiltroTecnico}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o técnico" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os técnicos</SelectItem>
                  {tecnicos.map((tecnico) => (
                    <SelectItem key={tecnico.id} value={tecnico.id}>
                      {tecnico.profiles?.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="confirmada">Confirmada</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Horário</label>
              <Select value={filtroHorario} onValueChange={setFiltroHorario}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o horário" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os horários</SelectItem>
                  <SelectItem value="manha">Manhã (6h - 12h)</SelectItem>
                  <SelectItem value="tarde">Tarde (12h - 18h)</SelectItem>
                  <SelectItem value="noite">Noite (18h - 6h)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={limparFiltros}
                disabled={!temFiltrosAtivos}
                className="w-full"
              >
                Limpar Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de OS</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsFiltradas.total}</div>
            <p className="text-xs text-muted-foreground">Agendadas para hoje</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Confirmadas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{statsFiltradas.confirmadas}</div>
            <p className="text-xs text-muted-foreground">
              {statsFiltradas.total > 0 ? Math.round((statsFiltradas.confirmadas / statsFiltradas.total) * 100) : 0}% do total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{statsFiltradas.pendentes}</div>
            <p className="text-xs text-muted-foreground">
              Aguardando confirmação
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Ordens de Serviço */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Ordens de Serviço - {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
            {temFiltrosAtivos && (
              <Badge variant="secondary">
                {ordensServicoFiltradas.length} de {ordensServico.length} resultados
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ordensServicoFiltradas.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{temFiltrosAtivos ? "Nenhuma ordem de serviço encontrada com os filtros aplicados" : "Nenhuma ordem de serviço agendada para hoje"}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {ordensServicoFiltradas.map((os) => (
                <div
                  key={os.id}
                  className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{os.numero_os}</h3>
                          {os.presence_confirmed_at ? (
                            <Badge variant="default" className="bg-green-600">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Confirmada
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <Clock className="h-3 w-3 mr-1" />
                              Pendente
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {os.tickets?.titulo}
                        </p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {os.hora_inicio && os.hora_fim
                              ? `${os.hora_inicio.slice(0, 5)} - ${os.hora_fim.slice(0, 5)}`
                              : "Horário não definido"}
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {os.tickets?.endereco_servico}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 md:mt-0 md:ml-4 flex flex-col items-start md:items-end gap-1">
                    <div className="text-sm font-medium">
                      {os.tecnicos?.profiles?.nome || "Técnico não atribuído"}
                    </div>
                    {os.tickets?.clientes?.empresa && (
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        {os.tickets.clientes.empresa}
                        <span className="text-blue-600">(P{(os.tickets.clientes as any)?.prioridade ?? 5})</span>
                      </div>
                    )}
                    {os.presence_confirmed_at && (
                      <div className="text-xs text-muted-foreground">
                        Confirmada em{" "}
                        {format(new Date(os.presence_confirmed_at), "HH:mm", { locale: ptBR })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
