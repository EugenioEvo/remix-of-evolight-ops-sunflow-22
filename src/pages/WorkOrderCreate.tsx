import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logger } from '@/services/api';
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Save, Loader2, Plus, X, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const workOrderSchema = z.object({
  data_programada: z.date({ required_error: "Data obrigatória" }),
  hora_inicio: z.string().optional(),
  hora_fim: z.string().optional(),
  cliente_id: z.string().min(1, "Selecione um cliente"),
  site_name: z.string().min(1, "Nome da usina obrigatório"),
  servico_solicitado: z.string().min(1, "Tipo de serviço obrigatório"),
  descricao: z.string().min(10, "Descrição deve ter pelo menos 10 caracteres"),
  inspetor_responsavel: z.string().min(1, "Responsável obrigatório"),
  notes: z.string().optional(),
});

type WorkOrderFormData = z.infer<typeof workOrderSchema>;

const serviceTypes = [
  { value: "preventiva", label: "Preventiva" },
  { value: "corretiva", label: "Corretiva" },
  { value: "emergencia", label: "Emergência" },
  { value: "limpeza", label: "Limpeza" },
  { value: "eletrica", label: "Elétrica" },
  { value: "internet", label: "Internet" },
  { value: "outros", label: "Outros" },
];

const workTypes = [
  { value: "limpeza", label: "Limpeza" },
  { value: "eletrica", label: "Elétrica" },
  { value: "internet", label: "Internet" },
];

