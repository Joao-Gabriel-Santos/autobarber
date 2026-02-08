import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';
import { LogIn, UserPlus } from "lucide-react";

const ClientAuth = () => {
  const { barberSlug } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  
  // Dados de login
  const [loginWhatsapp, setLoginWhatsapp] = useState("");
  
  // Dados de cadastro
  const [registerData, setRegisterData] = useState({
    name: "",
    whatsapp: "",
    birthday: "",
  });

  const [barbershopInfo, setBarbershopInfo] = useState<any>(null);
  const [ownerId, setOwnerId] = useState<string>("");

  // Carregar informações da barbearia ao montar
  useEffect(() => {
    loadBarbershopData();
  }, [barberSlug]);

  const maskDate = (value) => {
    return value
      .replace(/\D/g, "") // Remove tudo que não é número
      .replace(/(\d{2})(\d)/, "$1/$2") // Coloca a barra após os 2 primeiros números
      .replace(/(\d{2})(\d)/, "$1/$2") // Coloca a segunda barra após os próximos 2 números
      .replace(/(\d{4})(\d+?)$/, "$1"); // Limita o ano a 4 dígitos
  };

  const convertDateToISO = (dateString: string) => {
    // Formato esperado: DD/MM/YYYY
    if (!dateString || dateString.length !== 10) return null;
    
    const [day, month, year] = dateString.split('/');
    
    // Validação básica
    const dayNum = parseInt(day);
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);
    
    if (dayNum < 1 || dayNum > 31) return null;
    if (monthNum < 1 || monthNum > 12) return null;
    if (yearNum < 1900 || yearNum > new Date().getFullYear()) return null;
    
    // Retorna no formato ISO: YYYY-MM-DD
    return `${year}-${month}-${day}`;
  };

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

  const loadBarbershopData = async () => {
    if (!barberSlug) return;

    try {
      const { data: directData, error: directError } = await supabase
        .from("barbershops")
        .select("*")
        .eq("slug", barberSlug)
        .maybeSingle();

      if (directError || !directData) {
        toast({
          title: "Barbearia não encontrada",
          description: "Este link pode estar incorreto ou a barbearia não existe mais.",
          variant: "destructive",
        });
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", directData.barber_id)
        .maybeSingle();

      setOwnerId(directData.barber_id);

      const { data: { publicUrl: avatarUrl } } = supabase
        .storage
        .from('avatars')
        .getPublicUrl(`${directData.barber_id}/avatar.png`);

      const { data: { publicUrl: bannerUrl } } = supabase
        .storage
        .from('banners')
        .getPublicUrl(`${directData.barber_id}/banner.png`);

      setBarbershopInfo({
        id: directData.barber_id,
        name: directData.barbershop_name,
        slug: directData.slug,
        avatar_url: avatarUrl,
        banner_url: bannerUrl,
        banner_zoom: directData.banner_zoom || 100,
        banner_position_x: directData.banner_position_x || 50,
        banner_position_y: directData.banner_position_y || 50,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleLogin = async () => {
    if (!loginWhatsapp) {
      toast({
        title: "Digite seu WhatsApp",
        variant: "destructive",
      });
      return;
    }

    const phoneCheck = validateAndNormalize(loginWhatsapp);
    if (!phoneCheck.valid) {
      toast({
        title: "WhatsApp inválido",
        description: "Digite um número válido. Ex: (11) 98765-4321",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: client } = await supabase
        .from("clients")
        .select("*")
        .eq("barbershop_id", ownerId)
        .eq("whatsapp", phoneCheck.e164)
        .maybeSingle();

      if (client) {
        // Cliente existe, redirecionar para agendamento
        navigate(`/book/${barberSlug}?whatsapp=${encodeURIComponent(phoneCheck.e164)}`);
      } else {
        // Cliente não existe, mostrar formulário de cadastro
        setShowRegister(true);
        setRegisterData(prev => ({ ...prev, whatsapp: loginWhatsapp }));
        toast({
          title: "Novo cliente",
          description: "Preencha seus dados para continuar",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao verificar cadastro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!registerData.name || !registerData.whatsapp) {
      toast({
        title: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    const phoneCheck = validateAndNormalize(registerData.whatsapp);
    if (!phoneCheck.valid) {
      toast({
        title: "WhatsApp inválido",
        description: "Digite um número válido. Ex: (11) 98765-4321",
        variant: "destructive",
      });
      return;
    }

    // Validar e converter data de nascimento se fornecida
    let birthdayISO = null;
    if (registerData.birthday) {
      birthdayISO = convertDateToISO(registerData.birthday);
      if (!birthdayISO) {
        toast({
          title: "Data de nascimento inválida",
          description: "Digite uma data válida no formato DD/MM/AAAA",
          variant: "destructive",
        });
        return;
      }
    }

    setLoading(true);

    try {
      // Criar cliente
      const { data: client, error } = await supabase
        .from("clients")
        .insert({
          barbershop_id: ownerId,
          whatsapp: phoneCheck.e164,
          nome: registerData.name,
          data_nascimento: birthdayISO,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Cadastro realizado!",
        description: "Agora você pode fazer seu agendamento",
      });

      // Redirecionar para agendamento
      navigate(`/book/${barberSlug}?whatsapp=${encodeURIComponent(phoneCheck.e164)}`);
    } catch (error: any) {
      toast({
        title: "Erro ao cadastrar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (!showRegister) {
        handleLogin();
      } else {
        handleRegister();
      }
    }
  };

  if (!barbershopInfo) {
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
      {/* Header com Banner */}
      <header className="relative border-b border-border">
        {barbershopInfo.banner_url && (
          <div className="h-48 overflow-hidden relative">
            <div
              className="w-full h-full"
              style={{
                backgroundImage: `url(${barbershopInfo.banner_url})`,
                backgroundSize: `${barbershopInfo.banner_zoom}%`,
                backgroundPosition: `${barbershopInfo.banner_position_x}% ${barbershopInfo.banner_position_y}%`,
                backgroundRepeat: 'no-repeat',
              }}
            />
          </div>
        )}
        <div className="container mx-auto px-4 py-12 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            {barbershopInfo.avatar_url ? (
              <img 
                src={barbershopInfo.avatar_url} 
                alt="Logo" 
                className="h-20 w-20 rounded-full object-cover border-4 border-background shadow-lg -mt-10"
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-gradient-gold flex items-center justify-center font-bold text-primary-foreground text-2xl border-4 border-background shadow-lg -mt-10">
                {barbershopInfo.name?.charAt(0) || "AB"}
              </div>
            )}
          </div>
          <h1 className="text-3xl font-bold">
            {barbershopInfo.name}
          </h1>
          <p className="text-muted-foreground mb-4">
            Bem-vindo! Faça login ou cadastre-se para agendar
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-md">
        {!showRegister ? (
          /* TELA DE LOGIN */
          <Card className="p-8 border-border bg-card">
            <div className="text-center mb-6">
              <LogIn className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h2 className="text-2xl font-bold mb-2">Já sou cliente</h2>
              <p className="text-sm text-muted-foreground">
                Digite seu WhatsApp para continuar
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  value={loginWhatsapp}
                  onChange={(e) => setLoginWhatsapp(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="(00) 00000-0000"
                  className="bg-background"
                  autoFocus
                />
              </div>

              <Button
                onClick={handleLogin}
                disabled={loading}
                className="w-full shadow-gold"
                size="lg"
              >
                {loading ? "Verificando..." : "Continuar"}
              </Button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    Ou
                  </span>
                </div>
              </div>

              <Button
                onClick={() => setShowRegister(true)}
                variant="outline"
                className="w-full"
                size="lg"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Primeira vez aqui? Cadastrar
              </Button>
            </div>
          </Card>
        ) : (
          /* TELA DE CADASTRO */
          <Card className="p-8 border-border bg-card">
            <div className="text-center mb-6">
              <UserPlus className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h2 className="text-2xl font-bold mb-2">Novo Cliente</h2>
              <p className="text-sm text-muted-foreground">
                Preencha seus dados para fazer o primeiro agendamento
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nome e Sobrenome *</Label>
                <Input
                  id="name"
                  value={registerData.name}
                  onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                  onKeyPress={handleKeyPress}
                  placeholder="Digite seu nome completo"
                  className="bg-background"
                  autoFocus
                />
              </div>

              <div>
                <Label htmlFor="register-whatsapp">WhatsApp *</Label>
                <Input
                  id="register-whatsapp"
                  value={registerData.whatsapp}
                  onChange={(e) => setRegisterData({ ...registerData, whatsapp: e.target.value })}
                  onKeyPress={handleKeyPress}
                  placeholder="(00) 00000-0000"
                  className="bg-background"
                />
              </div>

              <div>
                <Label htmlFor="birthday" className="flex items-center gap-2">
                  Data de Nascimento *
                </Label>
                <Input
                  id="birthday"
                  type="text"
                  inputMode="numeric"
                  value={registerData.birthday}
                  onChange={(e) => {
                    const maskedValue = maskDate(e.target.value);
                    setRegisterData({ ...registerData, birthday: maskedValue });
                  }}
                  onKeyPress={handleKeyPress}
                  maxLength={10}
                  placeholder="00/00/0000"
                  className="bg-background"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  💡 Informe para ganhar descontos especiais!
                </p>
              </div>

              <Button
                onClick={handleRegister}
                disabled={loading}
                className="w-full shadow-gold"
                size="lg"
              >
                {loading ? "Cadastrando..." : "Cadastrar e Continuar"}
              </Button>

              <Button
                onClick={() => setShowRegister(false)}
                variant="ghost"
                className="w-full"
              >
                ← Voltar para login
              </Button>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
};

export default ClientAuth;