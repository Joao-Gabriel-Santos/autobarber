import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Calendar as CalendarIcon, Clock, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Appointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  client_name: string;
  status: string;
  price: number;
  services: {
    name: string;
  };
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

const ClientAppointments = () => {
  const { toast } = useToast();
  const [whatsapp, setWhatsapp] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const searchAppointments = async () => {
    if (!whatsapp) {
      toast({
        title: "Digite seu WhatsApp",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          *,
          services (
            name
          )
        `)
        .eq("client_whatsapp", whatsapp)
        .order("appointment_date", { ascending: true })
        .order("appointment_time", { ascending: true });

      if (error) throw error;

      setAppointments(data || []);
      setSearched(true);
    } catch (error: any) {
      toast({
        title: "Erro ao buscar agendamentos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const cancelAppointment = async (id: string) => {
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", id)
        .eq("client_whatsapp", whatsapp);

      if (error) throw error;

      toast({
        title: "Agendamento cancelado!",
      });

      searchAppointments();
    } catch (error: any) {
      toast({
        title: "Erro ao cancelar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-dark">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6 text-center">
          <h1 className="text-3xl font-bold mb-2">Meus Agendamentos</h1>
          <p className="text-muted-foreground">
            Consulte, cancele ou remarque seus agendamentos
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="p-6 border-border bg-card mb-8">
          <Label htmlFor="whatsapp">Digite seu WhatsApp</Label>
          <div className="flex gap-2 mt-2">
            <Input
              id="whatsapp"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="(00) 00000-0000"
              className="flex-1"
            />
            <Button onClick={searchAppointments} disabled={loading}>
              <Search className="h-4 w-4 mr-2" />
              Entrar
            </Button>
          </div>
        </Card>

        {searched && (
          <div className="space-y-4">
            {appointments.length === 0 ? (
              <Card className="p-12 text-center border-border bg-card">
                <p className="text-muted-foreground">
                  Nenhum agendamento encontrado.
                </p>
              </Card>
            ) : (
              appointments.map((appointment) => (
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

                  <div className="grid gap-3 mb-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CalendarIcon className="h-4 w-4" />
                      <span>
                        {format(new Date(appointment.appointment_date), "dd 'de' MMMM 'de' yyyy", {
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{appointment.appointment_time}</span>
                    </div>
                  </div>

                  {(appointment.status === "confirmed") && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => cancelAppointment(appointment.id)}
                      className="w-full"
                    >
                      Cancelar Agendamento
                    </Button>
                  )}
                </Card>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default ClientAppointments;
