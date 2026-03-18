import { useState, useEffect } from "react";
import { logger } from '@/services/api';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, Plus, Search, Calendar, Shield, Edit, Trash2, Battery, Sun, Activity } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const equipamentoSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  modelo: z.string().optional(),
  fabricante: z.string().optional(),
  numero_serie: z.string().optional(),
  tipo: z.enum(["inversor", "painel_solar", "bateria", "cabeamento", "controlador_carga", "estrutura", "monitoramento", "outros"]),
  capacidade: z.string().optional(),
  tensao: z.string().optional(),
  corrente: z.string().optional(),
  data_instalacao: z.string().optional(),
  garantia: z.string().optional(),
  cliente_id: z.string().min(1, "Cliente é obrigatório"),
  localizacao: z.string().optional(),
  observacoes: z.string().optional(),
});

type EquipamentoForm = z.infer<typeof equipamentoSchema>;

interface Equipamento extends EquipamentoForm {
  id: string;
  status: string;
  created_at?: string;
  updated_at?: string;
  clientes?: {
    id: string;
    empresa?: string;
    profiles?: {
      nome: string;
    };
  };
}

const Equipamentos = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("todos");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEquipamento, setEditingEquipamento] = useState<any>(null);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const form = useForm<EquipamentoForm>({
    resolver: zodResolver(equipamentoSchema),
    defaultValues: {
      nome: "",
      modelo: "",
      fabricante: "",
      numero_serie: "",
      tipo: "inversor",
      capacidade: "",
      tensao: "",
      corrente: "",
      data_instalacao: "",
      garantia: "",
      cliente_id: "",
      localizacao: "",
      observacoes: "",
    },
  });

  const fetchEquipamentos = async () => {
    try {
      const { data, error } = await supabase
        .from('equipamentos')
        .select(`
          *,
          clientes (
            id,
            empresa,
            profiles (
              nome
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        toast.error('Erro ao carregar equipamentos');
        logger.error('Error fetching equipamentos:', error);
        return;
      }

      setEquipamentos(data || []);
    } catch (error) {
      toast.error('Erro ao carregar equipamentos');
      logger.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClientes = async () => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select(`
          id,
          empresa,
          profiles (
            nome
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching clientes:', error);
        return;
      }

      setClientes(data || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  useEffect(() => {
    fetchEquipamentos();
    fetchClientes();
  }, []);

  const onSubmit = async (data: EquipamentoForm) => {
    try {
      if (editingEquipamento) {
        // Atualizar equipamento existente
        const { error } = await supabase
          .from('equipamentos')
          .update(data)
          .eq('id', editingEquipamento.id);

        if (error) {
          toast.error('Erro ao atualizar equipamento');
          console.error('Error updating equipamento:', error);
          return;
        }

        toast.success("Equipamento atualizado com sucesso!");
      } else {
        // Criar novo equipamento
        const { error } = await supabase
          .from('equipamentos')
          .insert([{ 
            ...data, 
            status: 'ativo',
            nome: data.nome || '',
            tipo: data.tipo,
            cliente_id: data.cliente_id || ''
          }]);

        if (error) {
          toast.error('Erro ao criar equipamento');
          console.error('Error creating equipamento:', error);
          return;
        }

        toast.success("Equipamento criado com sucesso!");
      }
      
      form.reset();
      setIsDialogOpen(false);
      setEditingEquipamento(null);
      fetchEquipamentos();
    } catch (error) {
      toast.error('Erro ao salvar equipamento');
      console.error('Error:', error);
    }
  };

  const handleEdit = (equipamento: any) => {
    setEditingEquipamento(equipamento);
    form.reset(equipamento);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('equipamentos')
        .delete()
        .eq('id', id);

      if (error) {
        toast.error('Erro ao remover equipamento');
        console.error('Error deleting equipamento:', error);
        return;
      }

      toast.success("Equipamento removido com sucesso!");
      fetchEquipamentos();
    } catch (error) {
      toast.error('Erro ao remover equipamento');
      console.error('Error:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ativo": return "bg-green-100 text-green-800";
      case "manutencao": return "bg-yellow-100 text-yellow-800";
      case "defeito": return "bg-red-100 text-red-800";
      case "inativo": return "bg-gray-100 text-gray-800";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case "inversor": return Zap;
      case "painel_solar": return Sun;
      case "bateria": return Battery;
      case "medidor": return Activity;
      default: return Zap;
    }
  };

  const filteredEquipamentos = equipamentos.filter(equipamento => {
    const matchesSearch = equipamento.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         equipamento.modelo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         equipamento.fabricante.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === "todos") return matchesSearch;
    return matchesSearch && equipamento.tipo === activeTab;
  });

  const tipoCounts = {
    todos: equipamentos.length,
    inversor: equipamentos.filter(e => e.tipo === "inversor").length,
    painel_solar: equipamentos.filter(e => e.tipo === "painel_solar").length,
    bateria: equipamentos.filter(e => e.tipo === "bateria").length,
    outros: equipamentos.filter(e => e.tipo === "outros").length,
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">Carregando equipamentos...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Cadastro de Equipamentos</h1>
          <p className="text-muted-foreground">Gerencie equipamentos solares</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-solar shadow-solar" onClick={() => {
              setEditingEquipamento(null);
              form.reset();
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Equipamento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingEquipamento ? "Editar Equipamento" : "Novo Equipamento"}
              </DialogTitle>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="nome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do Equipamento</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="tipo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="inversor">Inversor</SelectItem>
                            <SelectItem value="painel_solar">Painel Solar</SelectItem>
                            <SelectItem value="bateria">Bateria</SelectItem>
                            
                            <SelectItem value="cabeamento">Cabeamento</SelectItem>
                            <SelectItem value="controlador_carga">Controlador de Carga</SelectItem>
                            <SelectItem value="estrutura">Estrutura</SelectItem>
                            <SelectItem value="monitoramento">Monitoramento</SelectItem>
                            <SelectItem value="outros">Outros</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fabricante"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fabricante</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="modelo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Modelo</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="numero_serie"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de Série</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="capacidade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Capacidade</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ex: 60 kW" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="tensao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tensão</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ex: 380V" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="corrente"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Corrente</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ex: 90A" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="cliente_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cliente</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o cliente" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {clientes.map((cliente) => (
                              <SelectItem key={cliente.id} value={cliente.id}>
                                {cliente.empresa || cliente.profiles?.nome || 'Cliente sem nome'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="localizacao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Localização</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ex: Telhado - Setor A" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="data_instalacao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Instalação</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="garantia"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Garantia</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ex: 5 anos" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="observacoes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Textarea {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="bg-gradient-solar">
                    {editingEquipamento ? "Atualizar" : "Salvar"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setIsDialogOpen(false);
                      setEditingEquipamento(null);
                      form.reset();
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar equipamentos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="todos">
            Todos ({tipoCounts.todos})
          </TabsTrigger>
          <TabsTrigger value="inversor">
            Inversores ({tipoCounts.inversor})
          </TabsTrigger>
          <TabsTrigger value="painel_solar">
            Painéis ({tipoCounts.painel_solar})
          </TabsTrigger>
          <TabsTrigger value="bateria">
            Baterias ({tipoCounts.bateria})
          </TabsTrigger>
          <TabsTrigger value="outros">
            Outros ({tipoCounts.outros})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <div className="grid gap-4">
            {filteredEquipamentos.map((equipamento) => {
              const TipoIcon = getTipoIcon(equipamento.tipo);
              
              return (
                <Card key={equipamento.id} className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-lg bg-primary/10">
                          <TipoIcon className="h-6 w-6 text-primary" />
                        </div>
                        
                        <div>
                          <h3 className="text-lg font-semibold">{equipamento.nome}</h3>
                          <p className="text-sm text-muted-foreground">
                            {equipamento.fabricante} - {equipamento.modelo}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            SN: {equipamento.numero_serie}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="text-right text-sm">
                          <p className="font-medium">
                            {equipamento.clientes?.empresa || equipamento.clientes?.profiles?.nome || 'Cliente não encontrado'}
                          </p>
                          <p className="text-muted-foreground">{equipamento.localizacao}</p>
                        </div>
                        
                        <Badge className={getStatusColor(equipamento.status)}>
                          {equipamento.status === 'ativo' ? 'Ativo' :
                           equipamento.status === 'manutencao' ? 'Manutenção' : 
                           equipamento.status}
                        </Badge>
                        
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(equipamento)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(equipamento.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      {equipamento.capacidade && (
                        <div>
                          <span className="font-medium">Capacidade:</span> {equipamento.capacidade}
                        </div>
                      )}
                      
                      {equipamento.tensao && (
                        <div>
                          <span className="font-medium">Tensão:</span> {equipamento.tensao}
                        </div>
                      )}
                      
                      {equipamento.corrente && (
                        <div>
                          <span className="font-medium">Corrente:</span> {equipamento.corrente}
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{new Date(equipamento.data_instalacao).toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    {equipamento.garantia && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <div className="flex items-center gap-2 text-sm">
                          <Shield className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Garantia:</span> {equipamento.garantia}
                        </div>
                      </div>
                    )}
                    
                    {equipamento.observacoes && (
                      <div className="mt-2">
                        <div className="text-sm">
                          <span className="font-medium text-muted-foreground">Observações:</span> {equipamento.observacoes}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            
            {filteredEquipamentos.length === 0 && (
              <Card className="p-6 text-center">
                <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum equipamento encontrado</h3>
                <p className="text-muted-foreground">
                  {searchTerm ? "Ajuste sua busca ou " : ""}
                  Adicione um novo equipamento para começar.
                </p>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Equipamentos;