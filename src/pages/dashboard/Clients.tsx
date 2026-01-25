// src/pages/ClientDashboard.tsx
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Calendar, 
  Clock, 
  Gift, 
  Zap, 
  MapPin,
  LogOut,
  Repeat,
  Star
} from "lucide-react";
import { ClientService } from "@/services/clientService";
import { ClientDashboardData } from "@/types/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

const ClientDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<ClientDashboardData | null>(null);
  
  // Pegar WhatsApp e BarbershopID da URL (ou de auth)
  const whatsapp = searchParams.get("whatsapp");
  const barbershopId = searchParams.get("barbershop_id");

  useEffect(() => {
    if (!whatsapp || !barbershopId) {
      toast({
        title: "Acesso inválido",
        description: "Parâmetros de autenticação não encontrados",
        variant: "destructive",
      });
      navigate("/");
      return;
    }

    loadDashboard();
  }, [whatsapp, barbershopId]);

  const loadDashboard = async () => {
    if (!whatsapp || !barbershopId) return;

    setLoading(true);
    try {
      const data = await ClientService.getClientDashboard(whatsapp, barbershopId);
      
      if (!data) {
        throw new Error("Cliente não encontrado");
      }

      setDashboardData(data);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRepeatLastService = async () => {
    if (!dashboardData?.client.ultimo_servico) {
      toast({
        title: "Sem histórico",
        description: "Você ainda não tem um serviço anterior registrado",
        variant: "destructive",
      });
      return;
    }

    const { service_id, barber_id } = dashboardData.client.ultimo_servico;
    
    // Redirecionar para página de agendamento com serviço pré-selecionado
    navigate(
      `/book/${searchParams.get("barbershop_slug")}?service=${service_id}&barber=${barber_id}&whatsapp=${whatsapp}`
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 rounded-lg bg-gradient-gold animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando seus dados...</p>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md">
          <h2 className="text-2xl font-bold mb-4">Dados não encontrados</h2>
          <p className="text-muted-foreground mb-6">
            Não conseguimos localizar suas informações.
          </p>
          <Button onClick={() => navigate("/")}>
            Voltar ao Início
          </Button>
        </Card>
      </div>
    );
  }

  const { client, proximo_agendamento, progresso_fidelidade, cupom_aniversario } = dashboardData;

  return (
    <div className="min-h-screen bg-gradient-dark pb-20">
      {/* Header */}
      <header className="bg-card/50 backdrop-blur-sm border-b border-border sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Olá, {client.nome}! 👋</h1>
              <p className="text-sm text-muted-foreground">
                {client.total_cortes} {client.total_cortes === 1 ? "corte realizado" : "cortes realizados"}
              </p>
            </div>
            <Button variant="ghost" size="icon">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl space-y-6">
        
        {/* Cupom de Aniversário */}
        {cupom_aniversario?.ativo && (
          <Card className="p-6 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/30">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-gradient-gold flex items-center justify-center">
                <Gift className="h-8 w-8 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg mb-1">
                  🎂 Feliz Aniversário!
                </h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Você ganhou <strong className="text-primary">{cupom_aniversario.desconto}% OFF</strong> no seu próximo corte!
                </p>
                <p className="text-xs text-muted-foreground">
                  Válido até {format(new Date(cupom_aniversario.valido_ate), "dd 'de' MMMM", { locale: ptBR })}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Próximo Agendamento */}
        {proximo_agendamento ? (
          <Card className="p-6 border-primary/50 bg-primary/5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Próximo Agendamento</h3>
              <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                Confirmado
              </Badge>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">
                    {format(new Date(proximo_agendamento.date), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {proximo_agendamento.time}
                  </p>
                </div>
              </div>

              <div className="pl-15 space-y-1">
                <p className="text-sm">
                  <strong>Serviço:</strong> {proximo_agendamento.service_name}
                </p>
                <p className="text-sm">
                  <strong>Barbeiro:</strong> {proximo_agendamento.barber_name}
                </p>
                <p className="text-lg font-bold text-primary">
                  R$ {proximo_agendamento.price.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button variant="outline" className="flex-1" size="sm">
                Reagendar
              </Button>
              <Button variant="destructive" className="flex-1" size="sm">
                Cancelar
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="p-8 text-center border-dashed border-2">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-bold mb-2">Nenhum agendamento</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Que tal agendar seu próximo corte?
            </p>
            <Button 
              onClick={() => navigate(`/book/${searchParams.get("barbershop_slug")}`)}
              className="shadow-gold"
            >
              Agendar Agora
            </Button>
          </Card>
        )}

        {/* Botão "O de Sempre" */}
        {client.ultimo_servico && (
          <Button
            onClick={handleRepeatLastService}
            className="w-full h-16 text-lg shadow-gold"
            size="lg"
          >
            <Repeat className="h-5 w-5 mr-2" />
            O de Sempre
            <span className="ml-2 text-sm opacity-80">
              ({client.ultimo_servico.service_name})
            </span>
          </Button>
        )}

        {/* Progresso de Fidelidade */}
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
              <Progress 
                value={progresso_fidelidade.progresso_percentual} 
                className="h-3"
              />
            </div>

            {/* Carimbos Visuais */}
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: progresso_fidelidade.cortes_necessarios }).map((_, i) => (
                <div
                  key={i}
                  className={`
                    aspect-square rounded-lg border-2 flex items-center justify-center
                    ${i < progresso_fidelidade.cortes_atuais
                      ? "bg-primary border-primary"
                      : "bg-muted border-border"
                    }
                  `}
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
            <p className="text-2xl font-bold text-primary">
              {client.total_cortes}
            </p>
            <p className="text-xs text-muted-foreground">
              Total de Cortes
            </p>
          </Card>
          
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold">
              {client.data_ultimo_corte ? (
                format(new Date(client.data_ultimo_corte), "dd/MM/yy")
              ) : (
                "—"
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              Último Corte
            </p>
          </Card>
        </div>

        {/* CTA Agendar */}
        {!proximo_agendamento && (
          <Button
            onClick={() => navigate(`/book/${searchParams.get("barbershop_slug")}`)}
            className="w-full shadow-gold"
            size="lg"
          >
            <Zap className="h-5 w-5 mr-2" />
            Agendar Novo Corte
          </Button>
        )}
      </main>
    </div>
  );
};

export default ClientDashboard;