import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, TrendingUp, Scissors, BarChart2, Clock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
  ComposedChart, Area,
} from "recharts";
import { usePermissions } from "@/hooks/usePermissions";

interface ServiceStats { name: string; count: number; revenue: number; }
interface HourStats    { hour: string; count: number; }

const COLORS = ['#FFD700', '#FFA500', '#FF8C00', '#FF6B35', '#FF4500'];

const Statistics = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { permissions, loading: permissionsLoading } = usePermissions();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("services");

  // Dados
  const [topServices, setTopServices]         = useState<ServiceStats[]>([]);
  const [peakHours, setPeakHours]             = useState<HourStats[]>([]);
  const [monthlyDailyData, setMonthlyDailyData] = useState<any[]>([]);
  const [weeklyCount, setWeeklyCount]         = useState(0);
  const [monthlyCount, setMonthlyCount]       = useState(0);
  const [weeklyAvgTicket, setWeeklyAvgTicket] = useState(0);
  const [monthlyAvgTicket, setMonthlyAvgTicket] = useState(0);

  const isOwner  = !permissionsLoading && permissions?.role === 'owner';
  const isBarber = !permissionsLoading && permissions?.role === 'barber';

  useEffect(() => { checkUser(); }, []);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }
      setUser(user);
    } catch { navigate("/login"); } finally { setLoading(false); }
  };

  useEffect(() => {
    if (user && !permissionsLoading && permissions) loadData(user.id);
  }, [user, permissionsLoading, permissions]);

  const loadData = async (userId: string) => {
    try {
      if (!permissions) return;

      let query = supabase
        .from("appointments")
        .select(`id, appointment_date, appointment_time, price, status, barber_id, services(id, name, duration)`)
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

      const now        = new Date();
      const weekStart  = startOfWeek(now, { locale: ptBR });
      const weekEnd    = endOfWeek(now, { locale: ptBR });
      const monthStart = startOfMonth(now);
      const monthEnd   = endOfMonth(now);

      const inRange = (apt: any, s: Date, e: Date) => {
        const d = new Date(apt.appointment_date); return d >= s && d <= e;
      };

      const weekApts  = appointments?.filter(a => inRange(a, weekStart, weekEnd)) || [];
      const monthApts = appointments?.filter(a => inRange(a, monthStart, monthEnd)) || [];

      const weekRev  = weekApts.reduce((s, a) => s + a.price, 0);
      const monthRev = monthApts.reduce((s, a) => s + a.price, 0);

      setWeeklyCount(weekApts.length);
      setMonthlyCount(monthApts.length);
      setWeeklyAvgTicket(weekApts.length > 0 ? weekRev / weekApts.length : 0);
      setMonthlyAvgTicket(monthApts.length > 0 ? monthRev / monthApts.length : 0);

      // Top serviços
      const svcMap = new Map<string, ServiceStats>();
      appointments?.forEach(apt => {
        const name = (apt.services as any)?.name || "Sem nome";
        const cur  = svcMap.get(name) || { name, count: 0, revenue: 0 };
        svcMap.set(name, { name, count: cur.count + 1, revenue: cur.revenue + apt.price });
      });
      setTopServices([...svcMap.values()].sort((a, b) => b.count - a.count).slice(0, 5));

      // Horários de pico
      const hourMap = new Map<string, number>();
      appointments?.forEach(apt => {
        const h = apt.appointment_time.split(':')[0] + ':00';
        hourMap.set(h, (hourMap.get(h) || 0) + 1);
      });
      setPeakHours(
        [...hourMap.entries()]
          .map(([hour, count]) => ({ hour, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
      );

      // Desempenho diário do mês atual
      const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
      setMonthlyDailyData(monthDays.map(day => {
        const dayStr  = format(day, 'yyyy-MM-dd');
        const dayApts = monthApts.filter(a => a.appointment_date === dayStr);
        return {
          date:    format(day, 'dd/MM'),
          day:     format(day, 'd'),
          revenue: dayApts.reduce((s, a) => s + a.price, 0),
          count:   dayApts.length,
        };
      }));

    } catch (error: any) {
      toast({ title: "Erro ao carregar estatísticas", description: error.message, variant: "destructive" });
    }
  };

  // Tooltip customizado dual
  const DualTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: 8, padding: '10px 14px' }}>
        <p style={{ color: '#aaa', marginBottom: 4, fontSize: 12 }}>{label}</p>
        {payload.map((e: any, i: number) => (
          <p key={i} style={{ color: e.color, margin: '2px 0', fontSize: 13 }}>
            {e.name === 'revenue' ? `Receita: R$ ${Number(e.value).toFixed(2)}` : `Cortes: ${e.value}`}
          </p>
        ))}
      </div>
    );
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

  return (
    <div className="min-h-screen bg-gradient-dark">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/finance")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Estatísticas Avançadas</h1>
            <p className="text-sm text-muted-foreground">Serviços, horários e desempenho detalhado</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl space-y-8">

        {/* ── Tabs ──────────────────────────────────────────────────────────── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="services">Serviços</TabsTrigger>
            <TabsTrigger value="daily">Desempenho Diário</TabsTrigger>
            <TabsTrigger value="schedule">Horários de Pico</TabsTrigger>
          </TabsList>

          {/* ── ABA SERVIÇOS ─────────────────────────────────────────────── */}
          <TabsContent value="services" className="space-y-6">

            {/* KPIs de cortes */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-5 border-border bg-card hover:border-primary/50 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Cortes na Semana</span>
                  <Scissors className="h-4 w-4 text-primary" />
                </div>
                <p className="text-3xl font-bold text-primary">{weeklyCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Esta semana</p>
              </Card>

              <Card className="p-5 border-border bg-card hover:border-primary/50 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Média / Dia (Semana)</span>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </div>
                <p className="text-3xl font-bold text-green-400">{(weeklyCount / 7).toFixed(1)}</p>
                <p className="text-xs text-muted-foreground mt-1">Ticket médio: R$ {weeklyAvgTicket.toFixed(2)}</p>
              </Card>

              <Card className="p-5 border-border bg-card hover:border-primary/50 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Cortes no Mês</span>
                  <BarChart2 className="h-4 w-4 text-blue-400" />
                </div>
                <p className="text-3xl font-bold text-blue-400">{monthlyCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Este mês</p>
              </Card>

              <Card className="p-5 border-border bg-card hover:border-primary/50 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Média / Dia (Mês)</span>
                  <TrendingUp className="h-4 w-4 text-orange-400" />
                </div>
                <p className="text-3xl font-bold text-orange-400">
                  {monthlyDailyData.length > 0
                    ? (monthlyCount / (monthlyDailyData.filter(d => d.count > 0).length || 1)).toFixed(1)
                    : "0.0"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Ticket médio: R$ {monthlyAvgTicket.toFixed(2)}</p>
              </Card>
            </div>

            {/* Top serviços + pizza */}
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="p-6 border-border bg-card">
                <h3 className="font-bold text-lg mb-4">Top 5 Serviços</h3>
                <div className="space-y-4">
                  {topServices.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhum dado disponível ainda.</p>
                  )}
                  {topServices.map((svc, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center font-bold text-primary">
                          {i + 1}
                        </div>
                        <div>
                          <p className="font-semibold">{svc.name}</p>
                          <p className="text-xs text-muted-foreground">{svc.count} atendimentos</p>
                        </div>
                      </div>
                      <p className="font-bold text-primary">R$ {svc.revenue.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-6 border-border bg-card">
                <h3 className="font-bold text-lg mb-4">Distribuição de Serviços</h3>
                {topServices.length === 0 ? (
                  <div className="flex items-center justify-center h-[300px]">
                    <p className="text-sm text-muted-foreground">Nenhum dado disponível ainda.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={topServices} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={100}
                        label={(e) => `${e.name}: ${e.count}`}>
                        {topServices.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </div>
          </TabsContent>

          {/* ── ABA DESEMPENHO DIÁRIO ─────────────────────────────────────── */}
          <TabsContent value="daily" className="space-y-6">
            <Card className="p-6 border-border bg-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">Desempenho Diário do Mês</h3>
                <span className="text-xs text-muted-foreground capitalize">
                  {format(new Date(), "MMMM yyyy", { locale: ptBR })}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={360}>
                <ComposedChart data={monthlyDailyData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                  <XAxis dataKey="day" stroke="#666" tick={{ fontSize: 11 }} interval={1} />
                  <YAxis yAxisId="revenue" orientation="left" stroke="#FFD700"
                    tick={{ fontSize: 11, fill: '#FFD700' }} tickFormatter={v => `R$${v}`} />
                  <YAxis yAxisId="count" orientation="right" stroke="#60a5fa"
                    tick={{ fontSize: 11, fill: '#60a5fa' }} allowDecimals={false} />
                  <Tooltip content={<DualTooltip />} />
                  <Bar yAxisId="revenue" dataKey="revenue" name="revenue"
                    fill="#FFD700" fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Line yAxisId="count" type="monotone" dataKey="count" name="count"
                    stroke="#60a5fa" strokeWidth={2.5} dot={{ fill: '#60a5fa', r: 3 }} activeDot={{ r: 5 }} />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-6 justify-center mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-sm bg-primary" />Receita (R$)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-[3px] bg-blue-400 rounded" />Qtd. de Cortes
                </span>
              </div>
            </Card>

            {/* Mini-resumo do mês */}
            <div className="grid sm:grid-cols-3 gap-4">
              <Card className="p-5 border-border bg-card">
                <p className="text-xs text-muted-foreground mb-1">Melhor dia (receita)</p>
                <p className="text-xl font-bold text-primary">
                  {monthlyDailyData.length > 0
                    ? `R$ ${Math.max(...monthlyDailyData.map(d => d.revenue)).toFixed(2)}`
                    : "—"}
                </p>
              </Card>
              <Card className="p-5 border-border bg-card">
                <p className="text-xs text-muted-foreground mb-1">Melhor dia (cortes)</p>
                <p className="text-xl font-bold text-blue-400">
                  {monthlyDailyData.length > 0
                    ? `${Math.max(...monthlyDailyData.map(d => d.count))} cortes`
                    : "—"}
                </p>
              </Card>
              <Card className="p-5 border-border bg-card">
                <p className="text-xs text-muted-foreground mb-1">Dias trabalhados</p>
                <p className="text-xl font-bold">
                  {monthlyDailyData.filter(d => d.count > 0).length} dias
                </p>
              </Card>
            </div>
          </TabsContent>

          
          <TabsContent value="schedule" className="space-y-6">
            <Card className="p-6 border-border bg-card">
              <h3 className="font-bold text-lg mb-4">Horários de Pico</h3>
              {peakHours.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum dado disponível ainda.</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={peakHours} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis type="number" stroke="#888" />
                      <YAxis dataKey="hour" type="category" stroke="#888" />
                      <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
                      <Bar dataKey="count" fill="#FFD700" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="text-sm text-muted-foreground mt-4 text-center">
                    💡 Use esses dados para otimizar sua disponibilidade e preços
                  </p>
                </>
              )}
            </Card>

            {/* Top 3 horários mais movimentados */}
            {peakHours.length > 0 && (
              <div className="grid sm:grid-cols-3 gap-4">
                {peakHours.slice(0, 3).map((h, i) => (
                  <Card key={i} className="p-5 border-border bg-card text-center">
                    <Clock className="h-6 w-6 text-primary mx-auto mb-2" />
                    <p className="text-2xl font-bold text-primary">{h.hour}</p>
                    <p className="text-xs text-muted-foreground mt-1">{h.count} atendimentos</p>
                    <p className="text-xs font-semibold mt-1">
                      {i === 0 ? "🥇 Mais movimentado" : i === 1 ? "🥈 2° mais movimentado" : "🥉 3° mais movimentado"}
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Statistics;