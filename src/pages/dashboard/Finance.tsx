import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, TrendingUp, DollarSign, Clock, Award, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface Appointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  price: number;
  status: string;
  services: {
    id: string;
    name: string;
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

const COLORS = ['#FFD700', '#FFA500', '#FF8C00', '#FF6B35', '#FF4500'];

const Financie = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  
  // Métricas
  const [weeklyRevenue, setWeeklyRevenue] = useState(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [totalAppointments, setTotalAppointments] = useState(0);
  const [topServices, setTopServices] = useState<ServiceStats[]>([]);
  const [peakHours, setPeakHours] = useState<HourStats[]>([]);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [lastMonthRevenue, setLastMonthRevenue] = useState(0);

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
      await loadFinancialData(user.id);
    } catch (error) {
      console.error("Error:", error);
      navigate("/login");
    } finally {
      setLoading(false);
    }
  };

  const loadFinancialData = async (userId: string) => {
    try {
      // Buscar todos os agendamentos concluídos
      const { data: appointments, error } = await supabase
        .from("appointments")
        .select(`
          id,
          appointment_date,
          appointment_time,
          price,
          status,
          services (
            id,
            name
          )
        `)
        .eq("barber_id", userId)
        .eq("status", "completed");

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

      setWeeklyRevenue(weekRev);
      setMonthlyRevenue(monthRev);
      setLastMonthRevenue(lastMonthRev);
      setTotalAppointments(appointments?.length || 0);

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

    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
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

  return (
    <div className="min-h-screen bg-gradient-dark">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Painel Financeiro</h1>
              <p className="text-sm text-muted-foreground">
                Análise completa do desempenho da barbearia
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Métricas Principais */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="p-6 border-border bg-card hover:border-primary/50 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Receita Semanal</span>
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <p className="text-3xl font-bold text-primary">
              R$ {weeklyRevenue.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Últimos 7 dias
            </p>
          </Card>

          <Card className="p-6 border-border bg-card hover:border-primary/50 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Receita Mensal</span>
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            <p className="text-3xl font-bold text-primary">
              R$ {monthlyRevenue.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {Number(growthPercentage) >= 0 ? "+" : ""}{growthPercentage}% vs mês passado
            </p>
          </Card>

          <Card className="p-6 border-border bg-card hover:border-primary/50 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Total Atendimentos</span>
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <p className="text-3xl font-bold">{totalAppointments}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Todos os concluídos
            </p>
          </Card>

          <Card className="p-6 border-border bg-card hover:border-primary/50 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Ticket Médio</span>
              <Award className="h-4 w-4 text-primary" />
            </div>
            <p className="text-3xl font-bold">
              R$ {totalAppointments > 0 ? ((weeklyRevenue + monthlyRevenue) / totalAppointments).toFixed(2) : "0.00"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Por atendimento
            </p>
          </Card>
        </div>

        {/* Tabs com Gráficos */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="services">Serviços</TabsTrigger>
            <TabsTrigger value="schedule">Horários</TabsTrigger>
          </TabsList>

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

          <TabsContent value="services" className="space-y-6">
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
        </Tabs>
      </main>
    </div>
  );
};

export default Financie;