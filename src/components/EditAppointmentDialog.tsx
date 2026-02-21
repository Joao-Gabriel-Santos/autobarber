import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Clock, Save } from "lucide-react";

interface EditAppointmentDialogProps {
  appointment: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const EditAppointmentDialog = ({ appointment, open, onOpenChange, onSuccess }: EditAppointmentDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientWhatsapp, setClientWhatsapp] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");

  useEffect(() => {
    if (open && appointment) {
      setStartTime(appointment.appointment_time || "");
      setEndTime(appointment.end_time || "");
      setClientName(appointment.client_name || "");
      setClientWhatsapp(appointment.client_whatsapp || "");
      setClientEmail(appointment.client_email || "");
      setPaymentMethod(appointment.payment_method || "");
    }
  }, [open, appointment]);

  const handleSave = async () => {
    if (!startTime || !endTime) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha os horários de início e encerramento",
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

    if (clientEmail && clientEmail.trim() && !clientEmail.includes('@')) {
      toast({
        title: "Email inválido",
        description: "Por favor, insira um email válido",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const updateData: any = {
        appointment_time: startTime,
        end_time: endTime,
        client_name: clientName,
        client_whatsapp: clientWhatsapp,
        ...(paymentMethod && { payment_method: paymentMethod }),
      };

      if (clientEmail && clientEmail.trim()) {
        updateData.client_email = clientEmail.trim();
      }

      const { error } = await supabase
        .from("appointments")
        .update(updateData)
        .eq("id", appointment.id);

      if (error) throw error;

      toast({
        title: "✅ Atendimento atualizado!",
        description: "As informações foram salvas com sucesso",
      });

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Editar Atendimento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-client-name">Nome do Cliente</Label>
            <Input
              id="edit-client-name"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Nome do cliente"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-whatsapp">WhatsApp</Label>
            <Input
              id="edit-whatsapp"
              value={clientWhatsapp}
              onChange={(e) => setClientWhatsapp(e.target.value)}
              placeholder="(11) 98765-4321"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-email">E-mail (opcional)</Label>
            <Input
              id="edit-email"
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="cliente@email.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-start-time">Horário de Início</Label>
              <Input
                id="edit-start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-end-time">Horário de Encerramento</Label>
              <Input
                id="edit-end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-payment-method">Forma de Pagamento (opcional)</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger id="edit-payment-method">
                <SelectValue placeholder="Selecione a forma de pagamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">Pix</SelectItem>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="cartao">Cartão</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleSave}
              disabled={loading}
              className="flex-1"
            >
              <Save className="h-4 w-4 mr-2" />
              {loading ? "Salvando..." : "Salvar Alterações"}
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditAppointmentDialog;