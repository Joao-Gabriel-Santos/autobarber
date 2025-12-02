import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Calendar, Settings, TrendingUp, LogOut, Copy, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [barbershopSlug, setBarbershopSlug] = useState<string>("");
  const [barbershopName, setBarbershopName] = useState<string>("");

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/login");
        return;
      }
      
      setUser(user);
      
      // Buscar slug da barbearia
      const { data: barbershop } = await supabase
        .from("barbershops")
        .select("slug, name")
        .eq("user_id", user.id)
        .single();
      
      if (barbershop) {
        setBarbershopSlug(barbershop.slug);
        setBarbershopName(barbershop.name);
      }
    } catch (error) {
      console.error("Error checking user:", error);
      navigate("/login");
    } finally {
      setLoading(false);
    }
  };

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
    const link = `${window.location.origin}/book/${barbershopSlug}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Link copiado!",
      description: "O link foi copiado para a área de transferência",
    });
  };

  const openBookingPage = () => {
    window.open(`${window.location.origin}/book/${barbershopSlug}`, '_blank');
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
                {user?.user_metadata?.barber_name || user?.email}
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
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">
            Olá, <span className="text-primary">{user?.user_metadata?.barber_name || "Barbeiro"}</span>
          </h1>
          <p className="text-muted-foreground">
            Bem-vindo ao painel da {barbershopName || user?.user_metadata?.barbershop_name || "sua barbearia"}
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-muted-foreground text-sm">Agendamentos Hoje</span>
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <p className="text-3xl font-bold">0</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-muted-foreground text-sm">Receita do Dia</span>
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <p className="text-3xl font-bold">R$ 0,00</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-muted-foreground text-sm">Taxa de Confirmação</span>
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <p className="text-3xl font-bold">100%</p>
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
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
        </div>

        {/* Public Link */}
        <div className="mt-8">
          <Card className="p-6 border-border bg-card">
            <h3 className="font-bold text-lg mb-2">Link de Agendamento</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Compartilhe este link com seus clientes para que eles possam fazer agendamentos online:
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={`${window.location.origin}/book/${barbershopSlug}`}
                className="flex-1 bg-background"
              />
              <Button onClick={copyBookingLink} disabled={!barbershopSlug}>
                <Copy className="h-4 w-4 mr-2" />
                Copiar
              </Button>
              <Button onClick={openBookingPage} disabled={!barbershopSlug} variant="outline">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
            {barbershopSlug && (
              <p className="text-xs text-muted-foreground mt-2">
                Seu link personalizado: <span className="text-primary font-medium">{barbershopSlug}</span>
              </p>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;