import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { UserPlus, Plus, Minus, Trash2, Users, UserCheck, ChevronDown, Search, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

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

interface ExistingClient {
  id: string;
  name: string;
  whatsapp: string;
  email?: string;
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

  // Client type selection
  const [clientType, setClientType] = useState<"existing" | "walkin">("walkin");
  const [clientAccordionOpen, setClientAccordionOpen] = useState(false);
  const [existingClients, setExistingClients] = useState<ExistingClient[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedExistingClient, setSelectedExistingClient] = useState<ExistingClient | null>(null);
  const [loadingClients, setLoadingClients] = useState(false);

  // Form fields
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

  useEffect(() => {
    if (clientType === "existing" && clientAccordionOpen) {
      loadExistingClients();
    }
  }, [clientType, clientAccordionOpen]);

  // Reset client state when switching type
  useEffect(() => {
    setSelectedExistingClient(null);
    setClientSearch("");
    setClientName("");
    setClientEmail("");
    setClientWhatsapp("");
    setClientBirthday("");
  }, [clientType]);

  const loadServices = async () => {
    const { data } = await supabase
      .from("services")
      .select("*")
      .eq("barber_id", barberId)
      .eq("active", true);

    setServices(data || []);
  };

  const loadExistingClients = async () => {
    setLoadingClients(true);
    try {
      // Fetch distinct clients from past appointments for this barber
      const { data } = await supabase
        .from("appointments")
        .select("client_name, client_whatsapp, client_email")
        .eq("barber_id", barberId)
        .not("client_name", "is", null)
        .not("client_whatsapp", "eq", "Sem WhatsApp")
        .order("client_name", { ascending: true });

      if (data) {
        // Deduplicate by whatsapp
        const seen = new Set<string>();
        const unique: ExistingClient[] = [];
        data.forEach((row, idx) => {
          const key = row.client_whatsapp || row.client_name;
          if (!seen.has(key)) {
            seen.add(key);
            unique.push({
              id: `${idx}-${row.client_whatsapp}`,
              name: row.client_name,
              whatsapp: row.client_whatsapp || "",
              email: row.client_email || "",
            });
          }
        });
        setExistingClients(unique);
      }
    } finally {
      setLoadingClients(false);
    }
  };

  const filteredClients = existingClients.filter(client =>
    client.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    client.whatsapp.includes(clientSearch)
  );

  const handleSelectExistingClient = (client: ExistingClient) => {
    setSelectedExistingClient(client);
    setClientAccordionOpen(false);
  };

  const maskDate = (value: string): string => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 4) return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
    return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const char = String.fromCharCode(e.which);
    if (!/[0-9]/.test(char)) e.preventDefault();
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
    if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12 || yearNum < 1900) return null;
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

  // Resolve the final client data for submission
  const getClientData = () => {
    if (clientType === "existing" && selectedExistingClient) {
      return {
        name: selectedExistingClient.name,
        whatsapp: selectedExistingClient.whatsapp || "Sem WhatsApp",
        email: selectedExistingClient.email || null,
        birthday: null,
      };
    }
    return {
      name: clientName,
      whatsapp: clientWhatsapp || "Sem WhatsApp",
      email: clientEmail?.trim() || null,
      birthday: clientBirthday,
    };
  };

  const isFormValid = () => {
    if (selectedServices.length === 0 || !startTime || !endTime) return false;
    if (clientType === "existing") return !!selectedExistingClient;
    return !!clientName;
  };

  const handleSubmit = async () => {
    if (!isFormValid()) {
      toast({
        title: "Preencha todos os campos",
        description: "Selecione pelo menos um serviço e preencha os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    const client = getClientData();

    if (client.email && !client.email.includes('@')) {
      toast({
        title: "Email inválido",
        description: "Por favor, insira um email válido",
        variant: "destructive",
      });
      return;
    }

    let birthdayISO = null;
    if (client.birthday && client.birthday.trim()) {
      if (client.birthday.length !== 10) {
        toast({
          title: "Data de nascimento inválida",
          description: "Use o formato DD/MM/AAAA",
          variant: "destructive",
        });
        return;
      }
      birthdayISO = convertDateToISO(client.birthday);
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
        client_name: client.name,
        client_whatsapp: client.whatsapp,
        appointment_date: today,
        appointment_time: startTime,
        end_time: endTime,
        price: totalPrice,
        status: "completed",
        services_data: selectedServices,
      };

      if (client.email) appointmentData.client_email = client.email;
      if (birthdayISO) appointmentData.client_birthday = birthdayISO;

      const { error } = await supabase
        .from("appointments")
        .insert(appointmentData);

      if (error) throw error;

      toast({
        title: "✅ Cliente registrado!",
        description: `${client.name} - ${startTime} às ${endTime}`,
      });

      setOpen(false);
      onSuccess();

      // Reset all state
      setSelectedServices([]);
      setClientType("walkin");
      setSelectedExistingClient(null);
      setClientSearch("");
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

            {/* ── Services ── */}
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

            {/* ── Client Type Selector ── */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Identificação do Cliente</Label>

              <RadioGroup
                value={clientType}
                onValueChange={(v) => setClientType(v as "existing" | "walkin")}
                className="grid grid-cols-2 gap-3"
              >
                {/* Existing client card */}
                <Label
                  htmlFor="type-existing"
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    clientType === "existing"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <RadioGroupItem value="existing" id="type-existing" className="sr-only" />
                  <Users className={`h-6 w-6 ${clientType === "existing" ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-sm font-semibold ${clientType === "existing" ? "text-primary" : "text-muted-foreground"}`}>
                    Cliente Cadastrado
                  </span>
                  <span className="text-xs text-muted-foreground text-center leading-tight">
                    Já possui histórico na barbearia
                  </span>
                </Label>

                {/* Walk-in card */}
                <Label
                  htmlFor="type-walkin"
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    clientType === "walkin"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <RadioGroupItem value="walkin" id="type-walkin" className="sr-only" />
                  <UserCheck className={`h-6 w-6 ${clientType === "walkin" ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-sm font-semibold ${clientType === "walkin" ? "text-primary" : "text-muted-foreground"}`}>
                    Cliente Avulso
                  </span>
                  <span className="text-xs text-muted-foreground text-center leading-tight">
                    Primeira visita ou não cadastrado
                  </span>
                </Label>
              </RadioGroup>
            </div>

            {/* ── Existing Client Accordion ── */}
            {clientType === "existing" && (
              <div className="space-y-3">
                <Collapsible open={clientAccordionOpen} onOpenChange={setClientAccordionOpen}>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                        selectedExistingClient
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40 bg-card/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {selectedExistingClient ? (
                          <>
                            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                              <span className="text-sm font-bold text-primary">
                                {selectedExistingClient.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="text-left">
                              <p className="font-semibold text-sm">{selectedExistingClient.name}</p>
                              <p className="text-xs text-muted-foreground">{selectedExistingClient.whatsapp}</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <Search className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              Selecionar cliente cadastrado...
                            </span>
                          </>
                        )}
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                          clientAccordionOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  </CollapsibleTrigger>

                  <CollapsibleContent className="mt-2">
                    <Card className="p-3 border-border bg-card/50">
                      {/* Search field */}
                      <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar por nome ou WhatsApp..."
                          value={clientSearch}
                          onChange={(e) => setClientSearch(e.target.value)}
                          className="pl-9"
                        />
                      </div>

                      {/* Client list */}
                      <div className="space-y-1 max-h-[220px] overflow-y-auto">
                        {loadingClients ? (
                          <p className="text-sm text-muted-foreground text-center py-6">
                            Carregando clientes...
                          </p>
                        ) : filteredClients.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-6">
                            {clientSearch ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado ainda"}
                          </p>
                        ) : (
                          filteredClients.map(client => {
                            const isChosen = selectedExistingClient?.id === client.id;
                            return (
                              <button
                                key={client.id}
                                type="button"
                                onClick={() => handleSelectExistingClient(client)}
                                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                                  isChosen
                                    ? "border-primary bg-primary/10"
                                    : "border-transparent hover:border-border hover:bg-accent/50"
                                }`}
                              >
                                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                                  <span className="text-sm font-bold text-muted-foreground">
                                    {client.name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">{client.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">{client.whatsapp}</p>
                                </div>
                                {isChosen && (
                                  <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </Card>
                  </CollapsibleContent>
                </Collapsible>

                {/* Selected client summary pill */}
                {selectedExistingClient && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <UserCheck className="h-4 w-4 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{selectedExistingClient.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{selectedExistingClient.whatsapp}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedExistingClient(null)}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                    >
                      Trocar
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Walk-in Form Fields ── */}
            {clientType === "walkin" && (
              <>
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
                      onChange={(e) => setClientBirthday(maskDate(e.target.value))}
                      onKeyPress={handleKeyPress}
                      maxLength={10}
                      placeholder="DD/MM/AAAA"
                      className="bg-background"
                    />
                  </div>
                </div>
              </>
            )}

            {/* ── Time Fields ── */}
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

            {/* ── Actions ── */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleSubmit}
                disabled={loading || !isFormValid()}
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