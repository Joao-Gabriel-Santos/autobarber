import { supabaseServer  } from '@/lib/supabase/server';
import { Service } from '@/types/service';

export async function getServices(): Promise<Service[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from('services').select('*');

  if (error) throw new Error(error.message);
  return data;
}

export async function getServiceById(id: string): Promise<Service | null> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function createService(payload: Partial<Service>) {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from('services')
    .insert(payload)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateService(id: string, payload: Partial<Service>) {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from('services')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteService(id: string) {
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from('services')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}