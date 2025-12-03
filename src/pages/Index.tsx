import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Calendar, MessageSquare, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  const benefits = [
    {
      icon: Calendar,
      title: "Agenda Automatizada",
      description: "Clientes agendam direto pelo link, sem mensagens infinitas",
    },
    {
      icon: MessageSquare,
      title: "Lembretes Automáticos",
      description: "Reduza faltas com lembretes 24h e 1h antes do horário",
    },
    {
      icon: TrendingUp,
      title: "Controle Financeiro",
      description: "Visualize receitas, perdas e previsões em tempo real",
    },
  ];

  const features = [
    "Agenda inteligente com disponibilidade em tempo real",
    "Link público personalizado para agendamentos",
    "Sistema anti-faltas com confirmações automáticas",
    "Painel financeiro completo",
    "Gestão de serviços e preços",
    "Relatórios e métricas de desempenho",
  ];

  return (
    <div className="min-h-screen bg-gradient-dark">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm bg-background/50 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-gradient-gold flex items-center justify-center font-bold text-primary-foreground">
              AB
            </div>
            <span className="text-xl font-bold bg-gradient-gold bg-clip-text text-transparent">
              AutoBarber
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/login")}>
              Entrar
            </Button>
            <Button onClick={() => navigate("/signup")}>
              Criar Conta
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 md:py-32">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-block px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
            ✨ Solução completa para barbearias
          </div>
          <h1 className="text-5xl md:text-7xl font-bold leading-tight">
            Agenda cheia
            <br />
            <span className="bg-gradient-gold bg-clip-text text-transparent">
              sem dor de cabeça
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            O AutoBarber automatiza agendamentos, reduz faltas e envia lembretes pelo WhatsApp.
            Mais tempo cortando, menos tempo administrando.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button 
              size="lg" 
              className="text-lg h-14 px-8 shadow-gold hover:shadow-gold/70 transition-all"
              onClick={() => navigate("/signup")}
            >
              Criar conta grátis
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="text-lg h-14 px-8"
              onClick={() => navigate("/login")}
            >
              Fazer login
            </Button>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="container mx-auto px-4 py-20">
        <div className="grid md:grid-cols-3 gap-8">
          {benefits.map((benefit, index) => (
            <div 
              key={index}
              className="bg-card border border-border rounded-xl p-8 hover:border-primary/50 transition-all hover:shadow-gold/20 hover:shadow-lg"
            >
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <benefit.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">{benefit.title}</h3>
              <p className="text-muted-foreground">{benefit.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12">
            Como <span className="text-primary">funciona</span>
          </h2>
          <div className="space-y-6">
            {[
              { step: "1", title: "Crie sua conta", desc: "Configure sua barbearia em minutos" },
              { step: "2", title: "Compartilhe o link", desc: "Clientes agendam sozinhos" },
              { step: "3", title: "Relaxe", desc: "Lembretes automáticos reduzem faltas" },
            ].map((item) => (
              <div key={item.step} className="flex gap-4 items-start">
                <div className="h-12 w-12 rounded-full bg-gradient-gold flex items-center justify-center font-bold text-primary-foreground flex-shrink-0">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-1">{item.title}</h3>
                  <p className="text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features List */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-2xl mx-auto bg-card border border-border rounded-2xl p-8 md:p-12">
          <h2 className="text-3xl font-bold mb-8 text-center">Tudo que você precisa</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-foreground">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center bg-gradient-gold rounded-2xl p-12 md:p-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-primary-foreground">
            Pronto para transformar sua barbearia?
          </h2>
          <p className="text-xl mb-8 text-primary-foreground/90">
            Junte-se a centenas de barbeiros que já automatizaram seus agendamentos
          </p>
          <Button 
            size="lg" 
            variant="secondary"
            className="text-lg h-14 px-8"
            onClick={() => navigate("/signup")}
          >
            Começar agora - É grátis
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© 2026 AutoBarber. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
