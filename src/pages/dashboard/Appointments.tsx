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
import EditAppointmentDialog from "@/components/EditAppointmentDialog";

interface Appointment {
  id: string;
  barber_id: string;
  appointment_date: string;
  appointment_time: string;
  end_time?: string;
  client_name: string;
  client_whatsapp: string;
  client_email?: string;
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

const Appointments = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activeTab, setActiveTab] = useState("confirmed");
  const [barbershop, setBarbershop] = useState<any>(null);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

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
      loadAppointments(user.id);
    } catch (error) {
      console.error("Error:", error);
      navigate("/login");
    } finally {
      setLoading(false);
    }
  };

  const loadAppointments = async (userId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("appointments")
      .select(`
        *,
        services(name)
      `)
      .eq("barber_id", userId);

    if (error) {
      toast({
        title: "Erro ao carregar agendamentos",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    const uniqueData = Array.from(new Map(data.map(item => [item.id, item])).values());
  
    setAppointments(uniqueData);
    setLoading(false);
  };

  function parseDateAsLocal(dateString: string) {
    return new Date(dateString + 'T12:00:00');
  }

  const handleWhatsAppClick = (whatsappNumber: string, clientName: string, appointment_date: string, appointment_time: string) => {
    const cleanNumber = whatsappNumber.replace(/\D/g, '');
    const barbershopName = barbershop?.barbershop_name || 'nossa barbearia';
    
    const [year, month, day] = appointment_date.split('-');
    const dateFormatted = `${day}/${month}`;
    const timeFormatted = appointment_time.slice(0, 5);

    const message = encodeURIComponent(`Olá, *${clientName}* tudo bem?
Aqui é da barbearia ${barbershopName}.
Passando só para confirmar seu agendamento para o dia ${dateFormatted} às ${timeFormatted}.
Qualquer imprevisto é só avisar. Obrigado!`);
    
    const whatsappUrl = `https://wa.me/${cleanNumber}?text=${message}`;
    window.open(whatsappUrl, '_blank');
  };

  const [isUpdating, setIsUpdating] = useState(false);

  const updateStatus = async (id: string, status: string) => {
    if (isUpdating) return;
    setIsUpdating(true);

    try {
      const updateData: any = { status };
      
      // Se está marcando como concluído e não tem end_time, captura o horário atual
      if (status === "completed") {
        const appointment = appointments.find(apt => apt.id === id);
        if (!appointment?.end_time) {
          const now = new Date();
          const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:00`;
          updateData.end_time = currentTime;
        }
      }

      const { error } = await supabase
        .from("appointments")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Status atualizado!",
        description: status === "completed" ? "Horário de encerramento registrado automaticamente" : undefined,
      });

      if (user) loadAppointments(user.id);
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleEdit = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setEditDialogOpen(true);
  };

  const getFilteredAppointments = (status: string) => {
    return appointments.filter(apt => apt.status === status);
  };

  const renderAppointmentCard = (appointment: Appointment) => {
    const hasMultipleServices = appointment.services_data && Array.isArray(appointment.services_data) && appointment.services_data.length > 0;
    
    return (
      <Card key={appointment.id} className="p-6 border-border bg-card">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {hasMultipleServices ? (
                <h3 className="font-bold text-lg">
                  Múltiplos Serviços ({appointment.services_data.length})
                </h3>
              ) : (
                <h3 className="font-bold text-lg">
                  {appointment.services?.name || "Serviço"}
                </h3>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleEdit(appointment)}
              >
                <Edit className="h-4 w-4" />
              </Button>
            </div>
            {hasMultipleServices && (
              <div className="space-y-1 mb-2">
                {appointment.services_data.map((svc: any, idx: number) => (
                  <p key={idx} className="text-sm text-muted-foreground">
                    {svc.quantity > 1 ? `${svc.quantity}x ` : ''}
                    {svc.service_name} - R$ {(svc.price * svc.quantity).toFixed(2)}
                  </p>
                ))}
              </div>
            )}
            <Badge className={STATUS_COLORS[appointment.status]}>
              {STATUS_LABELS[appointment.status]}
            </Badge>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary">
              R$ {appointment.price.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4" />
            <span>{appointment.client_name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <button
              onClick={() => handleWhatsAppClick(
                appointment.client_whatsapp, 
                appointment.client_name, 
                appointment.appointment_date, 
                appointment.appointment_time
              )}
              className="text-[#25D366] hover:text-[#20BA5A] hover:underline font-medium transition-colors flex items-center gap-1 group"
            >
              <span>{appointment.client_whatsapp}</span>
              <MessageCircle className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              {format(parseDateAsLocal(appointment.appointment_date), "dd 'de' MMMM 'de' yyyy", {
                locale: ptBR,
              })}
            </span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              {appointment.appointment_time}
              {appointment.end_time && ` - ${appointment.end_time.slice(0, 5)}`}
            </span>
          </div>
        </div>

        {appointment.status === "confirmed" && (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => updateStatus(appointment.id, "completed")}
              className="flex-1"
            >
              Marcar como Concluído
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => updateStatus(appointment.id, "cancelled")}
            >
              Cancelar
            </Button>
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

  const confirmedCount = getFilteredAppointments("confirmed").length;
  const completedCount = getFilteredAppointments("completed").length;
  const cancelledCount = getFilteredAppointments("cancelled").length;

  return (
    <div className="min-h-screen bg-gradient-dark">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">Meus Agendamentos</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="confirmed" className="relative">
              Confirmados
              {confirmedCount > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-500">
                  {confirmedCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed" className="relative">
              Concluídos
              {completedCount > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-500">
                  {completedCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="cancelled" className="relative">
              Cancelados
              {cancelledCount > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-red-500/20 text-red-500">
                  {cancelledCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="confirmed" className="space-y-4">
            {getFilteredAppointments("confirmed").length === 0 ? (
              <Card className="p-12 text-center border-border bg-card">
                <p className="text-muted-foreground">
                  Nenhum agendamento confirmado.
                </p>
              </Card>
            ) : (
              getFilteredAppointments("confirmed").map(renderAppointmentCard)
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {getFilteredAppointments("completed").length === 0 ? (
              <Card className="p-12 text-center border-border bg-card">
                <p className="text-muted-foreground">
                  Nenhum agendamento concluído.
                </p>
              </Card>
            ) : (
              getFilteredAppointments("completed").map(renderAppointmentCard)
            )}
          </TabsContent>

          <TabsContent value="cancelled" className="space-y-4">
            {getFilteredAppointments("cancelled").length === 0 ? (
              <Card className="p-12 text-center border-border bg-card">
                <p className="text-muted-foreground">
                  Nenhum agendamento cancelado.
                </p>
              </Card>
            ) : (
              getFilteredAppointments("cancelled").map(renderAppointmentCard)
            )}
          </TabsContent>
        </Tabs>
      </main>

      {editingAppointment && (
        <EditAppointmentDialog
          appointment={editingAppointment}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSuccess={() => {
            if (user) loadAppointments(user.id);
          }}
        />
      )}
    </div>
  );
};

export default Appointments;