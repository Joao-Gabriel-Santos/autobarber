import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ClientService, WhatsAppService } from "@/services/clientService";
import { Repeat, MessageCircle, User } from "lucide-react";

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
  image_url: string | null;
}

interface Barber {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface WorkingHour {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface Break {
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
  owner_accepts_appointments: boolean;
  whatsapp_number: string | null;
}

interface LastServiceData {
  service_id: string;
  service_name: string;
  barber_id: string;
  barber_name: string;
}

const BookAppointment = () => {
  const { barberSlug } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [workingHours, setWorkingHours] = useState<WorkingHour[]>([]);
  const [breaks, setBreaks] = useState<Break[]>([]);
  
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  
  const [clientName, setClientName] = useState("");
  const [clientWhatsapp, setClientWhatsapp] = useState("");
  const [clientBirthday, setClientBirthday] = useState("");
  
  const [barbershopInfo, setBarbershopInfo] = useState<BarbershopData | null>(null);
  const [ownerId, setOwnerId] = useState<string>("");
  
  const [isReturningClient, setIsReturningClient] = useState(false);
  const [lastService, setLastService] = useState<any>(null);
  const [clientDataLoaded, setClientDataLoaded] = useState(false);

  useEffect(() => {
    loadBarbershopData();
  }, [barberSlug]);

  useEffect(() => {
    const whatsappParam = searchParams.get("whatsapp");
    if (whatsappParam && ownerId) {
      loadClientData(whatsappParam);
    }
  }, [ownerId, searchParams]);

  useEffect(() => {
    if (selectedDate && selectedService && selectedBarber) {
      generateAvailableTimes();
    }
  }, [selectedDate, selectedService, selectedBarber]);

  const loadClientData = async (whatsapp: string) => {
    if (clientDataLoaded) return; // Evitar múltiplas chamadas

    const phoneCheck = validateAndNormalize(whatsapp);
    if (!phoneCheck.valid) return;

    try {
      const { data: client } = await supabase
        .from("clients")
        .select("*")
        .eq("barbershop_id", ownerId)
        .eq("whatsapp", phoneCheck.e164)
        .maybeSingle();

      if (client) {
        setClientName(client.nome);
        setClientWhatsapp(whatsapp); // Manter formato original
        setClientBirthday(client.data_nascimento || "");
        setIsReturningClient(true);
        setClientDataLoaded(true);

        // Buscar último serviço
        const lastSvc = await ClientService.getLastService(phoneCheck.e164, ownerId);
        if (lastSvc) {
          setLastService(lastSvc);
        }

        toast({
          title: "Bem-vindo de volta! 👋",
          description: `Olá ${client.nome}! Seus dados foram carregados automaticamente.`,
        });
      }
    } catch (error) {
      console.error("Error loading client data:", error);
    }
  };

  const handleWhatsAppClick = () => {
    if (!barbershopInfo?.whatsapp_number) {
      toast({
        title: "WhatsApp não disponível",
        description: "Esta barbearia ainda não configurou o WhatsApp.",
        variant: "destructive",
      });
      return;
    }

    // Remove caracteres não numéricos do número
    let cleanNumber = barbershopInfo.whatsapp_number.replace(/\D/g, '');

    if (cleanNumber.length <= 11) {
    cleanNumber = `55${cleanNumber}`;}
    
    // Cria a mensagem padrão
    const message = encodeURIComponent(`Olá! Gostaria de mais informações sobre os serviços da ${barbershopInfo.name}.`);
    
    // Cria o link do WhatsApp
    const whatsappUrl = `https://wa.me/${cleanNumber}?text=${message}`;
    
    // Abre em nova aba
    window.open(whatsappUrl, '_blank');
  };

  function validateAndNormalize(phone: string) {
    const defaultCountry = 'BR' as CountryCode;
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
    if (!barberSlug) {
      console.log("No barberSlug provided");
      return;
    }

    try {
      console.log("Searching for slug:", barberSlug);
      
      const { data: directData, error: directError } = await supabase
        .from("barbershops")
        .select("*")
        .eq("slug", barberSlug)
        .maybeSingle();

      console.log("Direct query result:", { directData, directError });

      if (directError || !directData) {
        toast({
          title: "Barbearia não encontrada",
          description: "Este link pode estar incorreto ou a barbearia não existe mais.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, whatsapp")
        .eq("id", directData.barber_id)
        .maybeSingle();
      
      if (profileError) {
        console.error("Error loading profile:", profileError);
      }

      const barbershopData = {
        barber_id: directData.barber_id,
        barbershop_name: directData.barbershop_name,
        full_name: profile?.full_name || null,
        slug: directData.slug,
        owner_accepts_appointments: directData.owner_accepts_appointments || false,
        whatsapp: profile?.whatsapp || null
      };
      
      setOwnerId(barbershopData.barber_id);
      
      const { data: { publicUrl: avatarUrl } } = supabase
        .storage
        .from('avatars')
        .getPublicUrl(`${barbershopData.barber_id}/avatar.png`);
      
      const { data: { publicUrl: bannerUrl } } = supabase
        .storage
        .from('banners')
        .getPublicUrl(`${barbershopData.barber_id}/banner.png`);

      setBarbershopInfo({
        id: barbershopData.barber_id,
        user_id: barbershopData.barber_id,
        name: barbershopData.barbershop_name,
        slug: barbershopData.slug,
        avatar_url: avatarUrl,
        banner_url: bannerUrl,
        owner_accepts_appointments: barbershopData.owner_accepts_appointments,
        whatsapp_number: barbershopData.whatsapp
      });

      const { data: servicesData, error: servicesError } = await supabase
        .from("services")
        .select("*")
        .eq("barber_id", barbershopData.barber_id)
        .eq("active", true);

      if (servicesError) throw servicesError;
      setServices(servicesData || []);

      const barbersList: Barber[] = [];
      
      if (barbershopData.owner_accepts_appointments) {
        const { data: ownerProfile } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .eq("id", barbershopData.barber_id)
          .single();
        
        if (ownerProfile) {
          barbersList.push({
            id: ownerProfile.id,
            full_name: ownerProfile.full_name || "Dono",
            avatar_url: ownerProfile.avatar_url
          });
        }
      }

      const { data: teamMembers } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .eq("barbershop_id", barbershopData.barber_id)
        .eq("role", "barber");
      
      if (teamMembers) {
        barbersList.push(...teamMembers.map(member => ({
          id: member.id,
          full_name: member.full_name || "Barbeiro",
          avatar_url: member.avatar_url
        })));
      }

      setBarbers(barbersList);

      if (barbersList.length === 1) {
        setSelectedBarber(barbersList[0]);
      }

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

  const loadBarberSchedule = async (barberId: string) => {
    const { data: hoursData, error: hoursError } = await supabase
      .from("working_hours")
      .select("*")
      .eq("barber_id", barberId)
      .eq("active", true);

    if (hoursError) {
      console.error("Error loading working hours:", hoursError);
      setWorkingHours([]);
    } else {
      setWorkingHours(hoursData || []);
    }

    const { data: breaksData, error: breaksError } = await supabase
      .from("breaks")
      .select("*")
      .eq("barber_id", barberId);

    if (breaksError) {
      console.log("Breaks table error:", breaksError);
      setBreaks([]);
    } else {
      setBreaks(breaksData || []);
    }
  };

  useEffect(() => {
    if (selectedBarber) {
      loadBarberSchedule(selectedBarber.id);
    }
  }, [selectedBarber]);

  const isTimeInBreak = (timeInMinutes: number, dayOfWeek: number): boolean => {
    const dayBreaks = breaks.filter(b => b.day_of_week === dayOfWeek);
    
    for (const brk of dayBreaks) {
      const [breakStartHour, breakStartMinute] = brk.start_time.split(':').map(Number);
      const [breakEndHour, breakEndMinute] = brk.end_time.split(':').map(Number);
      const breakStart = breakStartHour * 60 + breakStartMinute;
      const breakEnd = breakEndHour * 60 + breakEndMinute;

      if (timeInMinutes >= breakStart && timeInMinutes < breakEnd) {
        return true;
      }
    }
    return false;
  };

  const generateAvailableTimes = async () => {
    if (!selectedDate || !selectedService || !selectedBarber) return;

    const dayOfWeek = selectedDate.getDay();
    const workingHour = workingHours.find(wh => wh.day_of_week === dayOfWeek);

    if (!workingHour) {
      setAvailableTimes([]);
      return;
    }

    const { data: existingAppointments } = await supabase
      .from("appointments")
      .select("appointment_time, services(duration)")
      .eq("barber_id", selectedBarber.id)
      .eq("appointment_date", format(selectedDate, "yyyy-MM-dd"))
      .in("status", ["pending", "confirmed"]);

    const occupiedMinutes = new Set<number>();
    
    existingAppointments?.forEach((apt: any) => {
      const [hour, minute] = apt.appointment_time.split(':').map(Number);
      const startTime = hour * 60 + minute;
      const duration = apt.services?.duration || 0;
      
      for (let i = 0; i < duration; i++) {
        occupiedMinutes.add(startTime + i);
      }
    });

    const times: string[] = [];
    const [startHour, startMinute] = workingHour.start_time.split(':').map(Number);
    const [endHour, endMinute] = workingHour.end_time.split(':').map(Number);

    let currentTime = startHour * 60 + startMinute;
    const endTime = endHour * 60 + endMinute;
    const serviceDuration = selectedService.duration;

    while (currentTime + serviceDuration <= endTime) {
      const hour = Math.floor(currentTime / 60);
      const minute = currentTime % 60;
      const timeSlot = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      
      let isAvailable = true;
      
      for (let i = 0; i < serviceDuration; i++) {
        const checkTime = currentTime + i;
        
        if (occupiedMinutes.has(checkTime)) {
          isAvailable = false;
          break;
        }
        
        if (isTimeInBreak(checkTime, dayOfWeek)) {
          isAvailable = false;
          break;
        }
      }
      
      if (isAvailable) {
        times.push(timeSlot);
      }
      
      currentTime += serviceDuration;
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

  // ✨ VERIFICAR SE É CLIENTE RECORRENTE
  const checkReturningClient = async (whatsapp: string) => {
    if (!ownerId || !whatsapp) return;
    
    const phoneCheck = validateAndNormalize(whatsapp);
    if (!phoneCheck.valid) return;

    const lastSvc = await ClientService.getLastService(phoneCheck.e164, ownerId);
    
    if (lastSvc) {
      setIsReturningClient(true);
      setLastService(lastSvc);
      
      toast({
        title: "Bem-vindo de volta! 👋",
        description: "Encontramos seu histórico. Use o botão 'O de Sempre' para agilizar.",
      });
    } else {
      setIsReturningClient(false);
      setLastService(null);
    }
  };

  // ✨ USAR ÚLTIMO SERVIÇO
  const useLastService = () => {
    if (!lastService) return;
    
    const service = services.find(s => s.id === lastService.service_id);
    const barber = barbers.find(b => b.id === lastService.barber_id);
    
    if (service) setSelectedService(service);
    if (barber) setSelectedBarber(barber);
    
    toast({
      title: "Serviço selecionado!",
      description: `${lastService.service_name} com ${lastService.barber_name}`,
    });
  };

  // ✨ AGENDAMENTO COM CADASTRO INVISÍVEL
  const handleBooking = async () => {
    if (!selectedService || !selectedDate || !selectedTime || !clientName || !clientWhatsapp || !selectedBarber) {
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
      // ============================================
      // ETAPA 1: CADASTRO INVISÍVEL DO CLIENTE
      // ============================================
      const client = await ClientService.upsertClient(
        ownerId,
        normalizedWhatsapp,
        clientName,
        clientBirthday || undefined
      );

      if (!client) {
        throw new Error("Erro ao registrar cliente");
      }

      // ============================================
      // ETAPA 2: CRIAR AGENDAMENTO
      // ============================================
      const { data: appointment, error } = await supabase
        .from("appointments")
        .insert({
          barber_id: selectedBarber.id,
          service_id: selectedService.id,
          appointment_date: format(selectedDate, "yyyy-MM-dd"),
          appointment_time: selectedTime,
          client_name: clientName,
          client_whatsapp: normalizedWhatsapp,
          price: selectedService.price,
          status: "confirmed",
          client_id: client.id,
        })
        .select()
        .single();

      if (error) throw error;

      // ============================================
      // ETAPA 3: ENVIAR CONFIRMAÇÃO VIA WHATSAPP
      // ============================================
      await WhatsAppService.sendAppointmentConfirmation(
        normalizedWhatsapp,
        {
          service: selectedService.name,
          date: format(selectedDate, "dd/MM/yyyy", { locale: ptBR }),
          time: selectedTime,
          barber: selectedBarber.full_name,
        }
      );

      toast({
        title: "✅ Agendamento confirmado!",
        description: `${clientName}, seu horário foi confirmado. Você receberá uma confirmação no WhatsApp.`,
      });

      setSelectedService(null);
      setSelectedBarber(null);
      setSelectedDate(undefined);
      setSelectedTime("");
      setClientName("");
      setClientWhatsapp("");

      // Redirecionar para dashboard do cliente
      const dashboardUrl = `/client-dashboard?whatsapp=%2B55${encodeURIComponent(clientWhatsapp)}&barbershop_id=${ownerId}&barbershop_slug=${barberSlug}`;
      
      setTimeout(() => {
        window.location.href = dashboardUrl;
      }, 2000);

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

    const maxDate = addDays(today, 7);
    maxDate.setHours(23, 59, 59, 999);

    const isPast = date < today;
    const isTooFarInFuture = date > maxDate;
    
    if (!selectedBarber) return isPast || isTooFarInFuture;
    
    const dayOfWeek = date.getDay();
    const barberWorksThisDay = workingHours.some(wh => wh.day_of_week === dayOfWeek);

    return isPast || isTooFarInFuture || !barberWorksThisDay;
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

  const showBarberSelector = barbers.length > 1;

  return (
    <div className="min-h-screen bg-gradient-dark">
      {/* Header */}
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
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.location.href = (`/meus-agendamentos?barbershop_slug=${barberSlug}`)}
            >
              Ver Meus Agendamentos
            </Button>
            {barbershopInfo.whatsapp_number && (
              <Button 
                size="sm"
                onClick={handleWhatsAppClick}
                className="bg-[#089311] hover:bg-[#20BA5A] text-white"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Falar no WhatsApp
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Services and Barber Selection */}
          <div className="space-y-6">
            {/* Barber Selection */}
            {showBarberSelector && (
              <div>
                <h2 className="text-2xl font-bold mb-4">Escolha o Barbeiro</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {barbers.map((barber) => (
                    <Card
                      key={barber.id}
                      className={`p-4 cursor-pointer transition-all border-2 ${
                        selectedBarber?.id === barber.id
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:border-primary/50"
                      }`}
                      onClick={() => setSelectedBarber(barber)}
                    >
                      <div className="flex flex-col items-center gap-3">
                        <Avatar className="h-20 w-20">
                          {barber.avatar_url ? (
                            <AvatarImage src={barber.avatar_url} alt={barber.full_name} />
                          ) : (
                            <AvatarFallback className="bg-gradient-gold text-primary-foreground text-xl">
                              {barber.full_name.charAt(0)}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <h3 className="font-bold text-center">{barber.full_name}</h3>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Service Selection */}
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
          </div>

          {/* Booking Form */}
          <div>
            <h2 className="text-2xl font-bold mb-4">Dados do Agendamento</h2>
            <Card className="p-6 border-border bg-card space-y-6">
              {!showBarberSelector && selectedBarber && (
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                  <p className="text-sm font-semibold text-primary">
                    Agendamento com: {selectedBarber.full_name}
                  </p>
                </div>
              )}

              {showBarberSelector && selectedBarber && (
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                  <p className="text-sm font-semibold text-primary">
                    Barbeiro selecionado: {selectedBarber.full_name}
                  </p>
                </div>
              )}

              {/* ✨ Botão "O de Sempre" */}
              {isReturningClient && lastService && (
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                  <Button
                    onClick={useLastService}
                    className="w-full shadow-gold"
                    size="lg"
                  >
                    <Repeat className="h-5 w-5 mr-2" />
                    O de Sempre
                    <span className="ml-2 text-sm opacity-80">
                      ({lastService.service_name})
                    </span>
                  </Button>
                </div>
              )}

              <div>
                <Label>Data (próximos 8 dias)</Label>
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

              {selectedDate && getFilteredTimes().length === 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">
                    ⚠️ Não há horários disponíveis nesta data para este barbeiro.
                  </p>
                </div>
              )}

              <div>
                <Label htmlFor="name">Seu Nome *</Label>
                <Input
                  id="name"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Digite seu nome completo"
                />
              </div>
              
              <div>
                <Label htmlFor="whatsapp">WhatsApp *</Label>
                <Input
                  id="whatsapp"
                  value={clientWhatsapp}
                  onChange={(e) => setClientWhatsapp(e.target.value)}
                  onBlur={(e) => checkReturningClient(e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>

              {/* ✨ Data de Nascimento */}
              <div>
                <Label htmlFor="birthday" className="flex items-center gap-2">
                  Data de Nascimento *
                </Label>
                <Input
                  id="birthday"
                  type="date"
                  value={clientBirthday}
                  onChange={(e) => setClientBirthday(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  💡 Informe para ganhar descontos especiais!
                </p>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleBooking}
                disabled={!selectedBarber || !selectedService || !selectedDate || !selectedTime || !clientName || !clientWhatsapp}
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