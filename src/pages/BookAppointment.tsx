import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, isSameDay, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ClientService, WhatsAppService } from "@/services/clientService";
import { Repeat, MessageCircle, ShoppingCart, Trash2, Plus, Check, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
  image_url: string | null;
}

interface CartItem extends Service {
  quantity: number;
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
  banner_zoom: number | null;
  banner_position_x: number | null;
  banner_position_y: number | null;
}

const BookAppointment = () => {
  const { barberSlug } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [workingHours, setWorkingHours] = useState<WorkingHour[]>([]);
  const [breaks, setBreaks] = useState<Break[]>([]);
  
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  
  const [clientName, setClientName] = useState("");
  const [clientWhatsapp, setClientWhatsapp] = useState("");
  const [clientBirthday, setClientBirthday] = useState("");
  const [clientId, setClientId] = useState<string>("");
  
  const [barbershopInfo, setBarbershopInfo] = useState<BarbershopData | null>(null);
  const [ownerId, setOwnerId] = useState<string>("");
  
  const [isReturningClient, setIsReturningClient] = useState(false);
  const [lastService, setLastService] = useState<any>(null);
  const [clientAuthenticated, setClientAuthenticated] = useState(false);

  useEffect(() => {
    const today = startOfDay(new Date());
    const dates: Date[] = [];
    for (let i = 0; i < 8; i++) {
      dates.push(addDays(today, i));
    }
    setAvailableDates(dates);
    setSelectedDate(dates[0]);
  }, []);

  useEffect(() => {
    loadBarbershopData();
  }, [barberSlug]);

  useEffect(() => {
    const whatsappParam = searchParams.get("whatsapp");
    if (whatsappParam && ownerId) {
      loadClientData(whatsappParam);
    } else if (ownerId && !whatsappParam) {
      navigate(`/client-auth/${barberSlug}`);
    }
  }, [ownerId, searchParams, barberSlug]);

  useEffect(() => {
    if (selectedDate && cart.length > 0 && selectedBarber) {
      generateAvailableTimes();
    }
  }, [selectedDate, cart, selectedBarber]);

  const addToCart = (service: Service) => {
    const existingItem = cart.find(item => item.id === service.id);
    if (existingItem) {
      setCart(cart.map(item => 
        item.id === service.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { ...service, quantity: 1 }]);
    }
    toast({ title: "Adicionado ao carrinho!", description: service.name });
  };

  const removeFromCart = (serviceId: string) => {
    const item = cart.find(i => i.id === serviceId);
    if (item && item.quantity > 1) {
      setCart(cart.map(i => i.id === serviceId ? { ...i, quantity: i.quantity - 1 } : i));
    } else {
      setCart(cart.filter(i => i.id !== serviceId));
    }
  };

  const clearCart = () => setCart([]);

  const getTotalPrice = () =>
    cart.reduce((total, item) => total + (item.price * item.quantity), 0);

  const getTotalDuration = () =>
    cart.reduce((total, item) => total + (item.duration * item.quantity), 0);

  const isInCart = (serviceId: string) => cart.some(item => item.id === serviceId);

  const getCartQuantity = (serviceId: string) =>
    cart.find(item => item.id === serviceId)?.quantity || 0;

  const loadClientData = async (whatsapp: string) => {
    const phoneCheck = validateAndNormalize(whatsapp);
    if (!phoneCheck.valid) {
      toast({ title: "WhatsApp inválido", variant: "destructive" });
      navigate(`/client-auth/${barberSlug}`);
      return;
    }

    try {
      const { data: client } = await supabase
        .from("clients")
        .select("*")
        .eq("barbershop_id", ownerId)
        .eq("whatsapp", phoneCheck.e164)
        .maybeSingle();

      if (!client) {
        toast({
          title: "Cliente não encontrado",
          description: "Você precisa fazer login primeiro",
          variant: "destructive",
        });
        navigate(`/client-auth/${barberSlug}`);
        return;
      }

      setClientId(client.id);
      setClientName(client.nome);
      setClientWhatsapp(whatsapp);
      setClientBirthday(client.data_nascimento || "");
      setClientAuthenticated(true);

      const lastSvc = await ClientService.getLastService(phoneCheck.e164, ownerId);
      if (lastSvc) {
        setLastService(lastSvc);
        setIsReturningClient(true);
      }

      toast({ title: "Bem-vindo de volta! 👋", description: `Olá ${client.nome}!` });
    } catch (error) {
      console.error("Error loading client data:", error);
      navigate(`/client-auth/${barberSlug}`);
    }
  };

  const handleLogout = () => {
    navigate(`/client-auth/${barberSlug}`);
    toast({ title: "Sessão encerrada", description: "Faça login novamente para agendar" });
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
    let cleanNumber = barbershopInfo.whatsapp_number.replace(/\D/g, '');
    if (cleanNumber.length <= 11) cleanNumber = `55${cleanNumber}`;
    const message = encodeURIComponent(`Olá! Gostaria de mais informações sobre os serviços da ${barbershopInfo.name}.`);
    window.open(`https://wa.me/${cleanNumber}?text=${message}`, '_blank');
  };

  function validateAndNormalize(phone: string) {
    const defaultCountry = 'BR' as CountryCode;
    const phoneNumber = parsePhoneNumberFromString(phone, defaultCountry);
    if (!phoneNumber) return { valid: false, reason: 'invalid_format' };
    return {
      valid: phoneNumber.isPossible() && phoneNumber.isValid(),
      e164: phoneNumber.number,
      country: phoneNumber.country,
      nationalNumber: phoneNumber.nationalNumber,
    };
  }

  const loadBarbershopData = async () => {
    if (!barberSlug) return;

    try {
      const { data: directData, error: directError } = await supabase
        .from("barbershops")
        .select("*")
        .eq("slug", barberSlug)
        .maybeSingle();

      if (directError || !directData) {
        toast({
          title: "Barbearia não encontrada",
          description: "Este link pode estar incorreto ou a barbearia não existe mais.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, whatsapp")
        .eq("id", directData.barber_id)
        .maybeSingle();

      const barbershopData = {
        barber_id: directData.barber_id,
        barbershop_name: directData.barbershop_name,
        full_name: profile?.full_name || null,
        slug: directData.slug,
        owner_accepts_appointments: directData.owner_accepts_appointments || false,
        whatsapp: profile?.whatsapp || null,
        banner_zoom: directData.banner_zoom || 100,
        banner_position_x: directData.banner_position_x || 50,
        banner_position_y: directData.banner_position_y || 50,
      };

      setOwnerId(barbershopData.barber_id);

      const { data: { publicUrl: avatarUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(`${barbershopData.barber_id}/avatar.png`);

      const { data: { publicUrl: bannerUrl } } = supabase.storage
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
        whatsapp_number: barbershopData.whatsapp,
        banner_zoom: barbershopData.banner_zoom,
        banner_position_x: barbershopData.banner_position_x,
        banner_position_y: barbershopData.banner_position_y,
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
            avatar_url: ownerProfile.avatar_url,
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
          avatar_url: member.avatar_url,
        })));
      }

      setBarbers(barbersList);
      if (barbersList.length === 1) setSelectedBarber(barbersList[0]);

    } catch (error: any) {
      toast({ title: "Erro ao carregar dados", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadBarberSchedule = async (barberId: string) => {
    const { data: hoursData } = await supabase
      .from("working_hours")
      .select("*")
      .eq("barber_id", barberId)
      .eq("active", true);
    setWorkingHours(hoursData || []);

    const { data: breaksData } = await supabase
      .from("breaks")
      .select("*")
      .eq("barber_id", barberId);
    setBreaks(breaksData || []);
  };

  useEffect(() => {
    if (selectedBarber) loadBarberSchedule(selectedBarber.id);
  }, [selectedBarber]);

  const isTimeInBreak = (timeInMinutes: number, dayOfWeek: number): boolean => {
    const dayBreaks = breaks.filter(b => b.day_of_week === dayOfWeek);
    for (const brk of dayBreaks) {
      const [bsh, bsm] = brk.start_time.split(':').map(Number);
      const [beh, bem] = brk.end_time.split(':').map(Number);
      if (timeInMinutes >= bsh * 60 + bsm && timeInMinutes < beh * 60 + bem) return true;
    }
    return false;
  };

  /**
   * Calcula a duração real de um agendamento existente:
   * - Se tiver services_data (múltiplos serviços), soma duration * quantity de cada item
   * - Caso contrário, usa a duração do serviço joinado (legado)
   * - Fallback: 30 minutos
   */
  const getAppointmentDuration = (apt: any): number => {
    // Agendamento com múltiplos serviços (novo formato)
    if (apt.services_data && Array.isArray(apt.services_data) && apt.services_data.length > 0) {
      const total = apt.services_data.reduce((sum: number, svc: any) => {
        return sum + ((svc.duration || 0) * (svc.quantity || 1));
      }, 0);
      if (total > 0) return total;
    }
    // Agendamento legado (join com services)
    if (apt.services?.duration) return apt.services.duration;
    return 30;
  };

  const generateAvailableTimes = async () => {
    if (!selectedDate || cart.length === 0 || !selectedBarber) return;

    const dayOfWeek = selectedDate.getDay();
    const workingHour = workingHours.find(wh => wh.day_of_week === dayOfWeek);

    if (!workingHour) {
      setAvailableTimes([]);
      return;
    }

    // ─── CORREÇÃO: buscar services_data junto com services(duration) ───────────
    const { data: existingAppointments } = await supabase
      .from("appointments")
      .select("appointment_time, services_data, services(duration)")
      .eq("barber_id", selectedBarber.id)
      .eq("appointment_date", format(selectedDate, "yyyy-MM-dd"))
      .in("status", ["pending", "confirmed"]);
    // ──────────────────────────────────────────────────────────────────────────

    const occupiedMinutes = new Set<number>();

    existingAppointments?.forEach((apt: any) => {
      const [hour, minute] = apt.appointment_time.split(':').map(Number);
      const startMin = hour * 60 + minute;
      // ── Usa duração real, considerando múltiplos serviços ──
      const duration = getAppointmentDuration(apt);

      for (let i = 0; i < duration; i++) {
        occupiedMinutes.add(startMin + i);
      }
    });

    const times: string[] = [];
    const [startHour, startMinute] = workingHour.start_time.split(':').map(Number);
    const [endHour, endMinute] = workingHour.end_time.split(':').map(Number);

    let currentTime = startHour * 60 + startMinute;
    const endTime = endHour * 60 + endMinute;
    const totalDuration = getTotalDuration();

    while (currentTime + totalDuration <= endTime) {
      const hour = Math.floor(currentTime / 60);
      const minute = currentTime % 60;
      const timeSlot = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

      let isAvailable = true;

      for (let i = 0; i < totalDuration; i++) {
        const checkTime = currentTime + i;
        if (occupiedMinutes.has(checkTime) || isTimeInBreak(checkTime, dayOfWeek)) {
          isAvailable = false;
          break;
        }
      }

      if (isAvailable) times.push(timeSlot);
      currentTime += 15;
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
      times = times.filter(t => {
        const [h, m] = t.split(":").map(Number);
        return h * 60 + m > currentTime;
      });
    }
    return times;
  };

  const useLastService = () => {
    if (!lastService) return;
    const service = services.find(s => s.id === lastService.service_id);
    const barber = barbers.find(b => b.id === lastService.barber_id);
    if (service) { clearCart(); addToCart(service); }
    if (barber) setSelectedBarber(barber);
    toast({ title: "Serviço selecionado!", description: `${lastService.service_name} com ${lastService.barber_name}` });
  };

  const handleBooking = async () => {
    if (!clientAuthenticated) {
      toast({ title: "Faça login primeiro", variant: "destructive" });
      navigate(`/client-auth/${barberSlug}`);
      return;
    }

    if (cart.length === 0 || !selectedDate || !selectedTime || !selectedBarber) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }

    try {
      const servicesData = cart.map(item => ({
        service_id: item.id,
        service_name: item.name,
        price: item.price,
        duration: item.duration,
        quantity: item.quantity,
      }));

      const totalPrice = getTotalPrice();
      const servicesNames = cart.map(item =>
        item.quantity > 1 ? `${item.quantity}x ${item.name}` : item.name
      ).join(', ');

      const { data: appointment, error } = await supabase
        .from("appointments")
        .insert({
          barber_id: selectedBarber.id,
          service_id: cart[0].id,
          services_data: servicesData,
          appointment_date: format(selectedDate, "yyyy-MM-dd"),
          appointment_time: selectedTime,
          client_name: clientName,
          client_whatsapp: clientWhatsapp,
          price: totalPrice,
          status: "confirmed",
          client_id: clientId,
        })
        .select()
        .single();

      if (error) throw error;

      const phoneCheck = validateAndNormalize(clientWhatsapp);
      if (phoneCheck.valid) {
        await WhatsAppService.sendAppointmentConfirmation(phoneCheck.e164, {
          service: servicesNames,
          date: format(selectedDate, "dd/MM/yyyy", { locale: ptBR }),
          time: selectedTime,
          barber: selectedBarber.full_name,
        });
      }

      toast({
        title: "✅ Agendamento confirmado!",
        description: `${clientName}, seu agendamento foi confirmado com ${cart.length} serviço(s)!`,
      });

      clearCart();
      setSelectedBarber(null);
      setSelectedDate(availableDates[0]);
      setSelectedTime("");

      const finalWhatsapp = phoneCheck.valid ? phoneCheck.e164 : clientWhatsapp;
      const dashboardUrl = `/client-dashboard?whatsapp=${encodeURIComponent(finalWhatsapp)}&barbershop_id=${ownerId}&barbershop_slug=${barberSlug}`;
      setTimeout(() => window.location.assign(dashboardUrl), 1500);

    } catch (error: any) {
      toast({ title: "Erro ao agendar", description: error.message, variant: "destructive" });
    }
  };

  const isDayDisabled = (date: Date) => {
    if (!selectedBarber) return true;
    return !workingHours.some(wh => wh.day_of_week === date.getDay());
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
          <p className="text-muted-foreground">Este link pode estar incorreto ou a barbearia não existe mais.</p>
        </Card>
      </div>
    );
  }

  if (!clientAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 rounded-lg bg-gradient-gold animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  const showBarberSelector = barbers.length > 1;

  return (
    <div className="min-h-screen bg-gradient-dark">
      <header className="relative border-b border-border">
        {barbershopInfo.banner_url && (
          <div className="h-48 overflow-hidden relative">
            <div
              className="w-full h-full"
              style={{
                backgroundImage: `url(${barbershopInfo.banner_url})`,
                backgroundSize: `${barbershopInfo.banner_zoom}%`,
                backgroundPosition: `${barbershopInfo.banner_position_x}% ${barbershopInfo.banner_position_y}%`,
                backgroundRepeat: 'no-repeat',
              }}
            />
          </div>
        )}
        <div className="container mx-auto px-4 py-12 text-center">
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
          <h1 className="text-3xl font-bold">{barbershopInfo.name}</h1>
          <p className="text-muted-foreground mb-2">Bem-vindo, {clientName}!</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/meus-agendamentos?whatsapp=${encodeURIComponent(clientWhatsapp)}&barbershop_slug=${barberSlug}`)}
            >
              Ver Meus Agendamentos
            </Button>
            {barbershopInfo.whatsapp_number && (
              <Button size="sm" onClick={handleWhatsAppClick} className="bg-[#089311] hover:bg-[#20BA5A] text-white">
                <MessageCircle className="h-4 w-4 mr-2" />
                Falar no WhatsApp
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Coluna Esquerda */}
          <div className="space-y-6">
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

            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">Serviços Disponíveis</h2>
                {cart.length > 0 && (
                  <Badge variant="default" className="text-lg px-3 py-1">
                    <ShoppingCart className="h-4 w-4 mr-1" />
                    {cart.reduce((sum, item) => sum + item.quantity, 0)}
                  </Badge>
                )}
              </div>
              <div className="space-y-4">
                {services.map((service) => {
                  const inCart = isInCart(service.id);
                  const quantity = getCartQuantity(service.id);
                  return (
                    <Card
                      key={service.id}
                      className={`p-4 transition-all border-2 ${
                        inCart
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:border-primary/50"
                      }`}
                    >
                      <div className="flex gap-4">
                        {service.image_url && (
                          <img src={service.image_url} alt={service.name} className="w-20 h-20 object-cover rounded-lg" />
                        )}
                        <div className="flex-1">
                          <h3 className="font-bold text-lg">{service.name}</h3>
                          <p className="text-sm text-muted-foreground">{service.duration} minutos</p>
                          <p className="text-lg font-bold text-primary">R$ {service.price.toFixed(2)}</p>
                        </div>
                        <div className="flex flex-col gap-2 justify-center">
                          {!inCart ? (
                            <Button size="sm" onClick={() => addToCart(service)}>
                              <Plus className="h-4 w-4 mr-1" />
                              Adicionar
                            </Button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="outline" onClick={() => removeFromCart(service.id)}>-</Button>
                              <span className="font-bold min-w-[2ch] text-center">{quantity}</span>
                              <Button size="sm" variant="outline" onClick={() => addToCart(service)}>+</Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Coluna Direita */}
          <div className="space-y-6">
            {cart.length > 0 && (
              <Card className="p-6 border-border bg-card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold">Resumo do Pedido</h3>
                  <Button variant="ghost" size="sm" onClick={clearCart}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Limpar
                  </Button>
                </div>
                <div className="space-y-3 mb-4">
                  {cart.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>{item.quantity}x {item.name}</span>
                      <span className="font-semibold">R$ {(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border pt-3 space-y-2">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Duração total:</span>
                    <span>{getTotalDuration()} minutos</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span className="text-primary">R$ {getTotalPrice().toFixed(2)}</span>
                  </div>
                </div>
              </Card>
            )}

            <Card className="p-6 border-border bg-card space-y-6">
              <h2 className="text-2xl font-bold">Dados do Agendamento</h2>

              {!showBarberSelector && selectedBarber && (
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                  <p className="text-sm font-semibold text-primary">Agendamento com: {selectedBarber.full_name}</p>
                </div>
              )}

              {showBarberSelector && selectedBarber && (
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                  <p className="text-sm font-semibold text-primary">Barbeiro selecionado: {selectedBarber.full_name}</p>
                </div>
              )}

              {isReturningClient && lastService && (
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                  <Button onClick={useLastService} className="w-full shadow-gold" size="lg">
                    <Repeat className="h-5 w-5 mr-2" />
                    O de Sempre
                    <span className="ml-2 text-sm opacity-80">({lastService.service_name})</span>
                  </Button>
                </div>
              )}

              <div>
                <Label className="mb-3 block">Escolha o Dia (próximos 8 dias)</Label>
                <div className="grid grid-cols-4 gap-2">
                  {availableDates.map((date, index) => {
                    const isSelected = selectedDate && isSameDay(date, selectedDate);
                    const isDisabled = isDayDisabled(date);
                    const isToday = isSameDay(date, new Date());
                    return (
                      <Button
                        key={index}
                        variant={isSelected ? "default" : "outline"}
                        size="lg"
                        disabled={isDisabled}
                        onClick={() => setSelectedDate(date)}
                        className={`flex flex-col h-auto py-3 ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <span className="text-xs uppercase">{format(date, "EEE", { locale: ptBR })}</span>
                        <span className="text-2xl font-bold">{format(date, "dd", { locale: ptBR })}</span>
                        <span className="text-xs">{format(date, "MMM", { locale: ptBR })}</span>
                        {isToday && (
                          <Badge variant="secondary" className="mt-1 text-[10px] py-0 px-1">Hoje</Badge>
                        )}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {selectedDate && cart.length > 0 && getFilteredTimes().length > 0 && (
                <div>
                  <Label>Horário de Início</Label>
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
                  <p className="text-xs text-muted-foreground mt-2">
                    ⏱️ Seus serviços terminarão às {(() => {
                      if (!selectedTime) return "—";
                      const [h, m] = selectedTime.split(':').map(Number);
                      const total = h * 60 + m + getTotalDuration();
                      return `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
                    })()}
                  </p>
                </div>
              )}

              {selectedDate && cart.length > 0 && getFilteredTimes().length === 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">
                    ⚠️ Não há horários disponíveis nesta data para este barbeiro com a duração total de {getTotalDuration()} minutos.
                  </p>
                </div>
              )}

              {cart.length === 0 && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <p className="text-sm text-blue-600 dark:text-blue-400">
                    ℹ️ Adicione serviços ao carrinho para selecionar data e horário
                  </p>
                </div>
              )}

              <Button
                className="w-full"
                size="lg"
                onClick={handleBooking}
                disabled={!selectedBarber || cart.length === 0 || !selectedDate || !selectedTime}
              >
                <Check className="h-5 w-5 mr-2" />
                Confirmar {cart.length} Serviço(s) - R$ {getTotalPrice().toFixed(2)}
              </Button>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default BookAppointment;