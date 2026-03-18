import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Plus, Search, Mail, Phone, MapPin, Edit, Trash2, GraduationCap, Eye, Wrench, CheckCircle, XCircle, Clock } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logger } from '@/services/api';

const especialidadesOptions = [
  "Sistemas Fotovoltaicos",
  "Inversores",
  "Instalação Elétrica",
  "Manutenção Preventiva",
  "Manutenção Corretiva",
  "Gestão de Projetos",
  "Supervisão de Obra",
  "Comissionamento",
];

const certificacoesOptions = [
  "CREA",
  "NR-10",
  "NR-35",
  "CAT",
  "Fotovoltaica",
  "Gestão de Projetos",
];

const experienciaOptions = [
  "0-1 ano",
  "1-3 anos",
  "3-5 anos",
  "5-10 anos",
  "Mais de 10 anos",
];

const prestadorSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  telefone: z.string().optional(),
  cpf: z.string().optional(),
  endereco: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  cep: z.string().optional(),
  categoria: z.string().min(1, "Categoria é obrigatória"),
  especialidades: z.array(z.string()).optional(),
  certificacoes: z.array(z.string()).optional(),
  experiencia: z.string().optional(),
  data_admissao: z.string().optional(),
});

type PrestadorForm = z.infer<typeof prestadorSchema>;

