import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Gift, LogOut, Star } from "lucide-react";
import { ClientService } from "@/services/clientService";
import { ClientDashboardData } from "@/types/client";
import { format, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

const ClientDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<ClientDashboardData | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const whatsapp = searchParams.get("whatsapp");
  const barbershopId = searchParams.get("barbershop_id");
  const barbershopSlug = searchParams.get("barbershop_slug");

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!whatsapp || !barbershopId) {
        if (!loading) navigate("/");
        return;
      }
      loadDashboard();
    }, 100);
    return () => clearTimeout(timer);
  }, [whatsapp, barbershopId]);

  const loadDashboard = async () => {
    if (!whatsapp || !barbershopId) return;
    setLoading(true);
    try {
      const data = await ClientService.getClientDashboard(whatsapp, barbershopId);
      if (!data) throw new Error("Cliente não encontrado");
      setDashboardData(data);
    } catch (error: any) {
      toast({ title: "Erro ao carregar dados", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    navigate(`/book/${barbershopSlug}/?whatsapp=${encodeURIComponent(whatsapp)}`);
    toast({ title: "Sessão encerrada" });
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    if (!window.confirm("Tem certeza que deseja cancelar seu agendamento?")) return;

    setCancelling(true);
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", appointmentId);

      if (error) throw error;

      toast({ title: "✅ Agendamento cancelado com sucesso" });
      await loadDashboard();
    } catch (error: any) {
      toast({ title: "Erro ao cancelar", description: error.message, variant: "destructive" });
    } finally {
      setCancelling(false);
    }
  };

  const handleReschedule = async (appointmentId: string) => {
    if (!window.confirm("O agendamento atual será cancelado. Deseja continuar?")) return;

    setCancelling(true);
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", appointmentId);

      if (error) throw error;

      toast({ title: "Agendamento cancelado, escolha um novo horário." });

      const url = `/book/${barbershopSlug}?whatsapp=${encodeURIComponent(whatsapp || "")}`;
      navigate(url);
    } catch (error: any) {
      toast({ title: "Erro ao reagendar", description: error.message, variant: "destructive" });
    } finally {
      setCancelling(false);
    }
  };

  const safeFormatDate = (dateStr: any, formatStr: string) => {
    if (!dateStr) return "—";
    try {
      let formattedStr = String(dateStr).replace(/\s/g, 'T');
      const finalDate = formattedStr.length === 10
        ? new Date(formattedStr + 'T12:00:00')
        : new Date(formattedStr);
      if (!isValid(finalDate)) return "Data inválida";
      return format(finalDate, formatStr, { locale: ptBR });
    } catch {
      return "—";
    }
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

  if (!dashboardData) return null;

  const { client, proximo_agendamento, progresso_fidelidade, cupom_aniversario } = dashboardData;

  return (
    <div className="min-h-screen bg-gradient-dark pb-20">
      <header className="bg-card/50 backdrop-blur-sm border-b border-border sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Olá, {client.nome}! 👋</h1>
            <p className="text-sm text-muted-foreground">{client.total_cortes} cortes realizados</p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl space-y-6">
        {/* Cupom de Aniversário */}
        {cupom_aniversario?.ativo && (
          <Card className="p-6 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/30">
            <div className="flex items-center gap-4">
              <Gift className="h-8 w-8 text-primary" />
              <div>
                <h3 className="font-bold">🎂 Feliz Aniversário!</h3>
                <p className="text-sm">Ganhou {cupom_aniversario.desconto}% OFF!</p>
                <p className="text-xs opacity-70">Válido até: {safeFormatDate(cupom_aniversario.valido_ate, "dd/MM")}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Próximo Agendamento */}
        {proximo_agendamento ? (
          <Card className="p-6 border-primary/50 bg-primary/5">
            <h3 className="font-bold mb-4">Próximo Agendamento</h3>
            <div className="flex items-center gap-3 mb-4">
              <Calendar className="text-primary" />
              <div>
                <p className="font-semibold">
                  {safeFormatDate(proximo_agendamento.date, "EEEE, dd 'de' MMMM")}
                </p>
                <p className="text-sm flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {proximo_agendamento.time}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {/* ── Reagendar: cancela o atual e vai para a tela de booking ── */}
              <Button
                variant="outline"
                className="flex-1"
                disabled={cancelling}
                onClick={() => handleReschedule(proximo_agendamento.id)}
              >
                {cancelling ? "Processando..." : "Reagendar"}
              </Button>
              {/* ── Cancelar ── */}
              <Button
                variant="destructive"
                className="flex-1"
                disabled={cancelling}
                onClick={() => handleCancelAppointment(proximo_agendamento.id)}
              >
                {cancelling ? "Processando..." : "Cancelar"}
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="p-8 text-center border-dashed border-2">
            <p className="mb-4">Nenhum agendamento futuro.</p>
            <Button onClick={() => navigate(`/book/${barbershopSlug}?whatsapp=${encodeURIComponent(whatsapp || "")}`)}>
              Agendar Agora
            </Button>
          </Card>
        )}

        {/* Programa de Fidelidade */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-lg">Programa de Fidelidade</h3>
            <Star className="h-5 w-5 text-primary" />
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">
                  {progresso_fidelidade.cortes_atuais} de {progresso_fidelidade.cortes_necessarios} cortes
                </span>
                <span className="font-bold text-primary">
                  {Math.floor(progresso_fidelidade.progresso_percentual)}%
                </span>
              </div>
              <Progress value={progresso_fidelidade.progresso_percentual} className="h-3" />
            </div>

            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: progresso_fidelidade.cortes_necessarios }).map((_, i) => (
                <div
                  key={i}
                  className={`aspect-square rounded-lg border-2 flex items-center justify-center ${
                    i < progresso_fidelidade.cortes_atuais
                      ? "bg-primary border-primary"
                      : "bg-muted border-border"
                  }`}
                >
                  {i < progresso_fidelidade.cortes_atuais && (
                    <Star className="h-4 w-4 text-primary-foreground fill-current" />
                  )}
                </div>
              ))}
            </div>

            <p className="text-sm text-center text-muted-foreground">
              {progresso_fidelidade.cortes_necessarios - progresso_fidelidade.cortes_atuais === 1 ? (
                <span className="text-primary font-semibold">
                  Falta apenas 1 corte para ganhar um benefício! 🎁
                </span>
              ) : (
                `Faltam ${progresso_fidelidade.cortes_necessarios - progresso_fidelidade.cortes_atuais} cortes para o próximo benefício`
              )}
            </p>
          </div>
        </Card>

        {/* Estatísticas */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{client.total_cortes}</p>
            <p className="text-xs text-muted-foreground">Total de Cortes</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold">
              {safeFormatDate(client.data_ultimo_corte, "dd/MM/yy")}
            </p>
            <p className="text-xs text-muted-foreground">Último Corte</p>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default ClientDashboard;