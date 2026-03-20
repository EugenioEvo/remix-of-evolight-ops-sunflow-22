import React, { useState, useEffect } from 'react';
import logger from '@/lib/logger';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Eye, EyeOff, Zap } from 'lucide-react';
import { z } from 'zod';

const signupSchema = z.object({
  nome: z.string()
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres')
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, 'Nome deve conter apenas letras'),
  email: z.string()
    .email('Email inválido')
    .max(255, 'Email deve ter no máximo 255 caracteres'),
  password: z.string()
    .min(8, 'Senha deve ter no mínimo 8 caracteres')
    .max(72, 'Senha deve ter no máximo 72 caracteres'),
  telefone: z.string()
    .regex(/^\d{10,11}$/, 'Telefone deve ter 10 ou 11 dígitos')
    .optional()
    .or(z.literal('')),
  role: z.enum(['cliente', 'tecnico_campo', 'area_tecnica']),
  empresa: z.string().max(200, 'Empresa deve ter no máximo 200 caracteres').optional(),
  cnpjCpf: z.string()
    .regex(/^\d{11}$|^\d{14}$/, 'CPF deve ter 11 dígitos ou CNPJ 14 dígitos')
    .optional()
    .or(z.literal('')),
  endereco: z.string().max(500, 'Endereço deve ter no máximo 500 caracteres').optional(),
  cidade: z.string().max(100, 'Cidade deve ter no máximo 100 caracteres').optional(),
  estado: z.string().max(2, 'Estado deve ter 2 caracteres').optional(),
  cep: z.string()
    .regex(/^\d{8}$/, 'CEP deve ter 8 dígitos')
    .optional()
    .or(z.literal('')),
  registroProfissional: z.string().max(50, 'Registro deve ter no máximo 50 caracteres').optional(),
  especialidades: z.string().max(500, 'Especialidades devem ter no máximo 500 caracteres').optional(),
  regiaoAtuacao: z.string().max(200, 'Região deve ter no máximo 200 caracteres').optional(),
});

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [role, setRole] = useState<'cliente' | 'tecnico_campo' | 'area_tecnica'>('cliente');
  const [empresa, setEmpresa] = useState('');
  const [cnpjCpf, setCnpjCpf] = useState('');
  const [endereco, setEndereco] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [cep, setCep] = useState('');
  const [registroProfissional, setRegistroProfissional] = useState('');
  const [especialidades, setEspecialidades] = useState('');
  const [regiaoAtuacao, setRegiaoAtuacao] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/sunflow');
      }
    };
    checkUser();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast({
        title: "Login realizado com sucesso!",
        description: "Bem-vindo de volta.",
      });
      
      navigate('/sunflow');
    } catch (error: any) {
      toast({
        title: "Erro no login",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate inputs
      const formData = {
        nome,
        email,
        password,
        telefone: telefone || '',
        role,
        empresa: role === 'cliente' ? empresa : undefined,
        cnpjCpf: role === 'cliente' ? cnpjCpf : '',
        endereco: role === 'cliente' ? endereco : undefined,
        cidade: role === 'cliente' ? cidade : undefined,
        estado: role === 'cliente' ? estado : undefined,
        cep: role === 'cliente' ? cep : '',
        registroProfissional: role === 'tecnico_campo' ? registroProfissional : undefined,
        especialidades: role === 'tecnico_campo' ? especialidades : undefined,
        regiaoAtuacao: role === 'tecnico_campo' ? regiaoAtuacao : undefined,
      };

      const validationResult = signupSchema.safeParse(formData);
      
      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        throw new Error(firstError.message);
      }

      const { data, error } = await supabase.auth.signUp({
        email: validationResult.data.email,
        password: validationResult.data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            nome: validationResult.data.nome,
            telefone: validationResult.data.telefone || undefined,
            role: validationResult.data.role,
            empresa: validationResult.data.empresa,
            cnpj_cpf: validationResult.data.cnpjCpf || undefined,
            endereco: validationResult.data.endereco,
            cidade: validationResult.data.cidade,
            estado: validationResult.data.estado,
            cep: validationResult.data.cep || undefined,
            registro_profissional: validationResult.data.registroProfissional,
            especialidades: validationResult.data.especialidades?.split(',').map(s => s.trim()),
            regiao_atuacao: validationResult.data.regiaoAtuacao,
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        toast({
          title: "Cadastro realizado com sucesso!",
          description: "Fazendo login...",
        });

        // Login automático após signup
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        // Chamar edge function para criar perfil do usuário
        const { error: profileError } = await supabase.functions.invoke('create-user-profile');
        
        if (profileError) {
          logger.error('Erro ao criar perfil:', profileError);
        }

        // Aguardar profile ser criado com polling (máximo 3 segundos)
        let attempts = 0;
        while (attempts < 6) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('id, user_roles(role)')
            .eq('user_id', data.user.id)
            .maybeSingle();
          
          if (profileData?.user_roles) {
            break;
          }
          
          await new Promise(r => setTimeout(r, 500));
          attempts++;
        }

        toast({
          title: "Bem-vindo!",
          description: "Login realizado com sucesso.",
        });

        navigate('/sunflow');
      }
    } catch (error: any) {
      toast({
        title: "Erro no cadastro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="relative">
              <Zap className="h-8 w-8 text-primary animate-pulse" />
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl"></div>
            </div>
            <span className="text-3xl font-bold bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 bg-clip-text text-transparent">
              SunFlow
            </span>
          </div>
          <CardTitle>{isLogin ? 'Entrar' : 'Criar Conta'}</CardTitle>
          <CardDescription>
            {isLogin 
              ? 'Entre com suas credenciais para acessar o sistema'
              : 'Preencha os dados para criar sua conta'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={isLogin ? 'login' : 'signup'} onValueChange={(value) => setIsLogin(value === 'login')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Entrando...' : 'Entrar'}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Senha</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome</Label>
                    <Input
                      id="nome"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input
                      id="telefone"
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Tipo de Usuário</Label>
                  <Select value={role} onValueChange={(value: any) => setRole(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cliente">Cliente</SelectItem>
                      <SelectItem value="tecnico_campo">Técnico de Campo</SelectItem>
                      <SelectItem value="area_tecnica">Área Técnica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {role === 'cliente' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="empresa">Empresa</Label>
                        <Input
                          id="empresa"
                          value={empresa}
                          onChange={(e) => setEmpresa(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cnpjCpf">CNPJ/CPF</Label>
                        <Input
                          id="cnpjCpf"
                          value={cnpjCpf}
                          onChange={(e) => setCnpjCpf(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endereco">Endereço</Label>
                      <Textarea
                        id="endereco"
                        value={endereco}
                        onChange={(e) => setEndereco(e.target.value)}
                        rows={2}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cidade">Cidade</Label>
                        <Input
                          id="cidade"
                          value={cidade}
                          onChange={(e) => setCidade(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="estado">Estado</Label>
                        <Input
                          id="estado"
                          value={estado}
                          onChange={(e) => setEstado(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cep">CEP</Label>
                        <Input
                          id="cep"
                          value={cep}
                          onChange={(e) => setCep(e.target.value)}
                        />
                      </div>
                    </div>
                  </>
                )}

                {role === 'tecnico_campo' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="registroProfissional">Registro Profissional</Label>
                      <Input
                        id="registroProfissional"
                        value={registroProfissional}
                        onChange={(e) => setRegistroProfissional(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="especialidades">Especialidades (separadas por vírgula)</Label>
                      <Input
                        id="especialidades"
                        value={especialidades}
                        onChange={(e) => setEspecialidades(e.target.value)}
                        placeholder="Ex: Painel Solar, Inversor, Bateria"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="regiaoAtuacao">Região de Atuação</Label>
                      <Input
                        id="regiaoAtuacao"
                        value={regiaoAtuacao}
                        onChange={(e) => setRegiaoAtuacao(e.target.value)}
                      />
                    </div>
                  </>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Criando conta...' : 'Criar Conta'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;