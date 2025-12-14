import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FeatureGate } from "@/components/FeatureGate";

interface WorkingHour {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  active: boolean;
}

interface Break {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
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
  const [saving, setSaving] = useState(false);
  const [workingHours, setWorkingHours] = useState<Record<number, WorkingHour>>({});
  const [breaks, setBreaks] = useState<Record<number, Break[]>>({});

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
      await loadSchedule(user.id);
      await loadBreaks(user.id);
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

  const loadBreaks = async (userId: string) => {
    // Primeiro, verificar se a tabela existe
    const { data, error } = await supabase
      .from("breaks")
      .select("*")
      .eq("barber_id", userId);

    if (error) {
      console.log("Breaks table might not exist yet:", error);
      return;
    }

    const breaksMap: Record<number, Break[]> = {};
    data?.forEach((item) => {
      if (!breaksMap[item.day_of_week]) {
        breaksMap[item.day_of_week] = [];
      }
      breaksMap[item.day_of_week].push(item);
    });
    setBreaks(breaksMap);
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

  const addBreak = (dayOfWeek: number) => {
    setBreaks(prev => ({
      ...prev,
      [dayOfWeek]: [
        ...(prev[dayOfWeek] || []),
        { 
          id: `temp-${Date.now()}`, 
          day_of_week: dayOfWeek,
          start_time: "", 
          end_time: "" 
        }
      ]
    }));
  };

  const removeBreak = (dayOfWeek: number, breakId: string) => {
    setBreaks(prev => ({
      ...prev,
      [dayOfWeek]: (prev[dayOfWeek] || []).filter(b => b.id !== breakId)
    }));
  };

  const updateBreak = (dayOfWeek: number, breakId: string, field: 'start_time' | 'end_time', value: string) => {
    setBreaks(prev => ({
      ...prev,
      [dayOfWeek]: (prev[dayOfWeek] || []).map(b => 
        b.id === breakId ? { ...b, [field]: value } : b
      )
    }));
  };

  const handleSaveAll = async () => {
    if (!user) return;

    setSaving(true);
    try {
      // Validar todos os horários ativos
      for (const [dayStr, hour] of Object.entries(workingHours)) {
        if (hour.active && (!hour.start_time || !hour.end_time)) {
          toast({
            title: "Erro de validação",
            description: `Preencha os horários de ${DAYS[parseInt(dayStr)]}`,
            variant: "destructive",
          });
          setSaving(false);
          return;
        }

        // Validar intervalos
        const dayBreaks = breaks[parseInt(dayStr)] || [];
        for (const brk of dayBreaks) {
          if (!brk.start_time || !brk.end_time) {
            toast({
              title: "Erro de validação",
              description: `Preencha todos os intervalos de ${DAYS[parseInt(dayStr)]}`,
              variant: "destructive",
            });
            setSaving(false);
            return;
          }
        }
      }

      // Salvar todos os horários
      for (const [dayStr, hour] of Object.entries(workingHours)) {
        if (hour.id) {
          await supabase
            .from("working_hours")
            .update({
              start_time: hour.start_time,
              end_time: hour.end_time,
              active: hour.active,
            })
            .eq("id", hour.id);
        } else if (hour.active) {
          await supabase
            .from("working_hours")
            .insert([{
              barber_id: user.id,
              day_of_week: parseInt(dayStr),
              start_time: hour.start_time,
              end_time: hour.end_time,
              active: hour.active,
            }]);
        }
      }

      // Deletar intervalos antigos e inserir novos
      await supabase
        .from("breaks")
        .delete()
        .eq("barber_id", user.id);

      // Inserir novos intervalos
      for (const [dayStr, dayBreaks] of Object.entries(breaks)) {
        for (const brk of dayBreaks) {
          if (brk.start_time && brk.end_time) {
            await supabase
              .from("breaks")
              .insert({
                barber_id: user.id,
                day_of_week: parseInt(dayStr),
                start_time: brk.start_time,
                end_time: brk.end_time,
              });
          }
        }
      }

      toast({
        title: "Horários salvos com sucesso!",
        description: "Todos os horários e intervalos foram atualizados.",
      });

      await loadSchedule(user.id);
      await loadBreaks(user.id);
    } catch (error: any) {
      toast({
        title: "Erro ao salvar horários",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
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
    <FeatureGate feature="schedule">
    <div className="min-h-screen bg-gradient-dark">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-2xl font-bold">Horários de Funcionamento</h1>
            </div>
            <Button 
              onClick={handleSaveAll} 
              disabled={saving}
              className="shadow-gold"
              size="lg"
            >
              {saving ? "Salvando..." : "Salvar Todos os Horários"}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-4">
          {DAYS.map((day, index) => {
            const currentHour = workingHours[index];
            const dayBreaks = breaks[index] || [];
            
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

                {currentHour?.active && (
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`start-${index}`}>Hora de Início</Label>
                        <Input
                          id={`start-${index}`}
                          type="time"
                          value={currentHour?.start_time || ""}
                          onChange={(e) =>
                            updateWorkingHour(index, "start_time", e.target.value)
                          }
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
                        />
                      </div>
                    </div>

                    {/* Intervalos */}
                    <div className="border-t border-border pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <Label className="text-sm font-semibold">Intervalos (Almoço, Pausas, etc.)</Label>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => addBreak(index)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Adicionar Intervalo
                        </Button>
                      </div>

                      {dayBreaks.length > 0 && (
                        <div className="space-y-3">
                          {dayBreaks.map((brk) => (
                            <div key={brk.id} className="flex gap-2 items-end">
                              <div className="flex-1">
                                <Label className="text-xs">Início do Intervalo</Label>
                                <Input
                                  type="time"
                                  value={brk.start_time}
                                  onChange={(e) =>
                                    updateBreak(index, brk.id, 'start_time', e.target.value)
                                  }
                                />
                              </div>
                              <div className="flex-1">
                                <Label className="text-xs">Fim do Intervalo</Label>
                                <Input
                                  type="time"
                                  value={brk.end_time}
                                  onChange={(e) =>
                                    updateBreak(index, brk.id, 'end_time', e.target.value)
                                  }
                                />
                              </div>
                              <Button
                                type="button"
                                size="icon"
                                variant="destructive"
                                onClick={() => removeBreak(index, brk.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <div className="mt-6 flex justify-end">
          <Button 
            onClick={handleSaveAll} 
            disabled={saving}
            className="shadow-gold"
            size="lg"
          >
            {saving ? "Salvando..." : "Salvar Todos os Horários"}
          </Button>
        </div>
      </main>
    </div>
    </FeatureGate>
  );
};

export default Schedule;