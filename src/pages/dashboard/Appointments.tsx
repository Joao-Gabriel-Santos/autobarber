import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Calendar, Clock, User, Phone, MessageCircle, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSubscription } from "@/hooks/useSubscription";
import { usePermissions } from "@/hooks/usePermissions";
import EditAppointmentDialog from "@/components/EditAppointmentDialog";
import WalkInAppointment from "@/components/WalkInAppointment";

interface Appointment {
  id: string;
  barber_id: string;
  appointment_date: string;
  appointment_time: string;
  end_time?: string;
  client_name: string;
  client_whatsapp: string;
  status: string;
  price: number;
  services: {
    name: string;
  };
  services_data?: Array<{
    service_id: string;
    service_name: string;
    price: number;
    duration: number;
    quantity: number;
  }>;
}

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  completed: "bg-green-500/10 text-green-500 border-green-500/20",
  cancelled: "bg-red-500/10 text-red-500 border-red-500/20",
};

const TODAY = new Date().toISOString().split("T")[0];

// ── Grupos de data ────────────────────────────────────────────────────────────
function getDayGroup(dateString: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const date = new Date(dateString + "T00:00:00");
  if (date.getTime() === today.getTime()) return 0;
  if (date.getTime() === tomorrow.getTime()) return 1;
  return 2;
}

function sortAppointments(appointments: Appointment[]): Appointment[] {
  return [...appointments].sort((a, b) => {
    const groupDiff = getDayGroup(a.appointment_date) - getDayGroup(b.appointment_date);
    if (groupDiff !== 0) return groupDiff;
    const dateDiff = a.appointment_date.localeCompare(b.appointment_date);
    if (dateDiff !== 0) return dateDiff;
    return a.appointment_time.localeCompare(b.appointment_time);
  });
}

const DAY_GROUP_LABELS = ["Hoje", "Amanhã", "Próximos"];

