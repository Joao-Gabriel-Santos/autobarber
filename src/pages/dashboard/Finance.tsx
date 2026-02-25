import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, TrendingUp, DollarSign, Award, Calendar, Wallet, BarChart2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  eachDayOfInterval, subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { usePermissions } from "@/hooks/usePermissions";

const Finance = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { permissions, loading: permissionsLoading } = usePermissions();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [weeklyRevenue, setWeeklyRevenue]     = useState(0);
  const [monthlyRevenue, setMonthlyRevenue]   = useState(0);
  const [totalRevenue, setTotalRevenue]       = useState(0);
  const [totalAppointments, setTotalAppointments] = useState(0);
  const [allTimeAvgTicket, setAllTimeAvgTicket]   = useState(0);
  const [weeklyData, setWeeklyData]           = useState<any[]>([]);
  const [monthlyData, setMonthlyData]         = useState<any[]>([]);
  const [lastMonthRevenue, setLastMonthRevenue] = useState(0);
  const [weeklyCount, setWeeklyCount]         = useState(0);
  const [monthlyCount, setMonthlyCount]       = useState(0);

  const isBarber = !permissionsLoading && permissions?.role === 'barber';
  const isOwner  = !permissionsLoading && permissions?.role === 'owner';

  useEffect(() => { checkUser(); }, []);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }
      setUser(user);
    } catch { navigate("/login"); } finally { setLoading(false); }
  };

  useEffect(() => {
    if (user && !permissionsLoading && permissions) loadFinancialData(user.id);
  }, [user, permissionsLoading, permissions]);

  const loadFinancialData = async (userId: string) => {
    try {
      if (!permissions) return;

      let query = supabase
        .from("appointments")
        .select("id, appointment_date, price, status, barber_id")
        .eq("status", "completed");

      if (permissions.role === 'barber') {
        query = query.eq("barber_id", userId);
      } else if (permissions.role === 'owner') {
        const { data: teamMembers } = await supabase
          .from("profiles").select("id")
          .or(`id.eq.${userId},barbershop_id.eq.${userId}`);
        const ids = teamMembers?.map(m => m.id) || [userId];
        query = query.in("barber_id", ids);
      }

      const { data: appointments, error } = await query;
      if (error) throw error;

      const now = new Date();
      const weekStart  = startOfWeek(now, { locale: ptBR });
      const weekEnd    = endOfWeek(now, { locale: ptBR });
      const monthStart = startOfMonth(now);
      const monthEnd   = endOfMonth(now);
      const lmStart    = startOfMonth(subMonths(now, 1));
      const lmEnd      = endOfMonth(subMonths(now, 1));

      const inRange = (apt: any, s: Date, e: Date) => {
        const d = new Date(apt.appointment_date);
        return d >= s && d <= e;
      };

      const weekApts  = appointments?.filter(a => inRange(a, weekStart, weekEnd)) || [];
      const monthApts = appointments?.filter(a => inRange(a, monthStart, monthEnd)) || [];
      const lmApts    = appointments?.filter(a => inRange(a, lmStart, lmEnd)) || [];

      const weekRev  = weekApts.reduce((s, a) => s + a.price, 0);
      const monthRev = monthApts.reduce((s, a) => s + a.price, 0);
      const lmRev    = lmApts.reduce((s, a) => s + a.price, 0);
      const allRev   = (appointments || []).reduce((s, a) => s + a.price, 0);
      const allCount = appointments?.length || 0;

      setWeeklyRevenue(weekRev);
      setMonthlyRevenue(monthRev);
      setLastMonthRevenue(lmRev);
      setTotalRevenue(allRev);
      setTotalAppointments(allCount);
      setAllTimeAvgTicket(allCount > 0 ? allRev / allCount : 0);
      setWeeklyCount(weekApts.length);
      setMonthlyCount(monthApts.length);

      // Gráfico semanal
      const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
      setWeeklyData(weekDays.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayApts = weekApts.filter(a => a.appointment_date === dayStr);
        return {
          date: format(day, 'EEE', { locale: ptBR }),
          revenue: dayApts.reduce((s, a) => s + a.price, 0),
          count: dayApts.length,
        };
      }));

      // Gráfico últimos 3 meses
      const monthsData = [];
      for (let i = 2; i >= 0; i--) {
        const md = subMonths(now, i);
        const ms = startOfMonth(md);
        const me = endOfMonth(md);
        const mApts = appointments?.filter(a => inRange(a, ms, me)) || [];
        monthsData.push({
          month: format(md, 'MMM', { locale: ptBR }),
          revenue: mApts.reduce((s, a) => s + a.price, 0),
          count: mApts.length,
        });
      }
      setMonthlyData(monthsData);

    } catch (error: any) {
      toast({ title: "Erro ao carregar dados", description: error.message, variant: "destructive" });
    }
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

  const growthPct = lastMonthRevenue > 0
    ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(1)
    : "0";

  return (
    <div className="min-h-screen bg-gradient-dark">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {isBarber ? "Meu Painel Financeiro" : "Painel Financeiro"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isBarber ? "Seus ganhos e desempenho" : "Receitas e desempenho da barbearia"}
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl space-y-8">

        {/* ── KPIs ─────────────────────────────────────────────────────────── */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6 border-border bg-card hover:border-primary/50 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">{isBarber ? "Minha Receita Semanal" : "Receita Semanal"}</span>
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <p className="text-3xl font-bold text-primary">R$ {weeklyRevenue.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">{weeklyCount} atendimentos esta semana</p>
          </Card>

          <Card className="p-6 border-border bg-card hover:border-primary/50 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">{isBarber ? "Minha Receita Mensal" : "Receita Mensal"}</span>
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            <p className="text-3xl font-bold text-primary">R$ {monthlyRevenue.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {Number(growthPct) >= 0 ? "+" : ""}{growthPct}% vs mês passado
            </p>
          </Card>

          <Card className="p-6 border-border bg-card hover:border-primary/50 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">{isBarber ? "Meu Faturamento Total" : "Faturamento Total"}</span>
              <Wallet className="h-4 w-4 text-primary" />
            </div>
            <p className="text-3xl font-bold text-primary">R$ {totalRevenue.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">Desde o início · {totalAppointments} atendimentos</p>
          </Card>

          <Card className="p-6 border-border bg-card hover:border-primary/50 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Ticket Médio</span>
              <Award className="h-4 w-4 text-primary" />
            </div>
            <p className="text-3xl font-bold">R$ {allTimeAvgTicket.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">Média histórica por atendimento</p>
          </Card>
        </div>

        {/* ── Gráficos ──────────────────────────────────────────────────────── */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="p-6 border-border bg-card">
            <h3 className="font-bold text-lg mb-4">Receita Semanal</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="date" stroke="#888" />
                <YAxis stroke="#888" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                  formatter={(v: any) => [`R$ ${Number(v).toFixed(2)}`, "Receita"]}
                />
                <Bar dataKey="revenue" fill="#FFD700" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6 border-border bg-card">
            <h3 className="font-bold text-lg mb-4">Evolução dos Últimos 3 Meses</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="month" stroke="#888" />
                <YAxis stroke="#888" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                  formatter={(v: any) => [`R$ ${Number(v).toFixed(2)}`, "Receita"]}
                />
                <Line type="monotone" dataKey="revenue" stroke="#FFD700" strokeWidth={3} dot={{ fill: '#FFD700', r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* ── Link para Estatísticas avançadas ─────────────────────────────── */}
        {isOwner && (
          <Card
            className="p-6 border-border bg-card hover:border-primary/50 transition-all cursor-pointer group"
            onClick={() => navigate("/dashboard/statistics")}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg group-hover:text-primary transition-colors">
                  📊 Estatísticas Avançadas
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Serviços mais realizados, horários de pico, desempenho diário e comparativos
                </p>
              </div>
              <BarChart2 className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Finance;