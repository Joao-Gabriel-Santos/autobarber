import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Calendar, Settings, TrendingUp, LogOut, Copy, ExternalLink, DollarSign, Users, Lock, Clock, ShoppingBasket, ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useSubscription } from "@/hooks/useSubscription";
import { useOwnerSubscription } from "@/hooks/useOwnerSubscription";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { Users as UsersIcon } from "lucide-react";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { permissions, loading: permissionsLoading } = usePermissions();
  const { hasFeature, getPlanName, currentPlan } = useSubscription();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [barbershopSlug, setBarbershopSlug] = useState<string>("");
  const [barbershopName, setBarbershopName] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [totalHoje, setTotalHoje] = useState(0);
  const [receitaHoje, setReceitaHoje] = useState(0);
  const [taxaConfirmacao, setTaxaConfirmacao] = useState(0);

  // Hook para verificar plano do owner (para barbeiros)
  const { ownerPlan, loading: ownerPlanLoading } = useOwnerSubscription(user?.id || '');

  // Definir tipo de usuário
  const isOwner = !permissionsLoading && permissions?.role === 'owner';
  const isBarber = !permissionsLoading && permissions?.role === 'barber';
  
  // Para barbeiros, verificar se o owner tem plano Master (para acessar agendamentos e horários)
  const barberHasAdvancedAccess = isBarber && ownerPlan === 'master';
  
  // Barbeiros sempre têm acesso ao financeiro (seus próprios ganhos)
  const barberHasFinanceAccess = isBarber;

  const loadDashboardStats = async (userId: string) => {
    const today = new Date().toISOString().split("T")[0];

    let query = supabase
      .from("appointments")
      .select("status, appointment_date, price, barber_id")
      .eq("appointment_date", today);

    if (isBarber) {
      // Barbeiro vê apenas seus próprios agendamentos
      query = query.eq("barber_id", userId);
    } else if (isOwner && permissions?.ownerId) {
      // Owner vê todos os agendamentos da equipe
      const { data: teamMembers } = await supabase
        .from("profiles")
        .select("id")
        .or(`id.eq.${userId},barbershop_id.eq.${userId}`);
      
      const barberIds = teamMembers?.map(m => m.id) || [userId];
      query = query.in("barber_id", barberIds);
    }

    const { data, error } = await query;

    if (error) {
      console.error(error);
      return null;
    }

    const totalHoje = data.length;

    const receitaHoje = data
      .filter(a => a.status === "completed")
      .reduce((sum, a) => sum + (a.price || 0), 0);

    const taxaConfirmacao =
      totalHoje === 0
        ? 0
        : Math.round(
          (data.filter(a => a.status === "confirmed" || a.status === "completed").length /
            totalHoje) *
          100
        );

    return { totalHoje, receitaHoje, taxaConfirmacao };
  };

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        navigate("/login");
        return;
      }

      setUser(user);

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, role, barbershop_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Error loading profile:", profileError);
      }

      const targetId = profile?.role === 'barber' && profile.barbershop_id 
        ? profile.barbershop_id 
        : user.id;

      const { data: barbershop, error: barbershopError } = await supabase
        .from("barbershops")
        .select("slug, barbershop_name")
        .eq("barber_id", targetId)
        .maybeSingle();

      if (barbershopError) {
        console.error("Error loading barbershop:", barbershopError);
      }

      if (barbershop) {
        setBarbershopSlug(barbershop.slug || "");
        setBarbershopName(barbershop.barbershop_name || "");
      }

      if (profile) {
        setFullName(profile.full_name || "");
      }
    } catch (error) {
      console.error("Error checking user:", error);
      navigate("/login");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user && !permissionsLoading && permissions && !ownerPlanLoading) {
      console.log("✅ Permissions e Owner Plan carregados, buscando stats...");
      loadDashboardStats(user.id).then(stats => {
        if (stats) {
          setTotalHoje(stats.totalHoje);
          setReceitaHoje(stats.receitaHoje);
          setTaxaConfirmacao(stats.taxaConfirmacao);
        }
      });
    }
  }, [user, permissionsLoading, permissions, ownerPlanLoading]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Logout realizado",
        description: "Até logo!",
      });
      navigate("/");
    } catch (error) {
      toast({
        title: "Erro ao fazer logout",
        variant: "destructive",
      });
    }
  };

  const copyBookingLink = () => {
    if (!barbershopSlug) {
      toast({
        title: "Configure seu link primeiro",
        description: "Acesse as configurações para definir seu link personalizado.",
        variant: "destructive",
      });
      return;
    }

    const link = `${window.location.origin}/book/${barbershopSlug}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Link copiado!",
      description: "O link foi copiado para a área de transferência",
    });
  };

  const openBookingPage = () => {
    if (!barbershopSlug) {
      toast({
        title: "Configure seu link primeiro",
        description: "Acesse as configurações para definir seu link personalizado.",
        variant: "destructive",
      });
      return;
    }

    window.open(`${window.location.origin}/book/${barbershopSlug}`, '_blank');
  };

  if (loading || permissionsLoading || ownerPlanLoading) {
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
    <SubscriptionGate>
      <div className="min-h-screen bg-gradient-dark">
        {/* Header */}
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-lg bg-gradient-gold flex items-center justify-center font-bold text-primary-foreground">
                  AB
                </div>
                <span className="text-xl font-bold bg-gradient-gold bg-clip-text text-transparent">
                  AutoBarber
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground hidden sm:block">
                  {fullName || user?.email}
                  {isBarber && (
                    <span className="ml-2 text-xs bg-blue-500/10 text-blue-500 px-2 py-1 rounded">
                      Barbeiro ({ownerPlan === 'master' ? 'Master' : 'Starter'})
                    </span>
                  )}
                </span>
                <Button variant="outline" size="icon" onClick={() => navigate("/settings")}>
                  <Settings className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">
                Olá, <span className="text-primary">{fullName || "Barbeiro"}</span>
              </h1>
              <p className="text-muted-foreground">
                {isBarber 
                  ? `Você é barbeiro da ${barbershopName || "barbearia"} - ${ownerPlan === 'master' ? 'Acesso Master' : 'Acesso Starter'}`
                  : `Bem-vindo ao painel da ${barbershopName || "sua barbearia"}`
                }
              </p>
            </div>
            
          </div>

          {/* Quick Stats - Para Owner */}
          {isOwner && (
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <a href="/dashboard/appointments">
                <div className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-muted-foreground text-sm">Agendamentos Hoje</span>
                    <Calendar className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-3xl font-bold">{totalHoje}</p>
                </div>
              </a>
              <a href="/dashboard/Finance">
                <div className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-muted-foreground text-sm">Receita do Dia</span>
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-3xl font-bold">R${receitaHoje.toFixed(2)}</p>
                </div>
              </a>
              <div className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-muted-foreground text-sm">Taxa de Confirmação</span>
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <p className="text-3xl font-bold">{taxaConfirmacao}%</p>
              </div>
            </div>
          )}

          {/* Quick Stats - Para Barbeiros (Master e Starter) */}
          {isBarber && (
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* Agendamentos - Apenas para Master */}
              {barberHasAdvancedAccess && (
                <div className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-muted-foreground text-sm">Meus Agendamentos Hoje</span>
                    <Calendar className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-3xl font-bold">{totalHoje}</p>
                </div>
              )}

              {/* Receita - Todos os barbeiros */}
              <div className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-muted-foreground text-sm">Minha Receita Hoje</span>
                  <DollarSign className="h-4 w-4 text-primary" />
                </div>
                <p className="text-3xl font-bold">R${receitaHoje.toFixed(2)}</p>
              </div>

              {barberHasAdvancedAccess && (
                <div className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-muted-foreground text-sm">Taxa de Confirmação</span>
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-3xl font-bold">{taxaConfirmacao}%</p>
                </div>
              )}
            </div>
          )}

          {/* Action Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* HORÁRIOS */}
            {/* Owner: Conforme plano */}
            {isOwner && hasFeature('schedule') && (
              <div
                className="bg-card border border-border rounded-xl p-6 hover:border-primary transition-all cursor-pointer group"
                onClick={() => navigate("/dashboard/schedule")}
              >
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-bold text-xl mb-2">Horários</h3>
                <p className="text-muted-foreground text-sm">
                  Configure horários de funcionamento
                </p>
              </div>
            )}
            
            {/* Owner sem feature */}
            {isOwner && !hasFeature('schedule') && (
              <div className="bg-card border border-border rounded-xl p-6 opacity-50 relative">
                <div className="absolute top-4 right-4">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center mb-4">
                  <Clock className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-bold text-xl mb-2">Horários</h3>
                <p className="text-muted-foreground text-sm mb-3">
                  Configure horários de funcionamento
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate("/signup")}
                >
                  Upgrade para Pro
                </Button>
              </div>
            )}

            {/* Barbeiro Master: Tem acesso */}
            {isBarber && barberHasAdvancedAccess && (
              <div
                className="bg-card border border-border rounded-xl p-6 hover:border-primary transition-all cursor-pointer group"
                onClick={() => navigate("/dashboard/schedule")}
              >
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-bold text-xl mb-2">Meus Horários</h3>
                <p className="text-muted-foreground text-sm">
                  Configure sua disponibilidade semanal
                </p>
              </div>
            )}

            {/* AGENDAMENTOS */}
            {/* Owner: Conforme plano */}
            {isOwner && hasFeature('online_booking') && (
              <div
                className="bg-card border border-border rounded-xl p-6 hover:border-primary transition-all cursor-pointer group"
                onClick={() => navigate("/dashboard/appointments")}
              >
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-bold text-xl mb-2">Agendamentos</h3>
                <p className="text-muted-foreground text-sm">
                  Visualize e gerencie todos os agendamentos
                </p>
              </div>
            )}

            {/* Owner sem feature */}
            {isOwner && !hasFeature('online_booking') && (
              <div className="bg-card border border-border rounded-xl p-6 opacity-50 relative">
                <div className="absolute top-4 right-4">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center mb-4">
                  <Calendar className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-bold text-xl mb-2">Agendamentos</h3>
                <p className="text-muted-foreground text-sm mb-3">
                  Sistema de agendamento online
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate("/signup")}
                >
                  Upgrade para Pro
                </Button>
              </div>
            )}

            {/* Barbeiro Master: Tem acesso */}
            {isBarber && barberHasAdvancedAccess && (
              <div
                className="bg-card border border-border rounded-xl p-6 hover:border-primary transition-all cursor-pointer group"
                onClick={() => navigate("/dashboard/appointments")}
              >
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-bold text-xl mb-2">Meus Agendamentos</h3>
                <p className="text-muted-foreground text-sm">
                  Visualize e gerencie seus agendamentos
                </p>
              </div>
            )}

            {/* SERVIÇOS - Apenas Owner */}
            {isOwner && hasFeature('services') && (
              <div
                className="bg-card border border-border rounded-xl p-6 hover:border-primary transition-all cursor-pointer group"
                onClick={() => navigate("/dashboard/services")}
              >
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Settings className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-bold text-xl mb-2">Serviços</h3>
                <p className="text-muted-foreground text-sm">
                  Gerencie preços, duração e fotos dos cortes
                </p>
              </div>
            )}

            {/* FINANCEIRO */}
            {/* Owner: Conforme plano */}
            {isOwner && hasFeature('finance') && (
              <div
                className="bg-card border border-border rounded-xl p-6 hover:border-primary transition-all cursor-pointer group"
                onClick={() => navigate("/dashboard/finance")}
              >
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-bold text-xl mb-2">Financeiro</h3>
                <p className="text-muted-foreground text-sm">
                  Análise detalhada de receitas e métricas
                </p>
              </div>
            )}

            {/* Barbeiro: Sempre tem acesso (seus próprios ganhos) */}
            {isBarber && (
              <div
                className="bg-card border border-border rounded-xl p-6 hover:border-primary transition-all cursor-pointer group"
                onClick={() => navigate("/dashboard/finance")}
              >
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-bold text-xl mb-2">Meu Financeiro</h3>
                <p className="text-muted-foreground text-sm">
                  Visualize seus ganhos e métricas
                </p>
              </div>
            )}

            {/* CLIENTES - Apenas Owner */}
            {isOwner && (
              <div
                className="bg-card border border-border rounded-xl p-6 hover:border-primary transition-all cursor-pointer group"
                onClick={() => navigate("/dashboard/clients")}
              >
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <UsersIcon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-bold text-xl mb-2">Clientes</h3>
                <p className="text-muted-foreground text-sm">
                  Visualize e gerencie sua base de clientes
                </p>
              </div>
            )}

            {/* ✅ PRODUTOS - Apenas Owner Master */}
            {isOwner && (
              <>
                {currentPlan === 'master' ? (
                  <div
                    className="bg-card border border-border rounded-xl p-6 hover:border-primary transition-all cursor-pointer group"
                    onClick={() => navigate("/dashboard/product")}
                  >
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <ShoppingBasket className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-bold text-xl mb-2">Produtos</h3>
                    <p className="text-muted-foreground text-sm">
                      Gerencie produtos e estoque
                    </p>
                  </div>
                ) : (
                  <div className="bg-card border border-border rounded-xl p-6 opacity-50 relative">
                    <div className="absolute top-4 right-4">
                      <Lock className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center mb-4">
                      <ShoppingBasket className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="font-bold text-xl mb-2">Produtos</h3>
                    <p className="text-muted-foreground text-sm mb-3">
                      Gerencie produtos e estoque
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigate("/signup")}
                    >
                      Upgrade para Master
                    </Button>
                  </div>
                )}
              </>
            )}

            {/* ✅ ESTOQUE - Apenas Owner Master */}
            {isOwner && (
              <>
                {currentPlan === 'master' ? (
                  <div
                    className="bg-card border border-border rounded-xl p-6 hover:border-primary transition-all cursor-pointer group"
                    onClick={() => navigate("/dashboard/stock")}
                  >
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <ShoppingCart className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-bold text-xl mb-2">Estoque</h3>
                    <p className="text-muted-foreground text-sm">
                      Gerencie seu estoque
                    </p>
                  </div>
                ) : (
                  <div className="bg-card border border-border rounded-xl p-6 opacity-50 relative">
                    <div className="absolute top-4 right-4">
                      <Lock className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center mb-4">
                      <ShoppingCart className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="font-bold text-xl mb-2">Estoque</h3>
                    <p className="text-muted-foreground text-sm mb-3">
                      Gerencie seu estoque
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigate("/signup")}
                    >
                      Upgrade para Master
                    </Button>
                  </div>
                )}
              </>
            )}

            {/* EQUIPE - Apenas Owner Master */}
            {isOwner && hasFeature('team_management') ? (
              <div
                className="bg-card border border-border rounded-xl p-6 hover:border-primary transition-all cursor-pointer group"
                onClick={() => navigate("/dashboard/team")}
              >
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-bold text-xl mb-2">Equipe</h3>
                <p className="text-muted-foreground text-sm">
                  Gerencie barbeiros e convites
                </p>
              </div>
            ) : isOwner && (
              <div className="bg-card border border-border rounded-xl p-6 opacity-50 relative">
                <div className="absolute top-4 right-4">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-bold text-xl mb-2">Equipe</h3>
                <p className="text-muted-foreground text-sm mb-3">
                  Gerencie barbeiros e convites
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate("/signup")}
                >
                  Upgrade para Master
                </Button>
              </div>
            )}
          </div>

          {/* Link Público - Apenas Owner Pro e Master */}
          {isOwner && hasFeature('custom_link') && (
            <div className="mt-8">
              <Card className="p-6 border-border bg-card">
                <h3 className="font-bold text-lg mb-2">Link de Agendamento</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Compartilhe este link com seus clientes:
                </p>
                {!barbershopSlug ? (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-4">
                    <p className="text-sm text-yellow-600 dark:text-yellow-400">
                      ⚠️ Configure seu link personalizado nas configurações.
                    </p>
                    <Button
                      onClick={() => navigate("/settings")}
                      variant="outline"
                      className="mt-2"
                    >
                      Ir para Configurações
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={`${window.location.origin}/book/${barbershopSlug}`}
                        className="flex-1 bg-background"
                      />
                      <Button onClick={copyBookingLink}>
                        <Copy className="h-4 w-4 mr-2" />
                        Copiar
                      </Button>
                      <Button onClick={openBookingPage} variant="outline">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </Card>
            </div>
          )}

          {/* Link para Barbeiros */}
          {isBarber && barbershopSlug && (
            <div className="mt-8">
              <Card className="p-6 border-border bg-card">
                <h3 className="font-bold text-lg mb-2">Link de Agendamento</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Compartilhe este link com seus clientes:
                </p>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`${window.location.origin}/book/${barbershopSlug}`}
                    className="flex-1 bg-background"
                  />
                  <Button onClick={copyBookingLink}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar
                  </Button>
                  <Button onClick={openBookingPage} variant="outline">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </main>
      </div>
    </SubscriptionGate>
  );
};

export default Dashboard;