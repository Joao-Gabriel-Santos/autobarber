import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Search, Users, Calendar, TrendingUp, Gift, Phone, MessageCircle, UserPlus } from "lucide-react";
import { ClientService } from "@/services/clientService";
import { ClientWithMetrics, ClientFilters } from "@/types/client";
import { format, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';

const ClientsManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientWithMetrics[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [filters, setFilters] = useState<ClientFilters>({
    search: "",
    inativos: false,
    aniversariantes: false,
    sortBy: "nome",
    sortOrder: "asc"
  });

  const [newClient, setNewClient] = useState({
    name: "",
    whatsapp: "",
    birthdate: "",
    email: "",
    notes: ""
  });

  // ─── Helpers (espelho do ClientAuth.tsx) ───────────────────────────────────

  const maskDate = (value: string): string => {
    return value
      .replace(/\D/g, "")
      .replace(/(\d{2})(\d)/, "$1/$2")
      .replace(/(\d{2})(\d)/, "$1/$2")
      .replace(/(\d{4})(\d+?)$/, "$1");
  };

  const convertDateToISO = (dateString: string): string | null => {
    if (!dateString || dateString.length !== 10) return null;

    const [day, month, year] = dateString.split("/");

    const dayNum = parseInt(day);
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    if (dayNum < 1 || dayNum > 31) return null;
    if (monthNum < 1 || monthNum > 12) return null;
    if (yearNum < 1900 || yearNum > new Date().getFullYear()) return null;

    return `${year}-${month}-${day}`;
  };

  const validateAndNormalize = (phone: string) => {
    const defaultCountry = "BR" as CountryCode;
    const phoneNumber = parsePhoneNumberFromString(phone, defaultCountry);
    if (!phoneNumber) return { valid: false, reason: "invalid_format" };

    const isPossible = phoneNumber.isPossible();
    const isValid = phoneNumber.isValid();
    const e164 = phoneNumber.number;

    return {
      valid: isPossible && isValid,
      e164,
      country: phoneNumber.country,
      nationalNumber: phoneNumber.nationalNumber,
    };
  };

  // ─── Efeitos e carregamento ────────────────────────────────────────────────

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user) {
      loadClients();
      loadStats();
    }
  }, [user, filters]);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "owner") {
        toast({
          title: "Acesso negado",
          description: "Apenas donos podem acessar esta página",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      setUser(user);
    } catch (error) {
      console.error("Error checking user:", error);
      navigate("/login");
    } finally {
      setLoading(false);
    }
  };

  const loadClients = async () => {
    if (!user) return;
    const data = await ClientService.listClients(user.id, filters);
    setClients(data);
  };

  const loadStats = async () => {
    if (!user) return;
    const data = await ClientService.getClientStats(user.id);
    setStats(data);
  };

  // ─── Cadastro manual (mesmo fluxo do ClientAuth.tsx) ──────────────────────

  const handleSaveClient = async () => {
    if (!newClient.name || !newClient.whatsapp) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha pelo menos o nome e WhatsApp do cliente",
        variant: "destructive",
      });
      return;
    }

    // Validar WhatsApp
    const phoneCheck = validateAndNormalize(newClient.whatsapp);
    if (!phoneCheck.valid) {
      toast({
        title: "WhatsApp inválido",
        description: "Digite um número válido. Ex: (11) 98765-4321",
        variant: "destructive",
      });
      return;
    }

    // Validar email se fornecido
    if (newClient.email && !newClient.email.includes("@")) {
      toast({
        title: "Email inválido",
        description: "Por favor, insira um email válido",
        variant: "destructive",
      });
      return;
    }

    // Validar e converter data de nascimento se fornecida
    let birthdateISO: string | null = null;
    if (newClient.birthdate) {
      birthdateISO = convertDateToISO(newClient.birthdate);
      if (!birthdateISO) {
        toast({
          title: "Data de nascimento inválida",
          description: "Digite uma data válida no formato DD/MM/AAAA",
          variant: "destructive",
        });
        return;
      }
    }

    // Verificar duplicidade
    const { data: existing } = await supabase
      .from("clients")
      .select("id")
      .eq("barbershop_id", user.id)
      .eq("whatsapp", phoneCheck.e164)
      .maybeSingle();

    if (existing) {
      toast({
        title: "Cliente já cadastrado",
        description: "Já existe um cliente com esse WhatsApp na sua barbearia",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const clientData: any = {
        barbershop_id: user.id,
        nome: newClient.name,
        whatsapp: phoneCheck.e164,
      };

      if (birthdateISO) clientData.data_nascimento = birthdateISO;
      if (newClient.email?.trim()) clientData.email = newClient.email.trim();
      if (newClient.notes?.trim()) clientData.notes = newClient.notes.trim();

      const { error } = await supabase.from("clients").insert(clientData);
      if (error) throw error;

      toast({
        title: "✅ Cliente cadastrado!",
        description: `${newClient.name} foi adicionado à sua base de clientes`,
      });

      setDialogOpen(false);
      setNewClient({ name: "", whatsapp: "", birthdate: "", email: "", notes: "" });
      loadClients();
      loadStats();
    } catch (error: any) {
      toast({
        title: "Erro ao cadastrar cliente",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setNewClient({ name: "", whatsapp: "", birthdate: "", email: "", notes: "" });
    }
  };

  // ─── Utilitários de UI ────────────────────────────────────────────────────

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      const date = new Date(dateStr);
      if (!isValid(date)) return "—";
      return format(date, "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return "—";
    }
  };

  const handleWhatsAppClick = (whatsapp: string, clientName: string) => {
    const cleanNumber = whatsapp.replace(/\D/g, "");
    const message = encodeURIComponent(`Olá ${clientName}, tudo bem? Aqui é da barbearia!`);
    window.open(`https://wa.me/${cleanNumber}?text=${message}`, "_blank");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 rounded-lg bg-gradient-gold animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-dark">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Gerenciar Clientes</h1>
                <p className="text-sm text-muted-foreground">
                  Visualize e gerencie sua base de clientes
                </p>
              </div>
            </div>

            {/* Botão de cadastro manual */}
            <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
              <DialogTrigger asChild>
                <Button className="shadow-gold" size="sm">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Novo Cliente
                </Button>
              </DialogTrigger>

              <DialogContent className="sm:max-w-md border-border bg-card">
                <DialogHeader>
                  <div className="flex flex-col items-center text-center mb-2">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                      <UserPlus className="h-6 w-6 text-primary" />
                    </div>
                    <DialogTitle className="text-2xl font-bold">Novo Cliente</DialogTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Preencha os dados para cadastrar manualmente
                    </p>
                  </div>
                </DialogHeader>

                <div className="space-y-4 mt-2">
                  {/* Nome */}
                  <div>
                    <Label htmlFor="client-name">
                      Nome e Sobrenome <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="client-name"
                      value={newClient.name}
                      onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && handleSaveClient()}
                      placeholder="Digite o nome completo"
                      className="bg-background mt-1"
                      autoFocus
                    />
                  </div>

                  {/* WhatsApp */}
                  <div>
                    <Label htmlFor="client-whatsapp">
                      WhatsApp <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="client-whatsapp"
                      value={newClient.whatsapp}
                      onChange={(e) => setNewClient({ ...newClient, whatsapp: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && handleSaveClient()}
                      placeholder="(00) 00000-0000"
                      className="bg-background mt-1"
                    />
                  </div>

                  {/* Data de Nascimento */}
                  <div>
                    <Label htmlFor="client-birthday">Data de Nascimento</Label>
                    <Input
                      id="client-birthday"
                      type="text"
                      inputMode="numeric"
                      value={newClient.birthdate}
                      onChange={(e) => {
                        const masked = maskDate(e.target.value);
                        setNewClient({ ...newClient, birthdate: masked });
                      }}
                      onKeyDown={(e) => e.key === "Enter" && handleSaveClient()}
                      maxLength={10}
                      placeholder="DD/MM/AAAA"
                      className="bg-background mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      💡 Informe para enviar mensagem no aniversário!
                    </p>
                  </div>

                  {/* Ações */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleDialogClose(false)}
                      disabled={saving}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleSaveClient}
                      disabled={saving}
                      className="flex-1 shadow-gold"
                    >
                      {saving ? "Cadastrando..." : "Cadastrar Cliente"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Estatísticas */}
        {stats && (
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            <Card className="p-6 border-border bg-card hover:border-primary/50 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Total de Clientes</span>
                <Users className="h-4 w-4 text-primary" />
              </div>
              <p className="text-3xl font-bold text-primary">{stats.total_clientes}</p>
            </Card>

            <Card className="p-6 border-border bg-card hover:border-primary/50 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Clientes Ativos</span>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </div>
              <p className="text-3xl font-bold text-green-500">{stats.clientes_ativos}</p>
              <p className="text-xs text-muted-foreground mt-1">Último corte há menos de 30 dias</p>
            </Card>

            <Card className="p-6 border-border bg-card hover:border-primary/50 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Clientes Inativos</span>
                <Calendar className="h-4 w-4 text-yellow-500" />
              </div>
              <p className="text-3xl font-bold text-yellow-500">{stats.clientes_inativos}</p>
              <p className="text-xs text-muted-foreground mt-1">Mais de 30 dias sem corte</p>
            </Card>

            <Card className="p-6 border-border bg-card hover:border-primary/50 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Aniversariantes</span>
                <Gift className="h-4 w-4 text-primary" />
              </div>
              <p className="text-3xl font-bold text-primary">{stats.aniversariantes_mes}</p>
              <p className="text-xs text-muted-foreground mt-1">Neste mês</p>
            </Card>
          </div>
        )}

        {/* Filtros */}
        <Card className="p-6 mb-6 border-border bg-card">
          <div className="grid md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou WhatsApp..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="pl-10"
                />
              </div>
            </div>

            <Select
              value={filters.sortBy}
              onValueChange={(value) => setFilters({ ...filters, sortBy: value as any })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nome">Nome</SelectItem>
                <SelectItem value="total_cortes">Total de Cortes</SelectItem>
                <SelectItem value="data_ultimo_corte">Último Corte</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Button
                variant={filters.inativos ? "default" : "outline"}
                size="sm"
                onClick={() => setFilters({ ...filters, inativos: !filters.inativos })}
                className="flex-1"
              >
                Inativos
              </Button>
              <Button
                variant={filters.aniversariantes ? "default" : "outline"}
                size="sm"
                onClick={() => setFilters({ ...filters, aniversariantes: !filters.aniversariantes })}
                className="flex-1"
              >
                <Gift className="h-4 w-4 mr-1" />
                Aniversário
              </Button>
            </div>
          </div>
        </Card>

        {/* Lista de Clientes */}
        <div className="space-y-4">
          {clients.length === 0 ? (
            <Card className="p-12 text-center border-border bg-card">
              <UserPlus className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground mb-4">
                Nenhum cliente encontrado com os filtros aplicados.
              </p>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(true)}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Cadastrar primeiro cliente
              </Button>
            </Card>
          ) : (
            clients.map((client) => (
              <Card key={client.id} className="p-6 border-border bg-card hover:border-primary/50 transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-lg">
                        {client.nome.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{client.nome}</h3>
                        <div className="flex items-center gap-2 text-sm">
                          <button
                            onClick={() => handleWhatsAppClick(client.whatsapp, client.nome)}
                            className="text-[#25D366] hover:text-[#20BA5A] hover:underline font-medium transition-colors flex items-center gap-1 group"
                          >
                            <Phone className="h-3 w-3" />
                            <span>{client.whatsapp}</span>
                            <MessageCircle className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Total de Cortes</p>
                        <p className="font-bold text-primary text-lg">{client.total_cortes}</p>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground">Último Corte</p>
                        <p className="font-semibold">{formatDate(client.data_ultimo_corte)}</p>
                        {client.dias_sem_corte !== undefined && (
                          <p className="text-xs text-muted-foreground">{client.dias_sem_corte} dias atrás</p>
                        )}
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground">Aniversário</p>
                        <p className="font-semibold">{formatDate(client.data_nascimento)}</p>
                        {client.is_aniversariante && (
                          <Badge className="mt-1 bg-primary/10 text-primary border-primary/20">
                            🎂 Aniversariante
                          </Badge>
                        )}
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground">Próximo Benefício</p>
                        <p className="font-semibold">
                          {client.proximo_beneficio !== undefined
                            ? `Faltam ${client.proximo_beneficio} cortes`
                            : "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default ClientsManagement;