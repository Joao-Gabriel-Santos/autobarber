import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Search } from "lucide-react";
import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';

const ClientAppointments = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();

  const barbershopId = searchParams.get("barbershop_id");

  const validateAndNormalize = (phone: string) => {
    const defaultCountry = 'BR' as CountryCode;
    const phoneNumber = parsePhoneNumberFromString(phone, defaultCountry);
    
    if (!phoneNumber) return { valid: false, reason: 'invalid_format' };

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

  const searchAppointments = async () => {
    if (!whatsapp) {
      toast({
        title: "Digite seu WhatsApp",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Validar e normalizar telefone
      const phoneCheck = validateAndNormalize(whatsapp);
      if (!phoneCheck.valid) {
        toast({
          title: "WhatsApp inválido",
          description: "Digite um número válido. Ex: (11) 98765-4321",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const normalizedWhatsapp = phoneCheck.e164;

      // Buscar cliente no banco de dados
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .select("barbershop_id, nome")
        .eq("whatsapp", normalizedWhatsapp)
        .maybeSingle();

      if (clientError) throw clientError;

      if (!client) {
        toast({
          title: "Cliente não encontrado",
          description: "Não encontramos nenhum agendamento com este número.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Buscar slug da barbearia
      const { data: barbershop, error: barbershopError } = await supabase
        .from("barbershops")
        .select("slug")
        .eq("barber_id", client.barbershop_id)
        .single();

      if (barbershopError) throw barbershopError;

      // Redirecionar para o dashboard do cliente
      const dashboardUrl = `/client-dashboard?whatsapp=${encodeURIComponent(normalizedWhatsapp)}&barbershop_id=${client.barbershop_id}&barbershop_slug=${barbershop.slug}`;
      
      navigate(dashboardUrl);

    } catch (error: any) {
      console.error("Error:", error);
      toast({
        title: "Erro ao buscar agendamentos",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchAppointments();
    }
  };

  const handleLogout = () => {
        const slug = searchParams.get("barbershop_slug");
        if (slug) {
          navigate(`/book/${slug}`);
        } else {
          navigate("/");
        }
        
        toast({
          title: "Sessão encerrada",
          description: "Você voltou para a página inicial da barbearia.",
        });
      };

  return (
    <div className="min-h-screen bg-gradient-dark">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6 text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="h-12 w-12 rounded-lg bg-gradient-gold flex items-center justify-center font-bold text-primary-foreground">
              AB
            </div>
            <span className="text-2xl font-bold bg-gradient-gold bg-clip-text text-transparent">
              AutoBarber
            </span>
          </div>
          <h1 className="text-3xl font-bold mb-2">Meus Agendamentos</h1>
          <p className="text-muted-foreground">
            Digite seu WhatsApp para acessar seus agendamentos
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="p-6 border-border bg-card mb-8">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="whatsapp">Digite seu WhatsApp</Label>
              <Input
                id="whatsapp"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="(00) 00000-0000"
                className="bg-background text-lg"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                💡 Use o mesmo número que você usou para fazer o agendamento
              </p>
            </div>

            <Button 
              onClick={searchAppointments} 
              disabled={loading}
              className="w-full shadow-gold"
              size="lg"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 mr-2 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Ver Meus Agendamentos
                </>
              )}
            </Button>
          </div>
        </Card>

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <p className="text-sm text-blue-600 dark:text-blue-400">
            ℹ️ <strong>Primeira vez aqui?</strong> Você será direcionado para uma área onde poderá ver todos os seus agendamentos, histórico de cortes e benefícios de fidelidade.
          </p>
        </div>

        <div className="mt-6 text-center">
          
          <Button 
            variant="ghost" 
            onClick={handleLogout}
            title="Sair"
          >
            ← Voltar para home
          </Button>
        </div>
      </main>
    </div>
  );
};

export default ClientAppointments;