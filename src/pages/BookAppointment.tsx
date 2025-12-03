import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
  image_url: string | null;
}

interface WorkingHour {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface BarbershopData {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  avatar_url: string | null;
  banner_url: string | null;
}

const BookAppointment = () => {
  const { barberSlug } = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [workingHours, setWorkingHours] = useState<WorkingHour[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [clientName, setClientName] = useState("");
  const [clientWhatsapp, setClientWhatsapp] = useState("");
  const [barbershopInfo, setBarbershopInfo] = useState<BarbershopData | null>(null);

  useEffect(() => {
    loadBarbershopData();
  }, [barberSlug]);

  useEffect(() => {
    if (selectedDate && selectedService && barbershopInfo) {
      generateAvailableTimes();
    }
  }, [selectedDate, selectedService, barbershopInfo]);

  function validateAndNormalize(phone: string) {
    const defaultCountry = 'BR' as CountryCode
    const phoneNumber = parsePhoneNumberFromString(phone, defaultCountry);
    if (!phoneNumber) return { valid: false, reason: 'invalid_format' };

    const isPossible = phoneNumber.isPossible();
    const isValid = phoneNumber.isValid();
    const e164 = phoneNumber.number;

    return {
      valid: isPossible && isValid,
      e164,
      country: phoneNumber.country,
      nationalNumber: phoneNumber.nationalNumber,
    };
  }

  const loadBarbershopData = async () => {
    if (!barberSlug) return;

    try {
      
      // Tentar buscar diretamente da tabela primeiro (para debug)
      const { data: directData, error: directError } = await supabase
        .from("barbershops")
        .select("*")
        .eq("slug", barberSlug)
        .single();

      if (directError || !directData) {
        toast({
          title: "Barbearia não encontrada",
          description: "Este link pode estar incorreto ou a barbearia não existe mais.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const barbershopData = {
        barber_id: directData.barber_id,
        barbershop_name: directData.barbershop_name,
        barber_name: directData.barber_name,
        slug: directData.slug
      };
      // Buscar avatar e banner do storage
      const { data: { publicUrl: avatarUrl } } = supabase
        .storage
        .from('avatars')
        .getPublicUrl(`${barbershopData.barber_id}/avatar.png`);
      
      const { data: { publicUrl: bannerUrl } } = supabase
        .storage
        .from('banners')
        .getPublicUrl(`${barbershopData.barber_id}/banner.png`);

      setBarbershopInfo( {
        id: barbershopData.barber_id,
        user_id: barbershopData.barber_id,
        name: barbershopData.barbershop_name,
        slug: barbershopData.slug,
        avatar_url: avatarUrl,
        banner_url: bannerUrl,
      })


      // Load services
      const { data: servicesData, error: servicesError } = await supabase
        .from("services")
        .select("*")
        .eq("barber_id", barbershopData.barber_id)
        .eq("active", true);

      if (servicesError) throw servicesError;
      setServices(servicesData || []);

      // Load working hours
      const { data: hoursData, error: hoursError } = await supabase
        .from("working_hours")
        .select("*")
        .eq("barber_id", barbershopData.barber_id)
        .eq("active", true);

      if (hoursError) throw hoursError;
      setWorkingHours(hoursData || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateAvailableTimes = async () => {
    if (!selectedDate || !selectedService || !barbershopInfo) return;

    const dayOfWeek = selectedDate.getDay();
    const workingHour = workingHours.find(wh => wh.day_of_week === dayOfWeek);

    if (!workingHour) {
      setAvailableTimes([]);
      return;
    }

    // Buscar agendamentos existentes para esta data
    const { data: existingAppointments } = await supabase
      .from("appointments")
      .select("appointment_time, services(duration)")
      .eq("barber_id", barbershopInfo.user_id)
      .eq("appointment_date", format(selectedDate, "yyyy-MM-dd"))
      .in("status", ["pending", "confirmed"]);

    const bookedSlots = new Set<string>();
    
    // Marcar todos os horários ocupados incluindo a duração do serviço
    existingAppointments?.forEach((apt: any) => {
      const [hour, minute] = apt.appointment_time.split(':').map(Number);
      const startTime = hour * 60 + minute;
      const duration = apt.services?.duration || 0;
      
      // Bloquear todos os slots que se sobrepõem
      for (let i = 0; i < duration; i += 30) {
        const blockedTime = startTime + i;
        const blockedHour = Math.floor(blockedTime / 60);
        const blockedMinute = blockedTime % 60;
        bookedSlots.add(`${blockedHour.toString().padStart(2, '0')}:${blockedMinute.toString().padStart(2, '0')}`);
      }
    });

    const times: string[] = [];
    const [startHour, startMinute] = workingHour.start_time.split(':').map(Number);
    const [endHour, endMinute] = workingHour.end_time.split(':').map(Number);

    let currentTime = startHour * 60 + startMinute;
    const endTime = endHour * 60 + endMinute;

    while (currentTime + selectedService.duration <= endTime) {
      const hour = Math.floor(currentTime / 60);
      const minute = currentTime % 60;
      const timeSlot = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      
      // Verificar se este slot ou qualquer slot durante a duração do serviço está ocupado
      let isAvailable = true;
      for (let i = 0; i < selectedService.duration; i += 30) {
        const checkTime = currentTime + i;
        const checkHour = Math.floor(checkTime / 60);
        const checkMinute = checkTime % 60;
        const checkSlot = `${checkHour.toString().padStart(2, '0')}:${checkMinute.toString().padStart(2, '0')}`;
        if (bookedSlots.has(checkSlot)) {
          isAvailable = false;
          break;
        }
      }
      
      if (isAvailable) {
        times.push(timeSlot);
      }
      
      currentTime += 30;
    }

    setAvailableTimes(times);
  };

  const getFilteredTimes = () => {
    if (!selectedDate) return [];

    const today = new Date();
    const isToday = format(selectedDate, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");

    let times = availableTimes;

    if (isToday) {
      const currentTime = today.getHours() * 60 + today.getMinutes();
      times = times.filter((t) => {
        const [h, m] = t.split(":").map(Number);
        const minutes = h * 60 + m;
        return minutes > currentTime;
      });
    }

    return times;
  };

  const handleBooking = async () => {
    if (!selectedService || !selectedDate || !selectedTime || !clientName || !clientWhatsapp || !barbershopInfo) {
      toast({
        title: "Preencha todos os campos",
        variant: "destructive",
      });
      return;
    }

    const phoneCheck = validateAndNormalize(clientWhatsapp);
    if (!phoneCheck.valid) {
      toast({
        title: "WhatsApp inválido",
        description: "Digite um número válido. Ex: (11) 98765-4321",
        variant: "destructive",
      });
      return;
    }
    const normalizedWhatsapp = phoneCheck.e164;

    try {
      const { error } = await supabase
        .from("appointments")
        .insert([{
          barber_id: barbershopInfo.user_id,
          service_id: selectedService.id,
          appointment_date: format(selectedDate, "yyyy-MM-dd"),
          appointment_time: selectedTime,
          client_name: clientName,
          client_whatsapp: normalizedWhatsapp,
          price: selectedService.price,
          status: "pending",
        }]);

      if (error) throw error;

      toast({
        title: "Agendamento realizado!",
        description: "Aguarde a confirmação do barbeiro.",
      });

      // Reset form
      setSelectedService(null);
      setSelectedDate(undefined);
      setSelectedTime("");
      setClientName("");
      setClientWhatsapp("");
    } catch (error: any) {
      toast({
        title: "Erro ao agendar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const disabledDays = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isPast = date < today;
    const dayOfWeek = date.getDay();
    const barberWorksThisDay = workingHours.some(wh => wh.day_of_week === dayOfWeek);

    return isPast || !barberWorksThisDay;
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

  if (!barbershopInfo) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-4">
        <Card className="p-8 text-center border-border bg-card max-w-md">
          <h2 className="text-2xl font-bold mb-4">Barbearia não encontrada</h2>
          <p className="text-muted-foreground">
            Este link pode estar incorreto ou a barbearia não existe mais.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-dark">
      <header className="relative border-b border-border">
        {barbershopInfo.banner_url && (
          <div className="h-48 overflow-hidden">
            <img 
              src={barbershopInfo.banner_url} 
              alt="Banner da barbearia" 
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="container mx-auto px-4 py-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            {barbershopInfo.avatar_url ? (
              <img 
                src={barbershopInfo.avatar_url} 
                alt="Logo" 
                className="h-20 w-20 rounded-full object-cover border-4 border-background shadow-lg -mt-10"
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-gradient-gold flex items-center justify-center font-bold text-primary-foreground text-2xl border-4 border-background shadow-lg -mt-10">
                {barbershopInfo.name?.charAt(0) || "AB"}
              </div>
            )}
          </div>
          <h1 className="text-3xl font-bold">
            {barbershopInfo.name}
          </h1>
          <p className="text-muted-foreground mb-4">
            Faça seu agendamento
          </p>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.location.href = "/meus-agendamentos"}
          >
            Ver Meus Agendamentos
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Services Selection */}
          <div>
            <h2 className="text-2xl font-bold mb-4">Escolha o Serviço</h2>
            <div className="space-y-4">
              {services.map((service) => (
                <Card
                  key={service.id}
                  className={`p-4 cursor-pointer transition-all border-2 ${
                    selectedService?.id === service.id
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:border-primary/50"
                  }`}
                  onClick={() => setSelectedService(service)}
                >
                  <div className="flex gap-4">
                    {service.image_url && (
                      <img
                        src={service.image_url}
                        alt={service.name}
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="font-bold text-lg">{service.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {service.duration} minutos
                      </p>
                      <p className="text-lg font-bold text-primary">
                        R$ {service.price.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Booking Form */}
          <div>
            <h2 className="text-2xl font-bold mb-4">Dados do Agendamento</h2>
            <Card className="p-6 border-border bg-card space-y-6">
              <div>
                <Label>Data</Label>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={disabledDays}
                  locale={ptBR}
                  className="rounded-md border border-border bg-background"
                />
              </div>

              {selectedDate && getFilteredTimes().length > 0 && (
                <div>
                  <Label>Horário</Label>
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {getFilteredTimes().map((time) => (
                      <Button
                        key={time}
                        variant={selectedTime === time ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedTime(time)}
                      >
                        {time}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="name">Seu Nome</Label>
                <Input
                  id="name"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Digite seu nome completo"
                />
              </div>
              
              <div>
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  value={clientWhatsapp}
                  onChange={(e) => setClientWhatsapp(e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleBooking}
                disabled={!selectedService || !selectedDate || !selectedTime || !clientName || !clientWhatsapp}
              >
                Confirmar Agendamento
              </Button>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default BookAppointment;