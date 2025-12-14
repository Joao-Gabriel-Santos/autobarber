import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Calendar, Settings, TrendingUp, LogOut, Copy, ExternalLink, DollarSign, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import WalkInAppointment from "@/components/WalkInAppointment";
import { usePermissions } from "@/hooks/usePermissions";
import { useSubscription } from "@/hooks/useSubscription";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { permissions, loading: permissionsLoading } = usePermissions();
  const { hasFeature, getPlanName } = useSubscription();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [barbershopSlug, setBarbershopSlug] = useState<string>("");
  const [barbershopName, setBarbershopName] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [totalHoje, setTotalHoje] = useState(0);
  const [receitaHoje, setReceitaHoje] = useState(0);
  const [taxaConfirmacao, setTaxaConfirmacao] = useState(0);

  const loadDashboardStats = async (userId: string) => {
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("appointments")
      .select("status, appointment_date, price")
      .eq("barber_id", userId)
      .eq("appointment_date", today);

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

      const stats = await loadDashboardStats(user.id);
      if (stats) {
        setTotalHoje(stats.totalHoje);
        setReceitaHoje(stats.receitaHoje);
        setTaxaConfirmacao(stats.taxaConfirmacao);
      }

      setUser(user);

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Error loading profile:", profileError);
      }

      const { data: barbershop, error: barbershopError } = await supabase
        .from("barbershops")
        .select("slug, barbershop_name")
        .eq("barber_id", user.id)
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

  const refreshStats = async () => {
    if (user) {
      const stats = await loadDashboardStats(user.id);
      if (stats) {
        setTotalHoje(stats.totalHoje);
        setReceitaHoje(stats.receitaHoje);
        setTaxaConfirmacao(stats.taxaConfirmacao);
      }
    }
  };

  useEffect(() => {
    checkUser();
  }, []);

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

  if (loading || permissionsLoading) {
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
      {/* ... (Header e Stats permanecem iguais) */}

      <main className="container mx-auto px-4 py-8">
        {/* Mostrar plano atual */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">
              Olá, <span className="text-primary">{fullName || "Barbeiro"}</span>
            </h1>
            <p className="text-muted-foreground">
              Bem-vindo ao painel da {barbershopName || "sua barbearia"}
            </p>
          </div>
          
          {/* Badge do Plano */}
          <div className="text-right">
            <div className="text-sm text-muted-foreground mb-1">Seu Plano</div>
            <div className="text-2xl font-bold text-primary">{getPlanName()}</div>
          </div>
          
          {/* Botão de Entrada Direta - DISPONÍVEL EM TODOS OS PLANOS */}
          {user && hasFeature('walk_in') && (
            <WalkInAppointment 
              barberId={user.id} 
              onSuccess={refreshStats}
            />
          )}
        </div>

        {/* Quick Stats */}
        {/* ... (permanece igual) */}

        {/* Action Cards - COM RESTRIÇÕES POR PLANO */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* 1️⃣ SERVIÇOS - Todos os planos */}
          {hasFeature('services') && (
            <div
              className="bg-card border border-border rounded-xl p-6 hover:border-primary transition-all cursor-pointer group"
              onClick={() => navigate("/dashboard/services")}
            >
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Settings className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-bold text-xl mb-2">Meus Serviços</h3>
              <p className="text-muted-foreground text-sm">
                Gerencie preços, duração e fotos dos cortes
              </p>
            </div>
          )}

          {/* 2️⃣ HORÁRIOS - Apenas Pro e Master */}
          {hasFeature('schedule') ? (
            <div
              className="bg-card border border-border rounded-xl p-6 hover:border-primary transition-all cursor-pointer group"
              onClick={() => navigate("/dashboard/schedule")}
            >
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-bold text-xl mb-2">Horários</h3>
              <p className="text-muted-foreground text-sm">
                Configure sua disponibilidade semanal
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-6 opacity-50 relative">
              <div className="absolute top-4 right-4">
                <Lock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center mb-4">
                <Calendar className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-bold text-xl mb-2">Horários</h3>
              <p className="text-muted-foreground text-sm mb-3">
                Configure sua disponibilidade semanal
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

          {/* 3️⃣ AGENDAMENTOS - Apenas Pro e Master */}
          {hasFeature('online_booking') ? (
            <div
              className="bg-card border border-border rounded-xl p-6 hover:border-primary transition-all cursor-pointer group"
              onClick={() => navigate("/dashboard/appointments")}
            >
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-bold text-xl mb-2">Agendamentos</h3>
              <p className="text-muted-foreground text-sm">
                Visualize e gerencie seus agendamentos
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-6 opacity-50 relative">
              <div className="absolute top-4 right-4">
                <Lock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center mb-4">
                <TrendingUp className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-bold text-xl mb-2">Agendamentos</h3>
              <p className="text-muted-foreground text-sm mb-3">
                Visualize e gerencie seus agendamentos
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

          {/* 4️⃣ FINANCEIRO - Todos os planos */}
          {hasFeature('finance') && (
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

          {/* 5️⃣ EQUIPE - Apenas Master */}
          {hasFeature('team_management') ? (
            <div
              className="bg-card border border-border rounded-xl p-6 hover:border-primary transition-all cursor-pointer group"
              onClick={() => navigate("/dashboard/team")}
            >
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-bold text-xl mb-2">Equipe</h3>
              <p className="text-muted-foreground text-sm">
                Gerencie barbeiros e convites da equipe
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-6 opacity-50 relative">
              <div className="absolute top-4 right-4">
                <Lock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-bold text-xl mb-2">Equipe</h3>
              <p className="text-muted-foreground text-sm mb-3">
                Gerencie barbeiros e convites da equipe
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

        {/* Link Público - Apenas Pro e Master */}
        {hasFeature('custom_link') && (
          <div className="mt-8">
            <Card className="p-6 border-border bg-card">
              {/* ... (código do link permanece igual) */}
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;