interface Prestador extends Omit<PrestadorForm, 'categoria'> {
  id: string;
  categoria: string;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

const Prestadores = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("todos");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPrestador, setEditingPrestador] = useState<any>(null);
  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [loading, setLoading] = useState(true);

  const form = useForm<PrestadorForm>({
    resolver: zodResolver(prestadorSchema),
    defaultValues: {
      nome: "",
      email: "",
      telefone: "",
      cpf: "",
      endereco: "",
      cidade: "",
      estado: "",
      cep: "",
      categoria: "",
      especialidades: [],
      certificacoes: [],
      experiencia: "",
      data_admissao: "",
    },
  });

  const fetchPrestadores = async () => {
    try {
      const { data, error } = await supabase
        .from('prestadores')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        toast.error('Erro ao carregar prestadores');
        logger.error('Error fetching prestadores:', error);
        return;
      }

      setPrestadores(data || []);
    } catch (error) {
      toast.error('Erro ao carregar prestadores');
      logger.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrestadores();
  }, []);

  const onSubmit = async (data: PrestadorForm) => {
    try {
      if (editingPrestador) {
        // Atualizar prestador existente
        const { error } = await supabase
          .from('prestadores')
          .update(data)
          .eq('id', editingPrestador.id);

        if (error) {
          toast.error('Erro ao atualizar prestador');
          logger.error('Error updating prestador:', error);
          return;
        }

        toast.success("Prestador atualizado com sucesso!");
      } else {
        // Criar novo prestador
        const { error } = await supabase
          .from('prestadores')
          .insert([{ 
            ...data, 
            ativo: true,
            nome: data.nome || '',
            email: data.email || '',
            categoria: data.categoria || ''
          }]);

        if (error) {
          toast.error('Erro ao criar prestador');
          logger.error('Error creating prestador:', error);
          return;
        }

        toast.success("Prestador criado com sucesso!");
      }
      
      form.reset();
      setIsDialogOpen(false);
      setEditingPrestador(null);
      fetchPrestadores();
    } catch (error) {
      toast.error('Erro ao salvar prestador');
      console.error('Error:', error);
    }
  };

  const handleEdit = (prestador: any) => {
    setEditingPrestador(prestador);
    form.reset(prestador);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('prestadores')
        .delete()
        .eq('id', id);

      if (error) {
        toast.error('Erro ao remover prestador');
        console.error('Error deleting prestador:', error);
        return;
      }

      toast.success("Prestador removido com sucesso!");
      fetchPrestadores();
    } catch (error) {
      toast.error('Erro ao remover prestador');
      console.error('Error:', error);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const { error } = await supabase
        .from('prestadores')
        .update({ ativo: true })
        .eq('id', id);

      if (error) {
        toast.error('Erro ao aprovar prestador');
        return;
      }

      toast.success("Prestador aprovado com sucesso!");
      fetchPrestadores();
    } catch (error) {
      toast.error('Erro ao aprovar prestador');
    }
  };

  const handleReject = async (id: string) => {
    try {
      const { error } = await supabase
        .from('prestadores')
        .delete()
        .eq('id', id);

      if (error) {
        toast.error('Erro ao rejeitar prestador');
        return;
      }

      toast.success("Prestador rejeitado e removido.");
      fetchPrestadores();
    } catch (error) {
      toast.error('Erro ao rejeitar prestador');
    }
  };

  const getCategoriaColor = (categoria: string) => {
    switch (categoria) {
      case "engenharia": return "bg-blue-100 text-blue-800";
      case "supervisao": return "bg-orange-100 text-orange-800";
      case "tecnico": return "bg-green-100 text-green-800";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getCategoriaIcon = (categoria: string) => {
    switch (categoria) {
      case "engenharia": return GraduationCap;
      case "supervisao": return Eye;
      case "tecnico": return Wrench;
      default: return Users;
    }
  };

  const pendingPrestadores = prestadores.filter(p => !p.ativo);
  const activePrestadores = prestadores.filter(p => p.ativo);

  const filteredPrestadores = activePrestadores.filter(prestador => {
    const matchesSearch = prestador.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         prestador.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (prestador.especialidades && Array.isArray(prestador.especialidades) ? 
                          prestador.especialidades.join(' ').toLowerCase().includes(searchTerm.toLowerCase()) : false);
    
    if (activeTab === "todos") return matchesSearch;
    if (activeTab === "pendentes") return false;
    return matchesSearch && prestador.categoria === activeTab;
  });

  const categoryCounts = {
    todos: activePrestadores.length,
    pendentes: pendingPrestadores.length,
    engenharia: activePrestadores.filter(p => p.categoria === "engenharia").length,
    supervisao: activePrestadores.filter(p => p.categoria === "supervisao").length,
    tecnico: activePrestadores.filter(p => p.categoria === "tecnico").length,
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">Carregando prestadores...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Prestadores de Serviço</h1>
          <p className="text-muted-foreground">Gerencie a equipe técnica</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-solar shadow-solar" onClick={() => {
              setEditingPrestador(null);
              form.reset();
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Prestador
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPrestador ? "Editar Prestador" : "Novo Prestador"}
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
                        <FormLabel>Nome Completo</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="cpf"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPF</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="telefone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone</FormLabel>
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
                  name="endereco"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endereço</FormLabel>
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
                    name="cidade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cidade</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="estado"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estado</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="cep"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CEP</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="categoria"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoria</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a categoria" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="engenharia">Engenharia</SelectItem>
                            <SelectItem value="supervisao">Supervisão</SelectItem>
                            <SelectItem value="tecnico">Técnico de Campo</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="experiencia"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Experiência</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a experiência" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {experienciaOptions.map((exp) => (
                              <SelectItem key={exp} value={exp}>
                                {exp}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="especialidades"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Especialidades</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          const currentValues = field.value || [];
                          if (!currentValues.includes(value)) {
                            field.onChange([...currentValues, value]);
                          }
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione especialidades" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {especialidadesOptions.map((esp) => (
                            <SelectItem key={esp} value={esp}>
                              {esp}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {field.value?.map((esp) => (
                          <Badge
                            key={esp}
                            variant="secondary"
                            className="cursor-pointer"
                            onClick={() => {
                              field.onChange(field.value?.filter((e) => e !== esp));
                            }}
                          >
                            {esp} ✕
                          </Badge>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="certificacoes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Certificações</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          const currentValues = field.value || [];
                          if (!currentValues.includes(value)) {
                            field.onChange([...currentValues, value]);
                          }
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione certificações" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {certificacoesOptions.map((cert) => (
                            <SelectItem key={cert} value={cert}>
                              {cert}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {field.value?.map((cert) => (
                          <Badge
                            key={cert}
                            variant="secondary"
                            className="cursor-pointer"
                            onClick={() => {
                              field.onChange(field.value?.filter((c) => c !== cert));
                            }}
                          >
                            {cert} ✕
                          </Badge>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="data_admissao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Admissão</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="bg-gradient-solar">
                    {editingPrestador ? "Atualizar" : "Salvar"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setIsDialogOpen(false);
                      setEditingPrestador(null);
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
            placeholder="Buscar prestadores..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="pendentes" className="relative">
            Pendentes ({categoryCounts.pendentes})
            {categoryCounts.pendentes > 0 && (
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-destructive animate-pulse" />
            )}
          </TabsTrigger>
          <TabsTrigger value="todos">
            Todos ({categoryCounts.todos})
          </TabsTrigger>
          <TabsTrigger value="engenharia">
            Engenharia ({categoryCounts.engenharia})
          </TabsTrigger>
          <TabsTrigger value="supervisao">
            Supervisão ({categoryCounts.supervisao})
          </TabsTrigger>
          <TabsTrigger value="tecnico">
            Técnicos ({categoryCounts.tecnico})
          </TabsTrigger>
        </TabsList>

        {activeTab === 'pendentes' && (
          <div className="mt-6 grid gap-4">
            {pendingPrestadores.length === 0 ? (
              <Card className="p-6 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum cadastro pendente</h3>
                <p className="text-muted-foreground">Todos os prestadores foram aprovados.</p>
              </Card>
            ) : (
              pendingPrestadores.map((prestador) => (
                <Card key={prestador.id} className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40">
                          <Clock className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg font-semibold">{prestador.nome}</CardTitle>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="h-4 w-4" />
                            {prestador.email}
                            {prestador.telefone && (
                              <>
                                <span className="mx-1">·</span>
                                <Phone className="h-4 w-4" />
                                {prestador.telefone}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-amber-300 text-amber-700 dark:text-amber-400">
                          Pendente
                        </Badge>
                        <Button size="sm" variant="default" onClick={() => handleApprove(prestador.id)}>
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Aprovar
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleReject(prestador.id)}>
                          <XCircle className="h-4 w-4 mr-1" />
                          Rejeitar
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  {prestador.especialidades && Array.isArray(prestador.especialidades) && prestador.especialidades.length > 0 && (
                    <CardContent className="pt-0">
                      <div className="flex flex-wrap gap-1">
                        {prestador.especialidades.map((esp: string) => (
                          <Badge key={esp} variant="secondary" className="text-xs">{esp}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))
            )}
          </div>
        )}

        <TabsContent value={activeTab} className="mt-6">
          <div className="grid gap-4">
            {filteredPrestadores.map((prestador) => {
              const CategoriaIcon = getCategoriaIcon(prestador.categoria);
              
              return (
                <Card key={prestador.id} className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <CategoriaIcon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg font-semibold">{prestador.nome}</CardTitle>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="h-4 w-4" />
                            {prestador.email}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge className={getCategoriaColor(prestador.categoria)}>
                          {prestador.categoria === 'engenharia' ? 'Engenharia' :
                           prestador.categoria === 'supervisao' ? 'Supervisão' : 'Técnico'}
                        </Badge>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(prestador)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(prestador.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{prestador.telefone}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{prestador.cidade}, {prestador.estado}</span>
                      </div>
                      
                      <div>
                        <span className="font-medium">Experiência:</span> {prestador.experiencia} anos
                      </div>
                      
                      <div>
                        <span className="font-medium">Admissão:</span> {new Date(prestador.data_admissao).toLocaleDateString()}
                      </div>
                    </div>
                    
                    {prestador.especialidades && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <div className="text-sm">
                          <span className="font-medium text-muted-foreground">Especialidades:</span> {prestador.especialidades}
                        </div>
                      </div>
                    )}
                    
                    {prestador.certificacoes && (
                      <div className="mt-2">
                        <div className="text-sm">
                          <span className="font-medium text-muted-foreground">Certificações:</span> {prestador.certificacoes}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            
            {filteredPrestadores.length === 0 && (
              <Card className="p-6 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum prestador encontrado</h3>
                <p className="text-muted-foreground">
                  {searchTerm ? "Ajuste sua busca ou " : ""}
                  Adicione um novo prestador para começar.
                </p>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Prestadores;