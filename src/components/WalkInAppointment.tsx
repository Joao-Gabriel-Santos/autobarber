import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}

interface WalkInProps {
  barberId: string;
  onSuccess: () => void;
}

const WalkInAppointment = ({ barberId, onSuccess }: WalkInProps) => {
  const { toast } = useToast();
  const { currentPlan } = useSubscription();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<string>("");
  const [clientName, setClientName] = useState("");
  const [clientWhatsapp, setClientWhatsapp] = useState("");
  const [manualTime, setManualTime] = useState<string>("");

  const isStarter = currentPlan === 'starter';

  useEffect(() => {
    if (open) {
      loadServices();
      // Setar hora atual automaticamente
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      setManualTime(currentTime);
    }
  }, [open]);

  const loadServices = async () => {
    const { data } = await supabase
      .from("services")
      .select("*")
      .eq("barber_id", barberId)
      .eq("active", true);
    
    setServices(data || []);
  };

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleSubmit = async () => {
    if (!selectedService || !clientName || !manualTime) {
      toast({
        title: "Preencha todos os campos",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const selectedSvc = services.find(s => s.id === selectedService);
      const today = formatDate(new Date());

      const { error } = await supabase
        .from("appointments")
        .insert({
          barber_id: barberId,
          service_id: selectedService,
          client_name: clientName,
          client_whatsapp: clientWhatsapp || "Sem WhatsApp",
          appointment_date: today,
          appointment_time: manualTime,
          price: selectedSvc?.price || 0,
          status: "completed", // Marcar como concluído direto no Starter
        });

      if (error) throw error;

      toast({
        title: "✅ Cliente registrado!",
        description: `${clientName} - ${manualTime}`,
      });

      setOpen(false);
      onSuccess();
      
      // Reset
      setSelectedService("");
      setClientName("");
      setClientWhatsapp("");
      setManualTime("");
    } catch (error: any) {
      toast({
        title: "Erro ao registrar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="shadow-gold">
          <UserPlus className="h-4 w-4 mr-2" />
          Entrada Direta
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Registrar Cliente Walk-in
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {isStarter && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <p className="text-sm text-blue-600 dark:text-blue-400">
                💡 <strong>Plano Starter:</strong> Registro rápido sem verificação de horários. O atendimento será marcado como concluído automaticamente.
              </p>
            </div>
          )}

          {/* Serviço */}
          <div className="space-y-2">
            <Label>Serviço</Label>
            <Select value={selectedService} onValueChange={setSelectedService}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha o serviço" />
              </SelectTrigger>
              <SelectContent>
                {services.map(service => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name} - {service.duration}min - R$ {service.price.toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cliente */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome do Cliente *</Label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="João Silva"
              />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp (opcional)</Label>
              <Input
                value={clientWhatsapp}
                onChange={(e) => setClientWhatsapp(e.target.value)}
                placeholder="(11) 98765-4321"
              />
            </div>
          </div>

          {/* Horário Manual */}
          <div className="space-y-2">
            <Label>Horário de Atendimento</Label>
            <Input
              type="time"
              value={manualTime}
              onChange={(e) => setManualTime(e.target.value)}
              className="flex-1"
            />
            <p className="text-xs text-muted-foreground">
              {isStarter 
                ? "Informe o horário do atendimento para registro financeiro"
                : "Horário em que o cliente foi atendido"
              }
            </p>
          </div>

          {/* Ações */}
          <div className="flex gap-3">
            <Button
              onClick={handleSubmit}
              disabled={loading || !selectedService || !clientName}
              className="flex-1"
            >
              {loading ? "Registrando..." : "Confirmar Entrada"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WalkInAppointment;