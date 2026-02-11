import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UserPlus, Plus, Minus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}

interface SelectedService {
  service_id: string;
  service_name: string;
  price: number;
  duration: number;
  quantity: number;
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
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientWhatsapp, setClientWhatsapp] = useState("");
  const [clientBirthday, setClientBirthday] = useState("");
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");

  const isStarter = currentPlan === 'starter';

  useEffect(() => {
    if (open) {
      loadServices();
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      setStartTime(currentTime);
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

  const maskDate = (value: string): string => {
    const numbers = value.replace(/\D/g, '');
    
    if (numbers.length <= 2) {
      return numbers;
    } else if (numbers.length <= 4) {
      return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
    } else {
      return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const char = String.fromCharCode(e.which);
    if (!/[0-9]/.test(char)) {
      e.preventDefault();
    }
  };

  const convertDateToISO = (dateStr: string): string | null => {
    if (!dateStr || dateStr.length !== 10) return null;
    
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    
    const [day, month, year] = parts;
    if (day.length !== 2 || month.length !== 2 || year.length !== 4) return null;
    
    const dayNum = parseInt(day);
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);
    
    if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12 || yearNum < 1900) {
      return null;
    }
    
    return `${year}-${month}-${day}`;
  };

  const toggleService = (service: Service) => {
    const exists = selectedServices.find(s => s.service_id === service.id);
    
    if (exists) {
      setSelectedServices(selectedServices.filter(s => s.service_id !== service.id));
    } else {
      setSelectedServices([
        ...selectedServices,
        {
          service_id: service.id,
          service_name: service.name,
          price: service.price,
          duration: service.duration,
          quantity: 1
        }
      ]);
    }
  };

  const updateQuantity = (serviceId: string, delta: number) => {
    setSelectedServices(selectedServices.map(s => {
      if (s.service_id === serviceId) {
        const newQuantity = Math.max(1, s.quantity + delta);
        return { ...s, quantity: newQuantity };
      }
      return s;
    }));
  };

  const removeService = (serviceId: string) => {
    setSelectedServices(selectedServices.filter(s => s.service_id !== serviceId));
  };

  const calculateTotals = () => {
    const totalPrice = selectedServices.reduce((sum, s) => sum + (s.price * s.quantity), 0);
    const totalDuration = selectedServices.reduce((sum, s) => sum + (s.duration * s.quantity), 0);
    return { totalPrice, totalDuration };
  };

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleSubmit = async () => {
    if (selectedServices.length === 0 || !clientName || !startTime || !endTime) {
      toast({
        title: "Preencha todos os campos",
        description: "Selecione pelo menos um serviço e preencha os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    if (clientEmail && clientEmail.trim() && !clientEmail.includes('@')) {
      toast({
        title: "Email inválido",
        description: "Por favor, insira um email válido",
        variant: "destructive",
      });
      return;
    }

    let birthdayISO = null;
    if (clientBirthday && clientBirthday.trim()) {
      if (clientBirthday.length !== 10) {
        toast({
          title: "Data de nascimento inválida",
          description: "Use o formato DD/MM/AAAA",
          variant: "destructive",
        });
        return;
      }
      
      birthdayISO = convertDateToISO(clientBirthday);
      if (!birthdayISO) {
        toast({
          title: "Data de nascimento inválida",
          description: "Verifique a data informada",
          variant: "destructive",
        });
        return;
      }
    }

    if (endTime <= startTime) {
      toast({
        title: "Horário inválido",
        description: "O horário de encerramento deve ser posterior ao de início",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const today = formatDate(new Date());
      const { totalPrice } = calculateTotals();

      const appointmentData: any = {
        barber_id: barberId,
        service_id: selectedServices[0].service_id,
        client_name: clientName,
        client_whatsapp: clientWhatsapp || "Sem WhatsApp",
        appointment_date: today,
        appointment_time: startTime,
        end_time: endTime,
        price: totalPrice,
        status: "completed",
        services_data: selectedServices,
      };

      if (clientEmail && clientEmail.trim()) {
        appointmentData.client_email = clientEmail.trim();
      }

      if (birthdayISO) {
        appointmentData.client_birthday = birthdayISO;
      }

      const { error } = await supabase
        .from("appointments")
        .insert(appointmentData);

      if (error) throw error;

      toast({
        title: "✅ Cliente registrado!",
        description: `${clientName} - ${startTime} às ${endTime}`,
      });

      setOpen(false);
      onSuccess();
      
      setSelectedServices([]);
      setClientName("");
      setClientEmail("");
      setClientWhatsapp("");
      setClientBirthday("");
      setStartTime("");
      setEndTime("");
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

  const { totalPrice, totalDuration } = calculateTotals();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="shadow-gold">
          <UserPlus className="h-4 w-4 mr-2" />
          Entrada Direta
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Registrar Cliente Walk-in
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <div className="space-y-6">
            {isStarter && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  💡 <strong>Plano Starter:</strong> Registro rápido sem verificação de horários. O atendimento será marcado como concluído automaticamente.
                </p>
              </div>
            )}

            <div className="space-y-3">
              <Label className="text-base font-semibold">Serviços</Label>
              
              <Card className="p-4 border-border bg-card/50">
                <p className="text-sm text-muted-foreground mb-3">
                  Selecione os serviços realizados:
                </p>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {services.map(service => {
                    const isSelected = selectedServices.some(s => s.service_id === service.id);
                    return (
                      <div
                        key={service.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer hover:border-primary/50 ${
                          isSelected ? 'border-primary bg-primary/5' : 'border-border'
                        }`}
                        onClick={() => toggleService(service)}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleService(service)}
                        />
                        <div className="flex-1">
                          <p className="font-medium">{service.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {service.duration}min - R$ {service.price.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {selectedServices.length > 0 && (
                <Card className="p-4 border-primary/20 bg-primary/5">
                  <p className="text-sm font-semibold mb-3">Serviços Selecionados:</p>
                  <div className="space-y-2">
                    {selectedServices.map(selected => (
                      <div
                        key={selected.service_id}
                        className="flex items-center gap-2 p-2 rounded-lg bg-background/50"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-sm">{selected.service_name}</p>
                          <p className="text-xs text-muted-foreground">
                            R$ {selected.price.toFixed(2)} x {selected.quantity} = R$ {(selected.price * selected.quantity).toFixed(2)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateQuantity(selected.service_id, -1)}
                            disabled={selected.quantity <= 1}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center font-medium">{selected.quantity}</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateQuantity(selected.service_id, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => removeService(selected.service_id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Duração Total:</span>
                      <span className="font-semibold">{totalDuration} min</span>
                    </div>
                    <div className="flex justify-between text-base mt-1">
                      <span className="font-semibold">Total:</span>
                      <span className="font-bold text-primary text-lg">R$ {totalPrice.toFixed(2)}</span>
                    </div>
                  </div>
                </Card>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clientName">Nome do Cliente *</Label>
                <Input
                  id="clientName"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="João Silva"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientWhatsapp">WhatsApp (opcional)</Label>
                <Input
                  id="clientWhatsapp"
                  value={clientWhatsapp}
                  onChange={(e) => setClientWhatsapp(e.target.value)}
                  placeholder="(11) 98765-4321"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientEmail">E-mail (opcional)</Label>
                <Input
                  id="clientEmail"
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="cliente@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientBirthday">Data de Nascimento (opcional)</Label>
                <Input
                  id="clientBirthday"
                  type="text"
                  inputMode="numeric"
                  value={clientBirthday}
                  onChange={(e) => {
                    const maskedValue = maskDate(e.target.value);
                    setClientBirthday(maskedValue);
                  }}
                  onKeyPress={handleKeyPress}
                  maxLength={10}
                  placeholder="DD/MM/AAAA"
                  className="bg-background"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Horário de Início *</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">Horário de Encerramento *</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {isStarter 
                ? "Informe os horários do atendimento para registro financeiro"
                : "Horários em que o cliente foi atendido"
              }
            </p>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleSubmit}
                disabled={loading || selectedServices.length === 0 || !clientName || !startTime || !endTime}
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
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default WalkInAppointment;