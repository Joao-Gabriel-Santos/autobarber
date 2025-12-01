import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar as CalendarIcon, Clock, User, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Appointment {
  id: string;
  barber_id: string;
  appointment_date: string;
  appointment_time: string;
  client_name: string;
  client_whatsapp: string;
  status: string;
  price: number;
  services: {
    name: string;
  };
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
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
    const { data, error } = await supabase
      .from("appointments")
      .select(`
        *,
        services (
          name
        )
      `)
      .eq("barber_id", userId)
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true });

    if (error) {
      toast({
        title: "Erro ao carregar agendamentos",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    if (data) {
    const now = new Date();

    function combineDateTime(dateStr: string, timeStr: string) {
      const [year, month, day] = dateStr.split("-").map(Number);
      const [hours, minutes] = timeStr.split(":").map(Number);
      return new Date(year, month - 1, day, hours, minutes);
    }

    const filtered = data.filter((appointment) => {
      if (appointment.status === "cancelled") return false;

      if (appointment.status === "completed") {
        const appointmentDateTime = combineDateTime(
          appointment.appointment_date,
          appointment.appointment_time
        );
        if (appointmentDateTime < now) {
          return false;
        }
      }
       return true;
    });
    setAppointments(filtered);
    } else {
    setAppointments([]);
    }
  };
  function parseDateAsLocal(dateString: string) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  const updateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Status atualizado!",
      });

      if (user) loadAppointments(user.id);
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar status",
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
        <div className="space-y-4">
          {appointments.map((appointment) => (
            <Card key={appointment.id} className="p-6 border-border bg-card">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-bold text-lg mb-1">
                    {appointment.services.name}
                  </h3>
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
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span>{appointment.client_whatsapp}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarIcon className="h-4 w-4" />
                  <span>
                    {format(parseDateAsLocal(appointment.appointment_date), "dd 'de' MMMM 'de' yyyy", {
                      locale: ptBR,
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{appointment.appointment_time}</span>
                </div>
              </div>

              {appointment.status === "pending" && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => updateStatus(appointment.id, "confirmed")}
                  >
                    Confirmar
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

              {appointment.status === "confirmed" && (
                <Button
                  size="sm"
                  onClick={() => updateStatus(appointment.id, "completed")}
                >
                  Marcar como Concluído
                </Button>
              )}
            </Card>
          ))}
        </div>

        {appointments.length === 0 && (
          <Card className="p-12 text-center border-border bg-card">
            <p className="text-muted-foreground">
              Nenhum agendamento encontrado.
            </p>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Appointments;