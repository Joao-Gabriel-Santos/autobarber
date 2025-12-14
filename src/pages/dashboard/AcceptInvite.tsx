import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Loader2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface InviteData {
  id: string;
  email: string;
  barbershop_id: string;
  status: string;
  expires_at: string;
  barbershops: {
    barbershop_name: string;
  };
}

const AcceptInvite = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [hasAccount, setHasAccount] = useState<boolean | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    whatsapp: "",
  });

  useEffect(() => {
    checkInvite();
  }, [token]);

  const checkInvite = async () => {
    if (!token) {
      navigate("/");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("barber_invites")
        .select(`
          *,
          barbershops (
            barbershop_name
          )
        `)
        .eq("invite_token", token)
        .maybeSingle();

      if (error || !data) {
        toast({
          title: "Convite inválido",
          description: "Este convite não existe ou já foi usado",
          variant: "destructive",
        });
        return;
      }

      if (data.status !== 'pending') {
        toast({
          title: "Convite já utilizado",
          variant: "destructive",
        });
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        toast({
          title: "Convite expirado",
          variant: "destructive",
        });
        return;
      }

      setInvite(data as InviteData);
      setFormData(prev => ({ ...prev, email: data.email }));
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!invite || !token) return;

    if (hasAccount === null) {
      toast({
        title: "Selecione uma opção",
        description: "Informe se você já tem uma conta ou precisa criar uma",
        variant: "destructive",
      });
      return;
    }

    setAccepting(true);

    try {
      let userId: string;

      if (hasAccount) {
        const { data: authData, error: loginError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (loginError) throw loginError;
        if (!authData.user) throw new Error("Erro ao fazer login");

        userId = authData.user.id;
      } else {
        if (!formData.fullName || !formData.whatsapp) {
          toast({
            title: "Preencha todos os campos",
            variant: "destructive",
          });
          setAccepting(false);
          return;
        }

        const { data: authData, error: signupError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.fullName,
              whatsapp: formData.whatsapp,
            }
          }
        });

        if (signupError) throw signupError;
        if (!authData.user) throw new Error("Erro ao criar conta");

        userId = authData.user.id;
      }

      const { data: acceptResult, error: acceptError } = await supabase
        .rpc('accept_barber_invite', {
          p_invite_token: token,
          p_user_id: userId
        });

      if (acceptError) throw acceptError;

      const result = acceptResult as { success: boolean; error?: string };

      if (!result.success) {
        throw new Error(result.error || "Erro ao aceitar convite");
      }

      toast({
        title: "Bem-vindo à equipe! 🎉",
        description: "Você agora faz parte da equipe",
      });

      setTimeout(() => {
        navigate("/dashboard");
      }, 2000);

    } catch (error: any) {
      console.error("Error accepting invite:", error);
      toast({
        title: "Erro ao aceitar convite",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Verificando convite...</p>
        </div>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-4">
        <Card className="p-8 text-center border-border bg-card max-w-md">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Convite Inválido</h2>
          <p className="text-muted-foreground mb-6">
            Este convite não existe, já foi usado ou expirou.
          </p>
          <Button onClick={() => navigate("/")} className="w-full">
            Voltar ao Início
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-4">
      <Card className="p-8 border-border bg-card max-w-md w-full">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="h-12 w-12 rounded-lg bg-gradient-gold flex items-center justify-center font-bold text-primary-foreground">
              AB
            </div>
            <span className="text-2xl font-bold bg-gradient-gold bg-clip-text text-transparent">
              AutoBarber
            </span>
          </div>
          <h1 className="text-2xl font-bold mb-2">Convite para Equipe</h1>
          <p className="text-muted-foreground">
            Você foi convidado para fazer parte da equipe de:
          </p>
          <p className="text-xl font-bold text-primary mt-2">
            {invite.barbershops.barbershop_name}
          </p>
        </div>

        <Alert className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Como barbeiro, você poderá gerenciar seus horários e visualizar seus agendamentos.
          </AlertDescription>
        </Alert>

        {hasAccount === null && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center mb-4">
              Você já tem uma conta no AutoBarber?
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                onClick={() => setHasAccount(true)}
                className="h-auto py-4"
              >
                <div className="text-center">
                  <CheckCircle2 className="h-6 w-6 mx-auto mb-2" />
                  <div className="font-semibold">Sim, tenho</div>
                  <div className="text-xs text-muted-foreground">Fazer login</div>
                </div>
              </Button>
              <Button
                variant="outline"
                onClick={() => setHasAccount(false)}
                className="h-auto py-4"
              >
                <div className="text-center">
                  <XCircle className="h-6 w-6 mx-auto mb-2" />
                  <div className="font-semibold">Não tenho</div>
                  <div className="text-xs text-muted-foreground">Criar conta</div>
                </div>
              </Button>
            </div>
          </div>
        )}

        {hasAccount !== null && (
          <div className="space-y-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setHasAccount(null)}
              className="mb-4"
            >
              ← Voltar
            </Button>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={true}
                className="bg-muted"
              />
            </div>

            <div>
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={hasAccount ? "Sua senha" : "Crie uma senha"}
                required
              />
            </div>

            {!hasAccount && (
              <>
                <div>
                  <Label htmlFor="fullName">Nome Completo</Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="João Silva"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="whatsapp">WhatsApp</Label>
                  <Input
                    id="whatsapp"
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    placeholder="(11) 99999-9999"
                    required
                  />
                </div>
              </>
            )}

            <Button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full shadow-gold"
              size="lg"
            >
              {accepting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                hasAccount ? "Entrar e Aceitar Convite" : "Criar Conta e Aceitar Convite"
              )}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AcceptInvite;