import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';

const ClientAppointments = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();

  const whatsapp = searchParams.get("whatsapp");
  const barbershopSlug = searchParams.get("barbershop_slug");

  useEffect(() => {
    if (whatsapp && barbershopSlug) {
      loadClientDashboard();
    } else {
      toast({
        title: "Link inválido",
        description: "Parâmetros necessários não foram fornecidos",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [whatsapp, barbershopSlug]);

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

  const loadClientDashboard = async () => {
    if (!whatsapp) return;

    setLoading(true);
    try {
      const phoneCheck = validateAndNormalize(whatsapp);
      if (!phoneCheck.valid) {
        toast({
          title: "WhatsApp inválido",
          description: "Link com formato de telefone inválido",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      const normalizedWhatsapp = phoneCheck.e164;

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
        navigate("/");
        return;
      }

      const dashboardUrl = `/client-dashboard?whatsapp=${encodeURIComponent(normalizedWhatsapp)}&barbershop_id=${client.barbershop_id}&barbershop_slug=${barbershopSlug}`;
      
      navigate(dashboardUrl);

    } catch (error: any) {
      console.error("Error:", error);
      toast({
        title: "Erro ao buscar agendamentos",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center h-screen"> 
    {/* Adicionei uma div de abertura com classes de exemplo */}
    <div className="p-4 text-center">
      <p>
        {loading ? "Carregando seus agendamentos..." : "Redirecionando..."}
      </p>
    </div>
  </div>
  );
};

export default ClientAppointments;