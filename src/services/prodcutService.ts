import { supabase } from "@/integrations/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
}

export interface Product {
  id: string;
  owner_id: string;
  category_id: string | null;
  category_name?: string;
  name: string;
  price: number;
  amount: number;
  min_amount: number;
  image_url: string | null;
  active: boolean;
  stock_status: "ok" | "baixo" | "sem_estoque";
  created_at: string;
  updated_at: string;
}

export interface StockMovement {
  id: string;
  product_id: string;
  owner_id: string;
  type: "entrada" | "saida" | "ajuste";
  quantity: number;
  reason: string | null;
  created_at: string;
}

export interface ProductFilters {
  search: string;
  category_id: string;
  stock_status: "all" | "ok" | "baixo" | "sem_estoque";
  active: boolean | null;
}

export interface StockStats {
  total_produtos: number;
  produtos_ativos: number;
  estoque_baixo: number;
  sem_estoque: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const ProductService = {
  // ── Categorias ──────────────────────────────────────────────────────────────

  async listCategories(ownerId: string): Promise<Category[]> {
    const { data, error } = await supabase
      .from("product_categories")
      .select("*")
      .eq("owner_id", ownerId)
      .order("name");

    if (error) throw error;
    return data ?? [];
  },

  async createCategory(ownerId: string, name: string): Promise<Category> {
    const { data, error } = await supabase
      .from("product_categories")
      .insert({ owner_id: ownerId, name })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteCategory(id: string): Promise<void> {
    const { error } = await supabase
      .from("product_categories")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  // ── Produtos ─────────────────────────────────────────────────────────────────

  async listProducts(ownerId: string, filters: ProductFilters): Promise<Product[]> {
    let query = supabase
      .from("products_with_alerts")
      .select("*")
      .eq("owner_id", ownerId);

    if (filters.search) {
      query = query.ilike("name", `%${filters.search}%`);
    }
    if (filters.category_id) {
      query = query.eq("category_id", filters.category_id);
    }
    if (filters.stock_status !== "all") {
      query = query.eq("stock_status", filters.stock_status);
    }
    if (filters.active !== null) {
      query = query.eq("active", filters.active);
    }

    query = query.order("name");

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as Product[];
  },

  async createProduct(
    ownerId: string,
    payload: Omit<Product, "id" | "owner_id" | "stock_status" | "category_name" | "created_at" | "updated_at">
  ): Promise<Product> {
    const { data, error } = await supabase
      .from("products")
      .insert({ ...payload, owner_id: ownerId })
      .select()
      .single();

    if (error) throw error;
    return data as Product;
  },

  async updateProduct(id: string, payload: Partial<Product>): Promise<void> {
    const { error } = await supabase
      .from("products")
      .update(payload)
      .eq("id", id);

    if (error) throw error;
  },

  async deleteProduct(id: string): Promise<void> {
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  // ── Estatísticas ─────────────────────────────────────────────────────────────

  async getStats(ownerId: string): Promise<StockStats> {
    const { data, error } = await supabase
      .from("products_with_alerts")
      .select("active, stock_status")
      .eq("owner_id", ownerId);

    if (error) throw error;

    const rows = data ?? [];
    return {
      total_produtos:   rows.length,
      produtos_ativos:  rows.filter((r) => r.active).length,
      estoque_baixo:    rows.filter((r) => r.stock_status === "baixo").length,
      sem_estoque:      rows.filter((r) => r.stock_status === "sem_estoque").length,
    };
  },

  // ── Movimentação de estoque ──────────────────────────────────────────────────

  async addMovement(
    ownerId: string,
    productId: string,
    type: StockMovement["type"],
    quantity: number,
    reason?: string
  ): Promise<void> {
    // Para saída, quantidade deve ser negativa internamente
    const finalQty = type === "saida" ? -Math.abs(quantity) : Math.abs(quantity);

    const { error } = await supabase
      .from("stock_movements")
      .insert({
        owner_id:   ownerId,
        product_id: productId,
        type,
        quantity:   finalQty,
        reason:     reason ?? null,
      });

    if (error) throw error;
  },

  async listMovements(productId: string, limit = 20): Promise<StockMovement[]> {
    const { data, error } = await supabase
      .from("stock_movements")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []) as StockMovement[];
  },

  // ── Upload de imagem ─────────────────────────────────────────────────────────

  async uploadImage(ownerId: string, file: File): Promise<string> {
    const ext      = file.name.split(".").pop();
    const fileName = `${ownerId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from("product-images")
      .getPublicUrl(fileName);

    return publicUrl;
  },
};