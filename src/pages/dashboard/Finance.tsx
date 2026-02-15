import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, TrendingUp, DollarSign, Clock, Award, Calendar, Users, Trophy, Zap, Wallet, Scissors, BarChart2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, subMonths, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, ComposedChart, Area } from "recharts";
import { usePermissions } from "@/hooks/usePermissions";

interface Appointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  price: number;
  status: string;
  barber_id: string;
  services: {
    id: string;
    name: string;
    duration: number;
  };
}

interface ServiceStats {
  name: string;
  count: number;
  revenue: number;
}

interface HourStats {
  hour: string;
  count: number;
}

interface BarberPerformance {
  id: string;
  name: string;
  total_appointments: number;
  total_revenue: number;
  avg_ticket: number;
  completion_rate: number;
  total_hours_worked: number;
  efficiency_score: number;
}

const COLORS = ['#FFD700', '#FFA500', '#FF8C00', '#FF6B35', '#FF4500'];

const Finance = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { permissions, loading: permissionsLoading } = usePermissions();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  // Métricas
  const [weeklyRevenue, setWeeklyRevenue] = useState(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalAppointments, setTotalAppointments] = useState(0);
  const [allTimeAvgTicket, setAllTimeAvgTicket] = useState(0);
  const [topServices, setTopServices] = useState<ServiceStats[]>([]);
  const [peakHours, setPeakHours] = useState<HourStats[]>([]);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [monthlyDailyData, setMonthlyDailyData] = useState<any[]>([]); // ← NOVO: dados diários do mês
  const [lastMonthRevenue, setLastMonthRevenue] = useState(0);
  const [barberPerformances, setBarberPerformances] = useState<BarberPerformance[]>([]);

  // ← NOVO: métricas de cortes na semana e mês
  const [weeklyCount, setWeeklyCount] = useState(0);
  const [monthlyCount, setMonthlyCount] = useState(0);
  const [weeklyAvgTicket, setWeeklyAvgTicket] = useState(0);
  const [monthlyAvgTicket, setMonthlyAvgTicket] = useState(0);

  const isOwner = !permissionsLoading && permissions?.role === 'owner';
  const isBarber = !permissionsLoading && permissions?.role === 'barber';

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }
      setUser(user);
    } catch (error) {
      console.error("Error:", error);
      navigate("/login");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && !permissionsLoading && permissions) {
      loadFinancialData(user.id);
      if (isOwner) {
        loadBarberPerformances(user.id);
      }
    }
  }, [user, permissionsLoading, permissions]);

  const loadBarberPerformances = async (ownerId: string) => {
    try {
      const { data: teamMembers } = await supabase
        .from("profiles")
        .select("id, full_name")
        .or(`id.eq.${ownerId},barbershop_id.eq.${ownerId}`);

      if (!teamMembers) return;

      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);

      const performances: BarberPerformance[] = [];

      for (const barber of teamMembers) {
        const { data: appointments } = await supabase
          .from("appointments")
          .select(`
            id,
            appointment_date,
            appointment_time,
            price,
            status,
            services (
              duration
            )
          `)
          .eq("barber_id", barber.id)
          .gte("appointment_date", format(monthStart, "yyyy-MM-dd"))
          .lte("appointment_date", format(monthEnd, "yyyy-MM-dd"));

        const completed = appointments?.filter(a => a.status === "completed") || [];
        const totalAppointments = appointments?.length || 0;
        const totalRevenue = completed.reduce((sum, a) => sum + a.price, 0);
        const avgTicket = completed.length > 0 ? totalRevenue / completed.length : 0;
        const completionRate = totalAppointments > 0
          ? (completed.length / totalAppointments) * 100
          : 0;

        const totalMinutes = completed.reduce((sum, a) => {
          return sum + (a.services?.duration || 30);
        }, 0);
        const totalHours = totalMinutes / 60;

        const revenuePerHour = totalHours > 0 ? totalRevenue / totalHours : 0;
        const efficiencyScore = (revenuePerHour * 0.7) + (completionRate * 0.3);

        performances.push({
          id: barber.id,
          name: barber.full_name || "Sem nome",
          total_appointments: completed.length,
          total_revenue: totalRevenue,
          avg_ticket: avgTicket,
          completion_rate: completionRate,
          total_hours_worked: totalHours,
          efficiency_score: efficiencyScore,
        });
      }

      performances.sort((a, b) => b.total_revenue - a.total_revenue);
      setBarberPerformances(performances);

    } catch (error: any) {
      console.error("Erro ao carregar desempenho dos barbeiros:", error);
    }
  };

  const loadFinancialData = async (userId: string) => {
    try {
      if (!permissions) return;

      let query = supabase
        .from("appointments")
        .select(`
          id,
          appointment_date,
          appointment_time,
          price,
          status,
          barber_id,
          services (
            id,
            name,
            duration
          )
        `)
        .eq("status", "completed");

      if (permissions.role === 'barber') {
        query = query.eq("barber_id", userId);
      } else if (permissions.role === 'owner') {
        const { data: teamMembers } = await supabase
          .from("profiles")
          .select("id")
          .or(`id.eq.${userId},barbershop_id.eq.${userId}`);

        const barberIds = teamMembers?.map(m => m.id) || [userId];
        query = query.in("barber_id", barberIds);
      }

      const { data: appointments, error } = await query;

      if (error) throw error;

      const now = new Date();
      const weekStart = startOfWeek(now, { locale: ptBR });
      const weekEnd = endOfWeek(now, { locale: ptBR });
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      const lastMonthStart = startOfMonth(subMonths(now, 1));
      const lastMonthEnd = endOfMonth(subMonths(now, 1));

      const weekAppointments = appointments?.filter(apt => {
        const date = new Date(apt.appointment_date);
        return date >= weekStart && date <= weekEnd;
      }) || [];

      const monthAppointments = appointments?.filter(apt => {
        const date = new Date(apt.appointment_date);
        return date >= monthStart && date <= monthEnd;
      }) || [];

      const lastMonthAppointments = appointments?.filter(apt => {
        const date = new Date(apt.appointment_date);
        return date >= lastMonthStart && date <= lastMonthEnd;
      }) || [];

      const weekRev = weekAppointments.reduce((sum, apt) => sum + apt.price, 0);
      const monthRev = monthAppointments.reduce((sum, apt) => sum + apt.price, 0);
      const lastMonthRev = lastMonthAppointments.reduce((sum, apt) => sum + apt.price, 0);

      // Receita total histórica e ticket médio geral
      const allRev = (appointments || []).reduce((sum, apt) => sum + apt.price, 0);
      const allCount = appointments?.length || 0;

      setWeeklyRevenue(weekRev);
      setMonthlyRevenue(monthRev);
      setLastMonthRevenue(lastMonthRev);
      setTotalRevenue(allRev);
      setTotalAppointments(allCount);
      setAllTimeAvgTicket(allCount > 0 ? allRev / allCount : 0);

      // ← NOVO: contagem e ticket médio semanal/mensal
      setWeeklyCount(weekAppointments.length);
      setMonthlyCount(monthAppointments.length);
      setWeeklyAvgTicket(weekAppointments.length > 0 ? weekRev / weekAppointments.length : 0);
      setMonthlyAvgTicket(monthAppointments.length > 0 ? monthRev / monthAppointments.length : 0);

      // Estatísticas de serviços
      const serviceMap = new Map<string, ServiceStats>();
      appointments?.forEach(apt => {
        const serviceName = apt.services?.name || "Sem nome";
        if (serviceMap.has(serviceName)) {
          const current = serviceMap.get(serviceName)!;
          serviceMap.set(serviceName, {
            name: serviceName,
            count: current.count + 1,
            revenue: current.revenue + apt.price,
          });
        } else {
          serviceMap.set(serviceName, {
            name: serviceName,
            count: 1,
            revenue: apt.price,
          });
        }
      });

      const topSvcs = Array.from(serviceMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      setTopServices(topSvcs);

      // Horários de pico
      const hourMap = new Map<string, number>();
      appointments?.forEach(apt => {
        const hour = apt.appointment_time.split(':')[0] + ':00';
        hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
      });

      const peakHrs = Array.from(hourMap.entries())
        .map(([hour, count]) => ({ hour, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      setPeakHours(peakHrs);

      // Dados semanais
      const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
      const weekChart = weekDays.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayAppointments = weekAppointments.filter(apt => apt.appointment_date === dayStr);
        const revenue = dayAppointments.reduce((sum, apt) => sum + apt.price, 0);
        return {
          date: format(day, 'EEE', { locale: ptBR }),
          revenue,
          count: dayAppointments.length,
        };
      });
      setWeeklyData(weekChart);

      // Dados mensais (3 meses)
      const monthsData = [];
      for (let i = 2; i >= 0; i--) {
        const monthDate = subMonths(now, i);
        const mStart = startOfMonth(monthDate);
        const mEnd = endOfMonth(monthDate);

        const mAppointments = appointments?.filter(apt => {
          const date = new Date(apt.appointment_date);
          return date >= mStart && date <= mEnd;
        }) || [];

        const revenue = mAppointments.reduce((sum, apt) => sum + apt.price, 0);

        monthsData.push({
          month: format(monthDate, 'MMM', { locale: ptBR }),
          revenue,
          count: mAppointments.length,
        });
      }
      setMonthlyData(monthsData);

      // ← NOVO: dados diários do mês atual
      const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
      const dailyChart = monthDays.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayAppointments = monthAppointments.filter(apt => apt.appointment_date === dayStr);
        const revenue = dayAppointments.reduce((sum, apt) => sum + apt.price, 0);
        return {
          date: format(day, 'dd/MM'),
          day: format(day, 'd'),
          revenue,
          count: dayAppointments.length,
        };
      });
      setMonthlyDailyData(dailyChart);

    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
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

  const growthPercentage = lastMonthRevenue > 0
    ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(1)
    : "0";

  // Tooltip customizado para gráfico duplo (receita + cortes)
  const CustomDualTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: 8, padding: '10px 14px' }}>
          <p style={{ color: '#aaa', marginBottom: 4, fontSize: 12 }}>{label}</p>
          {payload.map((entry: any, i: number) => (
            <p key={i} style={{ color: entry.color, margin: '2px 0', fontSize: 13 }}>
              {entry.name === 'revenue'
                ? `Receita: R$ ${Number(entry.value).toFixed(2)}`
                : `Cortes: ${entry.value}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-dark">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">
                {isBarber ? "Meu Painel Financeiro" : "Painel Financeiro"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isBarber
                  ? "Análise dos seus ganhos e desempenho"
                  : "Análise completa do desempenho da barbearia"
                }
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Métricas Principais */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">

          {/* Receita Semanal */}
          <Card className="p-6 border-border bg-card hover:border-primary/50 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">
                {isBarber ? "Minha Receita Semanal" : "Receita Semanal"}
              </span>
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <p className="text-3xl font-bold text-primary">
              R$ {weeklyRevenue.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Últimos 7 dias
            </p>
          </Card>

          {/* Receita Mensal */}
          <Card className="p-6 border-border bg-card hover:border-primary/50 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">
                {isBarber ? "Minha Receita Mensal" : "Receita Mensal"}
              </span>
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            <p className="text-3xl font-bold text-primary">
              R$ {monthlyRevenue.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {Number(growthPercentage) >= 0 ? "+" : ""}{growthPercentage}% vs mês passado
            </p>
          </Card>

          {/* Receita Total Histórica */}
          <Card className="p-6 border-border bg-card hover:border-primary/50 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">
                {isBarber ? "Meu Faturamento Total" : "Faturamento Total"}
              </span>
              <Wallet className="h-4 w-4 text-primary" />
            </div>
            <p className="text-3xl font-bold text-primary">
              R$ {totalRevenue.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Desde o início • {totalAppointments} atendimentos
            </p>
          </Card>

          {/* Ticket Médio Geral */}
          <Card className="p-6 border-border bg-card hover:border-primary/50 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Ticket Médio</span>
              <Award className="h-4 w-4 text-primary" />
            </div>
            <p className="text-3xl font-bold">
              R$ {allTimeAvgTicket.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Média histórica por atendimento
            </p>
          </Card>

        </div>

        {/* Tabs com Gráficos */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className={`grid w-full ${isOwner ? 'grid-cols-4' : 'grid-cols-3'}`}>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="services">Serviços</TabsTrigger>
            <TabsTrigger value="schedule">Horários</TabsTrigger>
            {isOwner && (
              <TabsTrigger value="team">
                Colaboradores
              </TabsTrigger>
            )}
          </TabsList>

          {/* ── Visão Geral ───────────────────────────────────────────────── */}
          <TabsContent value="overview" className="space-y-6">
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
                      formatter={(value: any) => `R$ ${value.toFixed(2)}`}
                    />
                    <Bar dataKey="revenue" fill="#FFD700" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card className="p-6 border-border bg-card">
                <h3 className="font-bold text-lg mb-4">Evolução Mensal</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="month" stroke="#888" />
                    <YAxis stroke="#888" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                      formatter={(value: any) => `R$ ${value.toFixed(2)}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#FFD700"
                      strokeWidth={3}
                      dot={{ fill: '#FFD700', r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </TabsContent>

          {/* ── Serviços ──────────────────────────────────────────────────── */}
          <TabsContent value="services" className="space-y-6">

            {/* ← NOVO: Cards de métricas de cortes */}
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
                <p className="text-3xl font-bold text-green-400">
                  {(weeklyCount / 7).toFixed(1)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Ticket médio: R$ {weeklyAvgTicket.toFixed(2)}
                </p>
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
                    ? (monthlyCount / monthlyDailyData.filter(d => d.count > 0).length || monthlyDailyData.length).toFixed(1)
                    : "0.0"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Ticket médio: R$ {monthlyAvgTicket.toFixed(2)}
                </p>
              </Card>
            </div>

            {/* ← NOVO: Gráfico mensal detalhado (cortes + receita por dia) */}
            <Card className="p-6 border-border bg-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">Desempenho Diário do Mês</h3>
                <span className="text-xs text-muted-foreground capitalize">
                  {format(new Date(), "MMMM yyyy", { locale: ptBR })}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={340}>
                <ComposedChart data={monthlyDailyData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                  <XAxis
                    dataKey="day"
                    stroke="#666"
                    tick={{ fontSize: 11 }}
                    interval={1}
                  />
                  <YAxis
                    yAxisId="revenue"
                    orientation="left"
                    stroke="#FFD700"
                    tick={{ fontSize: 11, fill: '#FFD700' }}
                    tickFormatter={(v) => `R$${v}`}
                  />
                  <YAxis
                    yAxisId="count"
                    orientation="right"
                    stroke="#60a5fa"
                    tick={{ fontSize: 11, fill: '#60a5fa' }}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomDualTooltip />} />
                  <Bar
                    yAxisId="revenue"
                    dataKey="revenue"
                    name="revenue"
                    fill="#FFD700"
                    fillOpacity={0.85}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                  <Line
                    yAxisId="count"
                    type="monotone"
                    dataKey="count"
                    name="count"
                    stroke="#60a5fa"
                    strokeWidth={2.5}
                    dot={{ fill: '#60a5fa', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-6 justify-center mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-sm bg-primary" />
                  Receita (R$)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-[3px] bg-blue-400 rounded" />
                  Qtd. de Cortes
                </span>
              </div>
            </Card>

            {/* Cards existentes: Top 5 + Distribuição */}
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="p-6 border-border bg-card">
                <h3 className="font-bold text-lg mb-4">Top 5 Serviços</h3>
                <div className="space-y-4">
                  {topServices.map((service, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center font-bold text-primary">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-semibold">{service.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {service.count} atendimentos
                          </p>
                        </div>
                      </div>
                      <p className="font-bold text-primary">
                        R$ {service.revenue.toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-6 border-border bg-card">
                <h3 className="font-bold text-lg mb-4">Distribuição de Serviços</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={topServices}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(entry) => `${entry.name}: ${entry.count}`}
                    >
                      {topServices.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </TabsContent>

          {/* ── Horários ──────────────────────────────────────────────────── */}
          <TabsContent value="schedule" className="space-y-6">
            <Card className="p-6 border-border bg-card">
              <h3 className="font-bold text-lg mb-4">Horários de Pico</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={peakHours} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis type="number" stroke="#888" />
                  <YAxis dataKey="hour" type="category" stroke="#888" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                  />
                  <Bar dataKey="count" fill="#FFD700" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <p className="text-sm text-muted-foreground mt-4 text-center">
                💡 Use esses dados para otimizar sua disponibilidade e preços
              </p>
            </Card>
          </TabsContent>

          {/* ── Colaboradores (owner only) ─────────────────────────────────── */}
          {isOwner && (
            <TabsContent value="team" className="space-y-6">
              <div className="grid gap-4">
                {barberPerformances.map((barber, index) => (
                  <Card key={barber.id} className="p-6 border-border bg-card hover:border-primary/50 transition-all">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-gradient-gold flex items-center justify-center font-bold text-lg">
                          {index + 1}
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">{barber.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            Desempenho do mês atual
                          </p>
                        </div>
                      </div>
                      {index === 0 && (
                        <Trophy className="h-8 w-8 text-primary" />
                      )}
                    </div>

                    <div className="grid md:grid-cols-5 gap-4">
                      <div>
                        <div className="flex items-center gap-1 mb-1">
                          <DollarSign className="h-4 w-4 text-primary" />
                          <p className="text-xs text-muted-foreground">Receita Total</p>
                        </div>
                        <p className="text-xl font-bold text-primary">
                          R$ {barber.total_revenue.toFixed(2)}
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center gap-1 mb-1">
                          <TrendingUp className="h-4 w-4 text-green-500" />
                          <p className="text-xs text-muted-foreground">Atendimentos</p>
                        </div>
                        <p className="text-xl font-bold">
                          {barber.total_appointments}
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center gap-1 mb-1">
                          <Award className="h-4 w-4 text-blue-500" />
                          <p className="text-xs text-muted-foreground">Ticket Médio</p>
                        </div>
                        <p className="text-xl font-bold">
                          R$ {barber.avg_ticket.toFixed(2)}
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center gap-1 mb-1">
                          <Clock className="h-4 w-4 text-orange-500" />
                          <p className="text-xs text-muted-foreground">Horas Trabalhadas</p>
                        </div>
                        <p className="text-xl font-bold">
                          {barber.total_hours_worked.toFixed(1)}h
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center gap-1 mb-1">
                          <Zap className="h-4 w-4 text-yellow-500" />
                          <p className="text-xs text-muted-foreground">Score Eficiência</p>
                        </div>
                        <p className="text-xl font-bold">
                          {barber.efficiency_score.toFixed(0)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Taxa de Conclusão</span>
                        <span className="font-semibold">{barber.completion_rate.toFixed(1)}%</span>
                      </div>
                      <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-gold transition-all"
                          style={{ width: `${barber.completion_rate}%` }}
                        />
                      </div>
                    </div>
                  </Card>
                ))}

                {barberPerformances.length === 0 && (
                  <Card className="p-12 text-center border-border bg-card">
                    <p className="text-muted-foreground">
                      Nenhum dado de desempenho disponível ainda.
                    </p>
                  </Card>
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
};

export default Finance;