const WorkOrderCreate = () => {
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<Array<{ id: string; empresa: string; ufv_solarz: string | null }>>([]);
  const [tecnicos, setTecnicos] = useState<Array<{ id: string; nome: string }>>([]);
  const [selectedWorkTypes, setSelectedWorkTypes] = useState<string[]>([]);
  const [teamMembers, setTeamMembers] = useState<string[]>([]);
  const [newMember, setNewMember] = useState("");
  const [ufvSolarzList, setUfvSolarzList] = useState<string[]>([]);

  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const form = useForm<WorkOrderFormData>({
    resolver: zodResolver(workOrderSchema),
    defaultValues: {
      data_programada: new Date(),
      hora_inicio: "08:00",
      hora_fim: "17:00",
      cliente_id: "",
      site_name: "",
      servico_solicitado: "",
      descricao: "",
      inspetor_responsavel: "",
      notes: "",
    },
  });

  useEffect(() => {
    loadClientes();
    loadTecnicos();
  }, []);

  const loadClientes = async () => {
    const { data } = await supabase
      .from("clientes")
      .select("id, empresa, ufv_solarz")
      .order("empresa");
    setClientes(data || []);
    
    // Extrai lista única de UFV/SolarZ
    const ufvList = (data || [])
      .map((c) => c.ufv_solarz)
      .filter((ufv): ufv is string => ufv !== null && ufv.trim() !== "")
      .filter((ufv, index, arr) => arr.indexOf(ufv) === index)
      .sort((a, b) => a.localeCompare(b));
    setUfvSolarzList(ufvList);
  };
  
  // Quando seleciona UFV/SolarZ, preenche cliente automaticamente
  const handleUfvSolarzChange = (ufvSolarz: string) => {
    form.setValue("site_name", ufvSolarz);
    
    // Busca o primeiro cliente com esse UFV/SolarZ
    const cliente = clientes.find((c) => c.ufv_solarz === ufvSolarz);
    if (cliente) {
      form.setValue("cliente_id", cliente.id);
    }
  };

  const loadTecnicos = async () => {
    const { data } = await supabase
      .from("prestadores")
      .select("id, nome")
      .eq("categoria", "tecnico")
      .eq("ativo", true)
      .order("nome");
    setTecnicos(data || []);
  };

  const addTeamMember = () => {
    if (newMember.trim() && !teamMembers.includes(newMember.trim())) {
      setTeamMembers([...teamMembers, newMember.trim()]);
      setNewMember("");
    }
  };

  const removeTeamMember = (member: string) => {
    setTeamMembers(teamMembers.filter((m) => m !== member));
  };

  const toggleWorkType = (value: string) => {
    setSelectedWorkTypes((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]
    );
  };

  const onSubmit = async (data: WorkOrderFormData) => {
    if (selectedWorkTypes.length === 0) {
      toast({
        title: "Tipo de trabalho obrigatório",
        description: "Selecione pelo menos um tipo de trabalho",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // 1. Criar ticket primeiro
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error('Usuário não autenticado');

      // Buscar endereço do cliente
      const { data: clienteData } = await supabase
        .from("clientes")
        .select("endereco, cidade, estado")
        .eq("id", data.cliente_id)
        .single();

      const endereco = clienteData
        ? `${clienteData.endereco || ""}, ${clienteData.cidade || ""} - ${clienteData.estado || ""}`
        : data.site_name;

      const { data: ticketData, error: ticketError } = await supabase
        .from("tickets")
        .insert([{
          numero_ticket: "", // Will be generated by trigger
          cliente_id: data.cliente_id,
          titulo: `OS - ${data.site_name} - ${data.servico_solicitado}`,
          descricao: data.descricao,
          endereco_servico: endereco,
          equipamento_tipo: "outros" as const,
          prioridade: data.servico_solicitado === "emergencia" ? "critica" as const : "media" as const,
          status: "ordem_servico_gerada" as const,
          created_by: userId,
          data_vencimento: data.data_programada.toISOString(),
        }])
        .select()
        .single();

      if (ticketError) throw ticketError;

      // 2. Criar ordem de serviço
      const { data: osData, error: osError } = await supabase
        .from("ordens_servico")
        .insert([{
          ticket_id: ticketData.id,
          numero_os: `OS${Date.now()}`,
          data_programada: data.data_programada.toISOString(),
          hora_inicio: data.hora_inicio || null,
          hora_fim: data.hora_fim || null,
          site_name: data.site_name,
          servico_solicitado: data.servico_solicitado,
          work_type: selectedWorkTypes,
          equipe: teamMembers.length > 0 ? teamMembers : null,
          inspetor_responsavel: data.inspetor_responsavel,
          notes: data.notes || null,
        }])
        .select()
        .single();

      if (osError) throw osError;

      toast({
        title: "OS criada com sucesso!",
        description: `Ordem de serviço ${osData.numero_os} criada.`,
      });

      navigate(`/work-orders/${osData.id}`);
    } catch (error: any) {
      console.error("Erro ao criar OS:", error);
      toast({
        title: "Erro ao criar OS",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 animate-fade-in pb-24">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/work-orders")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Nova Ordem de Serviço</h1>
          <p className="text-muted-foreground">Preencha os dados para criar uma nova OS</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Bloco 1: Cabeçalho */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informações Gerais</CardTitle>
              <CardDescription>Data, cliente e localização</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Data */}
                <FormField
                  control={form.control}
                  name="data_programada"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Programada *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal h-12",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value
                                ? format(field.value, "dd/MM/yyyy", { locale: ptBR })
                                : "Selecione"}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            locale={ptBR}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Horários */}
                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    control={form.control}
                    name="hora_inicio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hora Início</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} className="h-12" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="hora_fim"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hora Fim</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} className="h-12" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* UFV/SolarZ */}
                <FormField
                  control={form.control}
                  name="site_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UFV/SolarZ *</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          field.onChange(value);
                          handleUfvSolarzChange(value);
                        }} 
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="h-12">
                            <SelectValue placeholder="Selecione a UFV/SolarZ" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ufvSolarzList.map((ufv) => (
                            <SelectItem key={ufv} value={ufv}>
                              {ufv}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Cliente (auto-preenchido) */}
                <FormField
                  control={form.control}
                  name="cliente_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cliente *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12">
                            <SelectValue placeholder="Selecione o cliente" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clientes.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.empresa}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Bloco 2: Serviço */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Descrição do Serviço</CardTitle>
              <CardDescription>Tipo e detalhes do trabalho</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tipo de Serviço */}
              <FormField
                control={form.control}
                name="servico_solicitado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Serviço Solicitado *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {serviceTypes.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Tipo de Trabalho (Multi-select) */}
              <div className="space-y-2">
                <FormLabel>Tipo de Trabalho *</FormLabel>
                <div className="flex flex-wrap gap-3">
                  {workTypes.map((wt) => (
                    <label
                      key={wt.value}
                      className={cn(
                        "flex items-center gap-2 px-4 py-3 rounded-lg border cursor-pointer transition-all",
                        selectedWorkTypes.includes(wt.value)
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <Checkbox
                        checked={selectedWorkTypes.includes(wt.value)}
                        onCheckedChange={() => toggleWorkType(wt.value)}
                      />
                      <span className="font-medium">{wt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Descrição */}
              <FormField
                control={form.control}
                name="descricao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição Detalhada *</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Descreva detalhadamente o serviço a ser realizado..."
                        className="min-h-[120px] resize-none"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Bloco 3: Equipe */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Equipe Responsável</CardTitle>
              <CardDescription>Responsável e membros da equipe</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Responsável */}
              <FormField
                control={form.control}
                name="inspetor_responsavel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Inspetor Responsável *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Nome do responsável" className="h-12" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Membros da Equipe */}
              <div className="space-y-2">
                <FormLabel>Membros da Equipe</FormLabel>
                <div className="flex gap-2">
                  <Input
                    value={newMember}
                    onChange={(e) => setNewMember(e.target.value)}
                    placeholder="Nome do membro"
                    className="h-12"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTeamMember();
                      }
                    }}
                  />
                  <Button type="button" onClick={addTeamMember} size="icon" className="h-12 w-12">
                    <Plus className="h-5 w-5" />
                  </Button>
                </div>
                {teamMembers.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {teamMembers.map((member) => (
                      <Badge key={member} variant="secondary" className="py-1.5 px-3">
                        {member}
                        <button
                          type="button"
                          onClick={() => removeTeamMember(member)}
                          className="ml-2 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Observações */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Observações adicionais..."
                        className="min-h-[80px] resize-none"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </form>
      </Form>

      {/* Footer fixo */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t shadow-lg z-50">
        <div className="max-w-4xl mx-auto flex gap-3">
          <Button
            variant="outline"
            className="flex-1 h-12"
            onClick={() => navigate("/work-orders")}
          >
            Cancelar
          </Button>
          <Button
            className="flex-1 h-12"
            onClick={form.handleSubmit(onSubmit)}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Criar OS
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WorkOrderCreate;
