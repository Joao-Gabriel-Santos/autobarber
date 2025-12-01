import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WorkingHour {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  active: boolean;
}

const DAYS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

const Schedule = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [workingHours, setWorkingHours] = useState<Record<number, WorkingHour>>({});

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }
      setUser(user);
      loadSchedule(user.id);
    } catch (error) {
      console.error("Error:", error);
      navigate("/login");
    } finally {
      setLoading(false);
    }
  };

  const loadSchedule = async (userId: string) => {
    const { data, error } = await supabase
      .from("working_hours")
      .select("*")
      .eq("barber_id", userId);

    if (error) {
      toast({
        title: "Erro ao carregar horários",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    const hoursMap: Record<number, WorkingHour> = {};
    data?.forEach((item) => {
      hoursMap[item.day_of_week] = item;
    });
    setWorkingHours(hoursMap);
  };

  const handleSave = async (dayOfWeek: number) => {
    if (!user) return;

    const currentHour = workingHours[dayOfWeek];
    
    if (!currentHour?.start_time || !currentHour?.end_time) {
      toast({
        title: "Erro",
        description: "Preencha os horários de início e fim",
        variant: "destructive",
      });
      return;
    }

    try {
      if (currentHour.id) {
        const { error } = await supabase
          .from("working_hours")
          .update({
            start_time: currentHour.start_time,
            end_time: currentHour.end_time,
            active: currentHour.active,
          })
          .eq("id", currentHour.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("working_hours")
          .insert([{
            barber_id: user.id,
            day_of_week: dayOfWeek,
            start_time: currentHour.start_time,
            end_time: currentHour.end_time,
            active: currentHour.active,
          }]);

        if (error) throw error;
      }

      toast({
        title: "Horário salvo com sucesso!",
      });

      loadSchedule(user.id);
    } catch (error: any) {
      toast({
        title: "Erro ao salvar horário",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateWorkingHour = (dayOfWeek: number, field: keyof WorkingHour, value: any) => {
    setWorkingHours(prev => ({
      ...prev,
      [dayOfWeek]: {
        ...prev[dayOfWeek],
        [field]: value,
        day_of_week: dayOfWeek,
        id: prev[dayOfWeek]?.id || "",
      } as WorkingHour,
    }));
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

  return (
    <div className="min-h-screen bg-gradient-dark">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">Horários de Funcionamento</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-4">
          {DAYS.map((day, index) => {
            const currentHour = workingHours[index];
            return (
              <Card key={index} className="p-6 border-border bg-card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg">{day}</h3>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`active-${index}`} className="text-sm">
                      {currentHour?.active ? "Ativo" : "Inativo"}
                    </Label>
                    <Switch
                      id={`active-${index}`}
                      checked={currentHour?.active || false}
                      onCheckedChange={(checked) =>
                        updateWorkingHour(index, "active", checked)
                      }
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor={`start-${index}`}>Hora de Início</Label>
                    <Input
                      id={`start-${index}`}
                      type="time"
                      value={currentHour?.start_time || ""}
                      onChange={(e) =>
                        updateWorkingHour(index, "start_time", e.target.value)
                      }
                      disabled={!currentHour?.active}
                    />
                  </div>

                  <div>
                    <Label htmlFor={`end-${index}`}>Hora de Término</Label>
                    <Input
                      id={`end-${index}`}
                      type="time"
                      value={currentHour?.end_time || ""}
                      onChange={(e) =>
                        updateWorkingHour(index, "end_time", e.target.value)
                      }
                      disabled={!currentHour?.active}
                    />
                  </div>

                  <div className="flex items-end">
                    <Button
                      onClick={() => handleSave(index)}
                      className="w-full"
                    >
                      Salvar
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default Schedule;