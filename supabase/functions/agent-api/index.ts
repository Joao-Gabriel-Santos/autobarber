import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Autenticação via API Key simples
  const apiKey = req.headers.get("x-api-key");
  if (apiKey !== Deno.env.get("AGENT_API_KEY")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! // service role para acesso total
  );

  const url = new URL(req.url);
  const path = url.pathname.replace("/agent-api", "");
  const barbershopId = url.searchParams.get("barbershop_id");

  try {
    // GET /appointments
    if (path === "/appointments" && req.method === "GET") {
      const date = url.searchParams.get("date"); // YYYY-MM-DD
      const status = url.searchParams.get("status");

      let query = supabase
        .from("appointments")
        .select("id, appointment_date, appointment_time, client_name, client_whatsapp, status, price, services(name)")
        .eq("barber_id", barbershopId)
        .order("appointment_date", { ascending: true })
        .order("appointment_time", { ascending: true });

      if (date) query = query.eq("appointment_date", date);
      if (status) query = query.eq("status", status);

      const { data, error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({ appointments: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /appointments/today
    if (path === "/appointments/today" && req.method === "GET") {
      const today = new Date().toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("appointments")
        .select("id, appointment_date, appointment_time, client_name, client_whatsapp, status, price, services(name)")
        .eq("barber_id", barbershopId)
        .eq("appointment_date", today)
        .order("appointment_time", { ascending: true });

      if (error) throw error;

      return new Response(JSON.stringify({ date: today, appointments: data, total: data.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PATCH /appointments/:id/status
    if (path.match(/^\/appointments\/[^/]+\/status$/) && req.method === "PATCH") {
      const id = path.split("/")[2];
      const body = await req.json();
      const { status } = body; // confirmed | completed | cancelled

      const validStatuses = ["confirmed", "completed", "cancelled"];
      if (!validStatuses.includes(status)) {
        return new Response(JSON.stringify({ error: "Invalid status" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("appointments")
        .update({ status })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ appointment: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /clients
    if (path === "/clients" && req.method === "GET") {
      const search = url.searchParams.get("search");

      let query = supabase
        .from("clients")
        .select("id, nome, whatsapp, data_nascimento, data_ultimo_corte, total_cortes")
        .eq("barbershop_id", barbershopId)
        .order("nome", { ascending: true });

      if (search) {
        query = query.or(`nome.ilike.%${search}%,whatsapp.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({ clients: data, total: data.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /available-slots
    if (path === "/available-slots" && req.method === "GET") {
      const date = url.searchParams.get("date"); // YYYY-MM-DD
      const barberId = url.searchParams.get("barber_id") || barbershopId;
      const duration = parseInt(url.searchParams.get("duration") || "30");

      if (!date) {
        return new Response(JSON.stringify({ error: "date is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const dayOfWeek = new Date(date + "T12:00:00").getDay();

      const { data: workingHour } = await supabase
        .from("working_hours")
        .select("start_time, end_time")
        .eq("barber_id", barberId)
        .eq("day_of_week", dayOfWeek)
        .eq("active", true)
        .maybeSingle();

      if (!workingHour) {
        return new Response(JSON.stringify({ date, available_slots: [], message: "Closed on this day" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: existingApts } = await supabase
        .from("appointments")
        .select("appointment_time, services(duration)")
        .eq("barber_id", barberId)
        .eq("appointment_date", date)
        .in("status", ["pending", "confirmed"]);

      // Calcular slots ocupados
      const occupiedMinutes = new Set<number>();
      existingApts?.forEach((apt: any) => {
        const [h, m] = apt.appointment_time.split(":").map(Number);
        const start = h * 60 + m;
        const dur = apt.services?.duration || 30;
        for (let i = 0; i < dur; i++) occupiedMinutes.add(start + i);
      });

      // Gerar slots disponíveis
      const [sh, sm] = workingHour.start_time.split(":").map(Number);
      const [eh, em] = workingHour.end_time.split(":").map(Number);
      let current = sh * 60 + sm;
      const end = eh * 60 + em;
      const slots: string[] = [];

      while (current + duration <= end) {
        let available = true;
        for (let i = 0; i < duration; i++) {
          if (occupiedMinutes.has(current + i)) { available = false; break; }
        }
        if (available) {
          slots.push(
            `${Math.floor(current / 60).toString().padStart(2, "0")}:${(current % 60).toString().padStart(2, "0")}`
          );
        }
        current += 15;
      }

      return new Response(JSON.stringify({ date, available_slots: slots }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /appointments
    if (path === "/appointments" && req.method === "POST") {
      const body = await req.json();
      const { barber_id, service_id, date, time, client_name, client_whatsapp, price } = body;

      const { data, error } = await supabase
        .from("appointments")
        .insert({
          barber_id: barber_id || barbershopId,
          service_id,
          appointment_date: date,
          appointment_time: time,
          client_name,
          client_whatsapp,
          price,
          status: "confirmed",
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ appointment: data }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /services
    if (path === "/services" && req.method === "GET") {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, price, duration")
        .eq("barber_id", barbershopId)
        .eq("active", true);

      if (error) throw error;

      return new Response(JSON.stringify({ services: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Route not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});