// ── Componente ────────────────────────────────────────────────────────────────
const Appointments = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activeTab, setActiveTab] = useState("confirmed");
  const [barbershop, setBarbershop] = useState<any>(null);
  const { permissions, loading: permissionsLoading } = usePermissions();
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [startTime, setStartTime] = useState<string>("");
  const [newClient] = useState({ name: "", whatsapp: "", birthdate: "" });
  const [totalHoje, setTotalHoje] = useState(0);
  const [receitaHoje, setReceitaHoje] = useState(0);
  const [taxaConfirmacao, setTaxaConfirmacao] = useState(0);
  const { hasFeature } = useSubscription();
  const [ownerId, setOwnerId] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);

  const isOwner = !permissionsLoading && permissions?.role === 'owner';
  const isBarber = !permissionsLoading && permissions?.role === 'barber';

  // Auto-reload a cada 6 horas
  useEffect(() => {
    const timer = setTimeout(() => window.location.reload(), 6 * 60 * 60 * 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    checkUser();
    const now = new Date();
    setStartTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
  }, []);

  const loadDashboardStats = async (userId: string) => {
    let query = supabase
      .from("appointments")
      .select("status, appointment_date, price, barber_id")
      .eq("appointment_date", TODAY);

    if (isBarber) {
      query = query.eq("barber_id", userId);
    } else if (isOwner && permissions?.ownerId) {
      const { data: teamMembers } = await supabase
        .from("profiles")
        .select("id")
        .or(`id.eq.${userId},barbershop_id.eq.${userId}`);
      const barberIds = teamMembers?.map(m => m.id) || [userId];
      query = query.in("barber_id", barberIds);
    }

    const { data, error } = await query;
    if (error) { console.error(error); return null; }

    const total = data.length;
    const receita = data.filter(a => a.status === "completed").reduce((s, a) => s + (a.price || 0), 0);
    const taxa = total === 0 ? 0 : Math.round(
      (data.filter(a => a.status === "confirmed" || a.status === "completed").length / total) * 100
    );
    return { totalHoje: total, receitaHoje: receita, taxaConfirmacao: taxa };
  };

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }
      setUser(user);

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, barbershop_id")
        .eq("id", user.id)
        .maybeSingle();

      const resolvedOwnerId =
        profile?.role === 'barber' && profile?.barbershop_id
          ? profile.barbershop_id
          : user.id;
      setOwnerId(resolvedOwnerId);

      loadAppointments(user.id);
    } catch (error) {
      console.error("Error:", error);
      navigate("/login");
    } finally {
      setLoading(false);
    }
  };

  const refreshStats = async () => {
    if (!user) return;
    const stats = await loadDashboardStats(user.id);
    if (stats) {
      setTotalHoje(stats.totalHoje);
      setReceitaHoje(stats.receitaHoje);
      setTaxaConfirmacao(stats.taxaConfirmacao);
    }
  };

  const loadAppointments = async (userId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("appointments")
      .select(`*, services(name)`)
      .eq("barber_id", userId);

    if (error) {
      toast({ title: "Erro ao carregar agendamentos", description: error.message, variant: "destructive" });
      return;
    }

    const uniqueData = Array.from(new Map(data.map(item => [item.id, item])).values());
    setAppointments(uniqueData as unknown as Appointment[]);
    setLoading(false);
  };

  function parseDateAsLocal(dateString: string) {
    return new Date(dateString + 'T12:00:00');
  }

  const handleWhatsAppClick = (
    whatsappNumber: string, clientName: string,
    appointment_date: string, appointment_time: string
  ) => {
    const cleanNumber = whatsappNumber.replace(/\D/g, '');
    const barbershopName = barbershop?.barbershop_name || 'nossa barbearia';
    const [, month, day] = appointment_date.split('-');
    const message = encodeURIComponent(
      `Olá, *${clientName}* tudo bem?\nAqui é da barbearia ${barbershopName}.\nPassando só para confirmar seu agendamento para o dia ${day}/${month} às ${appointment_time.slice(0, 5)}.\nQualquer imprevisto é só avisar. Obrigado!`
    );
    window.open(`https://wa.me/${cleanNumber}?text=${message}`, '_blank');
  };

  const updateStatus = async (id: string, status: string) => {
    if (isUpdating) return;
    setIsUpdating(true);
    try {
      const updateData: any = { status };
      if (status === "completed") {
        const apt = appointments.find(a => a.id === id);
        if (!apt?.end_time) {
          const now = new Date();
          updateData.end_time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:00`;
        }
      }
      const { error } = await supabase.from("appointments").update(updateData).eq("id", id);
      if (error) throw error;
      toast({ title: "Status atualizado!", description: status === "completed" ? "Horário de encerramento registrado automaticamente" : undefined });
      if (user) loadAppointments(user.id);
    } catch (error: any) {
      toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleEdit = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setEditDialogOpen(true);
  };

  // ── Filtra por status. Para "confirmed" mostra só futuros/hoje.
  // Para "completed" e "cancelled" mostra apenas do dia de HOJE. ──────────────
  const getFilteredAppointments = (status: string) => {
    const filtered = appointments.filter(apt => apt.status === status);

    if (status === "completed" || status === "cancelled") {
      // Apenas agendamentos de hoje
      return sortAppointments(filtered.filter(apt => apt.appointment_date === TODAY));
    }

    // confirmed: hoje + futuros
    return sortAppointments(filtered);
  };

  const resolveServiceDisplay = (appointment: Appointment) => {
    const sd = appointment.services_data;
    const hasServicesData = sd && Array.isArray(sd) && sd.length > 0;
    const isMultiple = hasServicesData && (sd.length > 1 || sd[0].quantity > 1);

    if (isMultiple) return { title: `Múltiplos Serviços (${sd.reduce((s, i) => s + i.quantity, 0)})`, showDetail: true, items: sd };
    if (hasServicesData) return { title: sd[0].service_name, showDetail: false, items: sd };
    return { title: appointment.services?.name || "Serviço", showDetail: false, items: [] };
  };

  const renderAppointmentsWithGroups = (appointmentList: Appointment[]) => {
    const elements: React.ReactNode[] = [];
    let lastGroup = -1;
    appointmentList.forEach((appointment) => {
      const group = getDayGroup(appointment.appointment_date);
      if (group !== lastGroup) {
        lastGroup = group;
        elements.push(
          <div key={`group-${group}-${appointment.appointment_date}`} className="flex items-center gap-3 mt-4 mb-2 first:mt-0">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">{DAY_GROUP_LABELS[group]}</span>
            <div className="flex-1 h-px bg-border" />
          </div>
        );
      }
      elements.push(renderAppointmentCard(appointment));
    });
    return elements;
  };

  const renderAppointmentCard = (appointment: Appointment) => {
    const { title, showDetail, items } = resolveServiceDisplay(appointment);
    return (
      <Card key={appointment.id} className="p-6 border-border bg-card">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-bold text-lg">{title}</h3>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(appointment)}>
                <Edit className="h-4 w-4" />
              </Button>
            </div>
            {showDetail && (
              <div className="space-y-1 mb-2">
                {items.map((svc, idx) => (
                  <p key={idx} className="text-sm text-muted-foreground">
                    {svc.quantity > 1 ? `${svc.quantity}x ` : ""}{svc.service_name} — R$ {(svc.price * svc.quantity).toFixed(2)}
                  </p>
                ))}
              </div>
            )}
            <Badge className={STATUS_COLORS[appointment.status]}>{STATUS_LABELS[appointment.status]}</Badge>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary">R$ {appointment.price.toFixed(2)}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4" /><span>{appointment.client_name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <button
              onClick={() => handleWhatsAppClick(appointment.client_whatsapp, appointment.client_name, appointment.appointment_date, appointment.appointment_time)}
              className="text-[#25D366] hover:text-[#20BA5A] hover:underline font-medium transition-colors flex items-center gap-1 group"
            >
              <span>{appointment.client_whatsapp}</span>
              <MessageCircle className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>{format(parseDateAsLocal(appointment.appointment_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{appointment.appointment_time}{appointment.end_time && ` - ${appointment.end_time.slice(0, 5)}`}</span>
          </div>
        </div>

        {appointment.status === "confirmed" && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => updateStatus(appointment.id, "completed")} className="flex-1">Marcar como Concluído</Button>
            <Button size="sm" variant="destructive" onClick={() => updateStatus(appointment.id, "cancelled")}>Cancelar</Button>
          </div>
        )}
      </Card>
    );
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

  const confirmedList = getFilteredAppointments("confirmed");
  const completedList = getFilteredAppointments("completed");
  const cancelledList = getFilteredAppointments("cancelled");

  return (
    <div className="min-h-screen bg-gradient-dark">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">Meus Agendamentos</h1>
            {user && ownerId && hasFeature('walk_in') && (
              <WalkInAppointment barberId={user.id} ownerId={ownerId} onSuccess={refreshStats} />
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="confirmed">
              Confirmados
              {confirmedList.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-500">{confirmedList.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed">
              Concluídos
              {completedList.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-500">{completedList.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="cancelled">
              Cancelados
              {cancelledList.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-red-500/20 text-red-500">{cancelledList.length}</span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="confirmed" className="space-y-4">
            {confirmedList.length === 0 ? (
              <Card className="p-12 text-center border-border bg-card">
                <p className="text-muted-foreground">Nenhum agendamento confirmado.</p>
              </Card>
            ) : renderAppointmentsWithGroups(confirmedList)}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {completedList.length === 0 ? (
              <Card className="p-12 text-center border-border bg-card">
                <p className="text-muted-foreground">Nenhum atendimento concluído hoje.</p>
              </Card>
            ) : renderAppointmentsWithGroups(completedList)}
          </TabsContent>

          <TabsContent value="cancelled" className="space-y-4">
            {cancelledList.length === 0 ? (
              <Card className="p-12 text-center border-border bg-card">
                <p className="text-muted-foreground">Nenhum agendamento cancelado hoje.</p>
              </Card>
            ) : renderAppointmentsWithGroups(cancelledList)}
          </TabsContent>
        </Tabs>
      </main>

      {editingAppointment && (
        <EditAppointmentDialog
          appointment={editingAppointment}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSuccess={() => { if (user) loadAppointments(user.id); }}
        />
      )}
    </div>
  );
};

export default Appointments;