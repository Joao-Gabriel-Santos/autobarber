import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Minus, Trash2, Search } from "lucide-react";

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

interface Client {
  id: string;
  nome: string;
  whatsapp: string;
  email?: string;
  data_nascimento?: string;
}

interface ManualAppointmentProps {
  barberId: string;
  onSuccess: () => void;
}

const ManualAppointment = ({ barberId, onSuccess }: ManualAppointmentProps) => {
  const { toast } = useToast();
  const { currentPlan } = useSubscription();
  const [loading, setLoading] = useState(false);
  
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [searchClient, setSearchClient] = useState("");
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [appointmentDate, setAppointmentDate] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");

  const isStarter = currentPlan === 'starter';

  useEffect(() => {
    loadServices();
    loadClients();
    const now = new Date();
    const today = formatDateToInput(now);
    setAppointmentDate(today);
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    setStartTime(currentTime);
  }, []);

  useEffect(() => {
    if (searchClient.trim() === "") {
      setFilteredClients(clients);
    } else {
      const search = searchClient.toLowerCase();
      setFilteredClients(
        clients.filter(
          (client) =>
            client.nome.toLowerCase().includes(search) ||
            client.whatsapp.includes(search)
        )
      );
    }
  }, [searchClient, clients]);

  const formatDateToInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const loadServices = async () => {
    const { data } = await supabase
      .from("services")
      .select("*")
      .eq("barber_id", barberId)
      .eq("active", true);
    
    setServices(data || []);
  };

  const loadClients = async () => {
    const { data } = await supabase
      .from("clients")
      .select("id, nome, whatsapp, email, data_nascimento")
      .eq("barbershop_id", barberId)
      .order("nome");
    
    setClients(data || []);
    setFilteredClients(data || []);
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

  const handleSubmit = async () => {
    if (selectedServices.length === 0 || !selectedClientId || !appointmentDate || !startTime || !endTime) {
      toast({
        title: "Preencha todos os campos",
        description: "Selecione o cliente, serviços e preencha os horários",
        variant: "destructive",
      });
      return;
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
      const selectedClient = clients.find(c => c.id === selectedClientId);
      if (!selectedClient) {
        throw new Error("Cliente não encontrado");
      }

      const { totalPrice } = calculateTotals();

      // Adicionar segundos aos horários no formato HH:MM:SS
      const startTimeWithSeconds = `${startTime}:00`;
      const endTimeWithSeconds = `${endTime}:00`;

      const appointmentData: any = {
        barber_id: barberId,
        service_id: selectedServices[0].service_id,
        client_name: selectedClient.nome,
        client_whatsapp: selectedClient.whatsapp || "Sem WhatsApp",
        appointment_date: appointmentDate,
        appointment_time: startTimeWithSeconds,
        end_time: endTimeWithSeconds,
        price: totalPrice,
        status: "confirmed",
        services_data: selectedServices,
      };

      if (selectedClient.email) {
        appointmentData.client_email = selectedClient.email;
      }

      if (selectedClient.data_nascimento) {
        appointmentData.client_birthday = selectedClient.data_nascimento;
      }

      const { error } = await supabase
        .from("appointments")
        .insert(appointmentData);

      if (error) throw error;

      toast({
        title: "✅ Agendamento realizado!",
        description: `${selectedClient.nome} - ${startTime} às ${endTime}`,
      });

      onSuccess();
      
      // Limpar formulário
      setSelectedServices([]);
      setSelectedClientId("");
      setAppointmentDate(formatDateToInput(new Date()));
      setStartTime("");
      setEndTime("");
      setSearchClient("");
    } catch (error: any) {
      toast({
        title: "Erro ao criar agendamento",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const { totalPrice, totalDuration } = calculateTotals();

  const selectedClient = clients.find(c => c.id === selectedClientId);

  return (
    <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
      <div className="space-y-6">
        {isStarter && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <p className="text-sm text-blue-600 dark:text-blue-400">
              💡 <strong>Plano Starter:</strong> Registro manual de agendamento. O horário será verificado apenas no momento da marcação.
            </p>
          </div>
        )}

        {/* Seleção de Cliente */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">Cliente *</Label>
          
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente por nome ou WhatsApp..."
              value={searchClient}
              onChange={(e) => setSearchClient(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um cliente" />
            </SelectTrigger>
            <SelectContent>
              <ScrollArea className="h-[200px]">
                {filteredClients.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Nenhum cliente encontrado
                  </div>
                ) : (
                  filteredClients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{client.nome}</span>
                        <span className="text-xs text-muted-foreground">{client.whatsapp}</span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </ScrollArea>
            </SelectContent>
          </Select>

          {selectedClient && (
            <Card className="p-3 border-primary/20 bg-primary/5">
              <div className="text-sm">
                <p className="font-semibold">{selectedClient.nome}</p>
                <p className="text-xs text-muted-foreground">{selectedClient.whatsapp}</p>
                {selectedClient.email && (
                  <p className="text-xs text-muted-foreground">{selectedClient.email}</p>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Serviços */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">Serviços *</Label>
          
          <Card className="p-4 border-border bg-card/50">
            <p className="text-sm text-muted-foreground mb-3">
              Selecione os serviços a serem realizados:
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

        {/* Data e Horários */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">Data e Horários *</Label>
          
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="appointmentDate">Data do Agendamento</Label>
              <Input
                id="appointmentDate"
                type="date"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
              />
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Horário de Início</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">Horário de Término</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground">
            Informe os horários planejados para o atendimento
          </p>
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            onClick={handleSubmit}
            disabled={loading || selectedServices.length === 0 || !selectedClientId || !appointmentDate || !startTime || !endTime}
            className="flex-1"
          >
            {loading ? "Agendando..." : "Confirmar Agendamento"}
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
};

export default ManualAppointment;