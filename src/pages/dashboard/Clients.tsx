import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft,
  Search,
  Users,
  Calendar,
  TrendingUp,
  Gift,
  Filter,
  Phone,
  MessageCircle
} from "lucide-react";
import { ClientService } from "@/services/clientService";
import { ClientWithMetrics, ClientFilters } from "@/types/client";
import { format, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ClientsManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientWithMetrics[]>([]);
  const [stats, setStats] = useState<any>(null);
  
  const [filters, setFilters] = useState<ClientFilters>({
    search: "",
    inativos: false,
    aniversariantes: false,
    sortBy: "nome",
    sortOrder: "asc"
  });

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

      // Verificar se é owner
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== 'owner') {
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
    const cleanNumber = whatsapp.replace(/\D/g, '');
    const message = encodeURIComponent(`Olá ${clientName}, tudo bem? Aqui é da barbearia!`);
    const whatsappUrl = `https://wa.me/${cleanNumber}?text=${message}`;
    window.open(whatsappUrl, '_blank');
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
              <p className="text-3xl font-bold text-primary">
                {stats.total_clientes}
              </p>
            </Card>

            <Card className="p-6 border-border bg-card hover:border-primary/50 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Clientes Ativos</span>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </div>
              <p className="text-3xl font-bold text-green-500">
                {stats.clientes_ativos}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Último corte há menos de 30 dias
              </p>
            </Card>

            <Card className="p-6 border-border bg-card hover:border-primary/50 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Clientes Inativos</span>
                <Calendar className="h-4 w-4 text-yellow-500" />
              </div>
              <p className="text-3xl font-bold text-yellow-500">
                {stats.clientes_inativos}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Mais de 30 dias sem corte
              </p>
            </Card>

            <Card className="p-6 border-border bg-card hover:border-primary/50 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Aniversariantes</span>
                <Gift className="h-4 w-4 text-primary" />
              </div>
              <p className="text-3xl font-bold text-primary">
                {stats.aniversariantes_mes}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Neste mês
              </p>
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
              <p className="text-muted-foreground">
                Nenhum cliente encontrado com os filtros aplicados.
              </p>
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
                          <p className="text-xs text-muted-foreground">
                            {client.dias_sem_corte} dias atrás
                          </p>
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
                            : "—"
                          }
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