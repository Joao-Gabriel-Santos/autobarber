import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const PLANS = {
  starter: { name: "Starter", price: 27, features: ["Entrada Direta", "Controle Financeiro", "1 Barbeiro"] },
  pro: { name: "Pro", price: 57, features: ["Agendamento Online", "Link Personalizado", "Lembretes", "1 Barbeiro"] },
  master: { name: "Master", price: 97, features: ["Até 5 Barbeiros", "Gestão de Equipe", "Relatórios Avançados"] },
};

const Signup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const planParam = searchParams.get("plan") as keyof typeof PLANS | null;
  
  const [selectedPlan, setSelectedPlan] = useState<keyof typeof PLANS>(
    planParam && PLANS[planParam] ? planParam : "pro"
  );
  
  const [formData, setFormData] = useState({
    barbershopName: "",
    barberName: "",
    whatsapp: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1️⃣ Criar usuário no Auth com metadata incluindo o plano escolhido
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: {
            full_name: formData.barberName,
            whatsapp: formData.whatsapp,
            barbershop_name: formData.barbershopName,
            selected_plan: selectedPlan, // 👈 Salvar plano escolhido
          }
        },
      });

      if (error) throw error;
      if (!data.user) throw new Error("Usuário não foi criado.");

      // 2️⃣ TODO: Redirecionar para checkout do Stripe
      // Aqui você vai implementar a integração com Stripe
      console.log("Plano selecionado:", selectedPlan);
      console.log("Preço:", PLANS[selectedPlan].price);

      toast({
        title: "Conta criada com sucesso!",
        description: `Plano ${PLANS[selectedPlan].name} selecionado. Verifique seu e-mail para confirmar.`,
      });

      navigate("/login");
    } catch (error: any) {
      console.error("Signup error:", error);
      toast({
        title: "Erro ao criar conta",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
    // Adicionar ao handleSignup após criar usuário:

// Mapear planos para Stripe Price IDs
const STRIPE_PRICES = {
  starter: import.meta.env.VITE_STRIPE_PRICE_STARTER,
  pro: import.meta.env.VITE_STRIPE_PRICE_PRO,
  master: import.meta.env.VITE_STRIPE_PRICE_MASTER,
};

// Chamar função Edge para criar checkout
const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke(
  'create-checkout',
  {
    body: {
      priceId: STRIPE_PRICES[selectedPlan],
      email: formData.email,
    },
  }
);

if (checkoutError) throw checkoutError;

// Redirecionar para Stripe Checkout
if (checkoutData?.url) {
  window.location.href = checkoutData.url;
}
  };

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="h-12 w-12 rounded-lg bg-gradient-gold flex items-center justify-center font-bold text-primary-foreground">
              AB
            </div>
            <span className="text-2xl font-bold bg-gradient-gold bg-clip-text text-transparent">
              AutoBarber
            </span>
          </div>
          <h1 className="text-3xl font-bold mb-2">Crie sua conta</h1>
          <p className="text-muted-foreground">Comece a automatizar sua barbearia hoje</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-8 shadow-strong">
          {/* Seletor de Plano */}
          <div className="mb-6">
            <Label className="mb-3 block">Escolha seu plano</Label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(PLANS) as Array<keyof typeof PLANS>).map((plan) => (
                <button
                  key={plan}
                  type="button"
                  onClick={() => setSelectedPlan(plan)}
                  className={`p-3 rounded-lg border-2 transition-all text-center ${
                    selectedPlan === plan
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="font-bold text-sm capitalize">{PLANS[plan].name}</div>
                  <div className="text-primary text-lg font-bold">
                    R$ {PLANS[plan].price}
                  </div>
                  <div className="text-xs text-muted-foreground">/mês</div>
                </button>
              ))}
            </div>
            
            {/* Features do plano selecionado */}
            <div className="mt-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
              <p className="text-xs font-semibold mb-2 text-primary">
                Incluído no plano {PLANS[selectedPlan].name}:
              </p>
              <ul className="space-y-1">
                {PLANS[selectedPlan].features.map((feature, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                    <span className="text-primary">✓</span> {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="barbershopName">Nome da Barbearia</Label>
              <Input
                id="barbershopName"
                placeholder="Barbearia XYZ"
                value={formData.barbershopName}
                onChange={(e) => updateFormData("barbershopName", e.target.value)}
                required
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="barberName">Seu Nome</Label>
              <Input
                id="barberName"
                placeholder="João Silva"
                value={formData.barberName}
                onChange={(e) => updateFormData("barberName", e.target.value)}
                required
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                placeholder="(11) 99999-9999"
                value={formData.whatsapp}
                onChange={(e) => updateFormData("whatsapp", e.target.value)}
                required
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={formData.email}
                onChange={(e) => updateFormData("email", e.target.value)}
                required
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => updateFormData("password", e.target.value)}
                required
                minLength={6}
                className="bg-background"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full shadow-gold" 
              disabled={loading}
            >
              {loading ? "Criando conta..." : `Começar com ${PLANS[selectedPlan].name} - 7 dias grátis`}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              💳 Você não será cobrado durante o período de teste
            </p>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Já tem uma conta? </span>
            <Button 
              variant="link" 
              className="p-0 h-auto text-primary"
              onClick={() => navigate("/login")}
            >
              Fazer login
            </Button>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/")}
          >
            ← Voltar para home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Signup;