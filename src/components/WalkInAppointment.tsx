import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { UserPlus, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}

interface Appointment {
  id: string;
  appointment_time: string;
  services: { name: string; duration: number };
}

interface WalkInProps {
  barberId: string;
  onSuccess: () => void;
}

interface TimeSlot {
  time: string;
  status: 'available' | 'occupied' | 'break' | 'after-hours';
  nextAvailable?: string;
}

const WalkInAppointment = ({ barberId, onSuccess }: WalkInProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<string>("");
  const [clientName, setClientName] = useState("");
  const [clientWhatsapp, setClientWhatsapp] = useState("");
  const [suggestedTime, setSuggestedTime] = useState<string>("");
  const [manualTime, setManualTime] = useState<string>("");
  
  const [timeAnalysis, setTimeAnalysis] = useState<TimeSlot | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [canProceed, setCanProceed] = useState(false);

  useEffect(() => {
    if (open) {
      loadServices();
      analyzeBestTime();
    }
  }, [open]);

  useEffect(() => {
    if (selectedService && manualTime) {
      analyzeManualTime();
    }
  }, [selectedService, manualTime]);

  const loadServices = async () => {
    const { data } = await supabase
      .from("services")
      .select("*")
      .eq("barber_id", barberId)
      .eq("active", true);
    
    setServices(data || []);
  };

  const analyzeBestTime = async () => {
    setAnalyzing(true);
    try {
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();
      const today = format(now, "yyyy-MM-dd");
      const dayOfWeek = now.getDay();

      // Verificar horário de funcionamento
      const { data: workingHour } = await supabase
        .from("working_hours")
        .select("*")
        .eq("barber_id", barberId)
        .eq("day_of_week", dayOfWeek)
        .eq("active", true)
        .maybeSingle();

      if (!workingHour) {
        toast({
          title: "Barbearia fechada",
          description: "Não há expediente configurado para hoje.",
          variant: "destructive",
        });
        return;
      }

      const [endHour, endMinute] = workingHour.end_time.split(':').map(Number);
      const closingTime = endHour * 60 + endMinute;

      // Buscar agendamentos de hoje
      const { data: appointments } = await supabase
        .from("appointments")
        .select("appointment_time, services(duration)")
        .eq("barber_id", barberId)
        .eq("appointment_date", today)
        .in("status", ["pending", "confirmed", "completed"]);

      // Buscar intervalos
      const { data: breaks } = await supabase
        .from("breaks")
        .select("*")
        .eq("barber_id", barberId)
        .eq("day_of_week", dayOfWeek);

      // Encontrar próximo horário livre
      let searchTime = currentTime;
      const maxSearch = closingTime;
      let foundSlot = false;

      while (searchTime < maxSearch && !foundSlot) {
        const hour = Math.floor(searchTime / 60);
        const minute = searchTime % 60;
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

        // Verificar se está em intervalo
        const isInBreak = breaks?.some(b => {
          const [bStart] = b.start_time.split(':').map(Number);
          const [bEnd] = b.end_time.split(':').map(Number);
          const breakStart = bStart * 60;
          const breakEnd = bEnd * 60;
          return searchTime >= breakStart && searchTime < breakEnd;
        });

        if (isInBreak) {
          searchTime += 15;
          continue;
        }

        // Verificar conflitos com agendamentos
        const hasConflict = appointments?.some(apt => {
          const [aptHour, aptMinute] = apt.appointment_time.split(':').map(Number);
          const aptStart = aptHour * 60 + aptMinute;
          const aptEnd = aptStart + (apt.services?.duration || 0);
          return searchTime >= aptStart && searchTime < aptEnd;
        });

        if (!hasConflict) {
          setSuggestedTime(timeStr);
          setManualTime(timeStr);
          foundSlot = true;
        } else {
          searchTime += 15;
        }
      }

      if (!foundSlot) {
        toast({
          title: "Agenda lotada",
          description: "Não há horários disponíveis hoje.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao analisar horários",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const analyzeManualTime = async () => {
    if (!manualTime || !selectedService) return;

    const selectedSvc = services.find(s => s.id === selectedService);
    if (!selectedSvc) return;

    const warnings: string[] = [];
    const now = new Date();
    const today = format(now, "yyyy-MM-dd");
    const dayOfWeek = now.getDay();

    try {
      const [inputHour, inputMinute] = manualTime.split(':').map(Number);
      const inputTime = inputHour * 60 + inputMinute;
      const serviceEnd = inputTime + selectedSvc.duration;

      // 1. Verificar se está em horário de funcionamento
      const { data: workingHour } = await supabase
        .from("working_hours")
        .select("*")
        .eq("barber_id", barberId)
        .eq("day_of_week", dayOfWeek)
        .eq("active", true)
        .maybeSingle();

      if (!workingHour) {
        warnings.push("⚠️ Barbearia fechada hoje");
        setTimeAnalysis({ time: manualTime, status: 'after-hours' });
        setWarnings(warnings);
        setCanProceed(false);
        return;
      }

      const [startHour, startMinute] = workingHour.start_time.split(':').map(Number);
      const [endHour, endMinute] = workingHour.end_time.split(':').map(Number);
      const openTime = startHour * 60 + startMinute;
      const closeTime = endHour * 60 + endMinute;

      if (inputTime < openTime) {
        warnings.push(`⚠️ Antes do horário de abertura (${workingHour.start_time})`);
      }

      if (serviceEnd > closeTime) {
        warnings.push(`⚠️ Serviço terminaria após o fechamento (${workingHour.end_time})`);
      }

      // 2. Verificar intervalos
      const { data: breaks } = await supabase
        .from("breaks")
        .select("*")
        .eq("barber_id", barberId)
        .eq("day_of_week", dayOfWeek);

      const conflictingBreak = breaks?.find(b => {
        const [bStartHour, bStartMinute] = b.start_time.split(':').map(Number);
        const [bEndHour, bEndMinute] = b.end_time.split(':').map(Number);
        const breakStart = bStartHour * 60 + bStartMinute;
        const breakEnd = bEndHour * 60 + bEndMinute;
        
        return (inputTime >= breakStart && inputTime < breakEnd) ||
               (serviceEnd > breakStart && serviceEnd <= breakEnd) ||
               (inputTime <= breakStart && serviceEnd >= breakEnd);
      });

      if (conflictingBreak) {
        warnings.push(`⚠️ Conflito com intervalo (${conflictingBreak.start_time} - ${conflictingBreak.end_time})`);
      }

      // 3. Verificar agendamentos existentes
      const { data: appointments } = await supabase
        .from("appointments")
        .select("appointment_time, client_name, services(name, duration)")
        .eq("barber_id", barberId)
        .eq("appointment_date", today)
        .in("status", ["pending", "confirmed"]);

      const conflictingApt = appointments?.find(apt => {
        const [aptHour, aptMinute] = apt.appointment_time.split(':').map(Number);
        const aptStart = aptHour * 60 + aptMinute;
        const aptEnd = aptStart + (apt.services?.duration || 0);
        
        return (inputTime >= aptStart && inputTime < aptEnd) ||
               (serviceEnd > aptStart && serviceEnd <= aptEnd) ||
               (inputTime <= aptStart && serviceEnd >= aptEnd);
      });

      if (conflictingApt) {
        warnings.push(`🚨 CONFLITO: ${conflictingApt.client_name} às ${conflictingApt.appointment_time}`);
      }

      // 4. Determinar status e sugerir alternativa
      if (warnings.length === 0) {
        setTimeAnalysis({ time: manualTime, status: 'available' });
        setCanProceed(true);
      } else {
        const hasHardBlock = warnings.some(w => w.includes('CONFLITO') || w.includes('fechada'));
        
        if (hasHardBlock) {
          // Sugerir próximo horário disponível
          const nextAvailable = await findNextAvailable(serviceEnd, closeTime, breaks || [], appointments || []);
          setTimeAnalysis({ 
            time: manualTime, 
            status: 'occupied',
            nextAvailable 
          });
          setCanProceed(false);
        } else {
          setTimeAnalysis({ time: manualTime, status: 'available' });
          setCanProceed(true);
        }
      }

      setWarnings(warnings);
    } catch (error: any) {
      toast({
        title: "Erro ao analisar horário",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const findNextAvailable = async (
    startFrom: number, 
    closeTime: number, 
    breaks: any[], 
    appointments: any[]
  ): Promise<string | undefined> => {
    const selectedSvc = services.find(s => s.id === selectedService);
    if (!selectedSvc) return undefined;

    let searchTime = startFrom;
    
    while (searchTime < closeTime) {
      const serviceEnd = searchTime + selectedSvc.duration;
      
      if (serviceEnd > closeTime) break;

      // Verificar intervalos
      const inBreak = breaks.some(b => {
        const [bStart] = b.start_time.split(':').map(Number);
        const [bEnd] = b.end_time.split(':').map(Number);
        const breakStart = bStart * 60;
        const breakEnd = bEnd * 60;
        return searchTime >= breakStart && searchTime < breakEnd;
      });

      if (inBreak) {
        searchTime += 15;
        continue;
      }

      // Verificar agendamentos
      const hasConflict = appointments.some(apt => {
        const [aptHour, aptMinute] = apt.appointment_time.split(':').map(Number);
        const aptStart = aptHour * 60 + aptMinute;
        const aptEnd = aptStart + (apt.services?.duration || 0);
        return (searchTime >= aptStart && searchTime < aptEnd) ||
               (serviceEnd > aptStart && serviceEnd <= aptEnd);
      });

      if (!hasConflict) {
        const hour = Math.floor(searchTime / 60);
        const minute = searchTime % 60;
        return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      }

      searchTime += 15;
    }

    return undefined;
  };

  const handleSubmit = async () => {
    if (!selectedService || !clientName || !manualTime) {
      toast({
        title: "Preencha todos os campos",
        variant: "destructive",
      });
      return;
    }

    if (!canProceed) {
      toast({
        title: "Horário indisponível",
        description: "Escolha um horário disponível ou use o sugerido.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const selectedSvc = services.find(s => s.id === selectedService);
      const today = format(new Date(), "yyyy-MM-dd");

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
          status: "confirmed",
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
      setTimeAnalysis(null);
      setWarnings([]);
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
      
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Registrar Cliente Walk-in
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Horário Sugerido */}
          {suggestedTime && (
            <Alert className="bg-green-500/10 border-green-500/20">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-600 dark:text-green-400">
                <strong>Próximo horário livre:</strong> {suggestedTime}
              </AlertDescription>
            </Alert>
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
            <div className="flex gap-2">
              <Input
                type="time"
                value={manualTime}
                onChange={(e) => setManualTime(e.target.value)}
                className="flex-1"
              />
              {suggestedTime && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setManualTime(suggestedTime)}
                >
                  Usar Sugerido
                </Button>
              )}
            </div>
          </div>

          {/* Análise de Tempo */}
          {timeAnalysis && (
            <div className="space-y-3">
              {warnings.length > 0 && (
                <Alert variant={warnings.some(w => w.includes('CONFLITO')) ? "destructive" : "default"}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <ul className="space-y-1">
                      {warnings.map((warning, i) => (
                        <li key={i}>{warning}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {timeAnalysis.nextAvailable && (
                <Alert className="bg-blue-500/10 border-blue-500/20">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <AlertDescription className="text-blue-600 dark:text-blue-400">
                    <strong>Sugestão:</strong> Próximo horário disponível é às {timeAnalysis.nextAvailable}
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-2"
                      onClick={() => setManualTime(timeAnalysis.nextAvailable!)}
                    >
                      Usar
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {canProceed && warnings.length === 0 && (
                <Alert className="bg-green-500/10 border-green-500/20">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <AlertDescription className="text-green-600 dark:text-green-400">
                    ✅ Horário disponível e válido!
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Ações */}
          <div className="flex gap-3">
            <Button
              onClick={handleSubmit}
              disabled={loading || !canProceed || !selectedService || !clientName}
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