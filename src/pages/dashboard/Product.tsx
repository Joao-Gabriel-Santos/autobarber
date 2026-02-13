import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, X, Package, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ProductService, Product, Category } from "@/services/prodcutService";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STOCK_BADGE: Record<string, { label: string; className: string }> = {
  ok:           { label: "OK",           className: "bg-green-500/10 text-green-400 border-green-500/20" },
  baixo:        { label: "Estoque Baixo", className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  sem_estoque:  { label: "Sem Estoque",  className: "bg-red-500/10 text-red-400 border-red-500/20" },
};

const emptyForm = {
  name:        "",
  price:       "",
  amount:      "",
  min_amount:  "5",
  category_id: "",
  image_url:   "",
  active:      true,
};

// ─── Component ────────────────────────────────────────────────────────────────

const ProductPage = () => {
  const navigate    = useNavigate();
  const { toast }   = useToast();

  const [user,       setUser]       = useState<any>(null);
  const [loading,    setLoading]    = useState(true);
  const [uploading,  setUploading]  = useState(false);
  const [saving,     setSaving]     = useState(false);

  const [products,    setProducts]    = useState<Product[]>([]);
  const [categories,  setCategories]  = useState<Category[]>([]);

  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [formData,    setFormData]    = useState(emptyForm);

  // nova categoria inline
  const [newCatName,  setNewCatName]  = useState("");
  const [addingCat,   setAddingCat]   = useState(false);

  // ── Auth ────────────────────────────────────────────────────────────────────

  useEffect(() => { checkUser(); }, []);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }
      setUser(user);
      await loadAll(user.id);
    } catch {
      navigate("/login");
    } finally {
      setLoading(false);
    }
  };

  // ── Loaders ─────────────────────────────────────────────────────────────────

  const loadAll = async (uid: string) => {
    const [prods, cats] = await Promise.all([
      ProductService.listProducts(uid, {
        search: "", category_id: "", stock_status: "all", active: null,
      }),
      ProductService.listCategories(uid),
    ]);
    setProducts(prods);
    setCategories(cats);
  };

  // ── Imagem ──────────────────────────────────────────────────────────────────

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !user) return;
    setUploading(true);
    try {
      const url = await ProductService.uploadImage(user.id, e.target.files[0]);
      setFormData((p) => ({ ...p, image_url: url }));
      toast({ title: "Imagem enviada!" });
    } catch (err: any) {
      toast({ title: "Erro ao enviar imagem", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  // ── Categoria inline ────────────────────────────────────────────────────────

  const handleAddCategory = async () => {
    if (!newCatName.trim() || !user) return;
    setAddingCat(true);
    try {
      const cat = await ProductService.createCategory(user.id, newCatName.trim());
      setCategories((p) => [...p, cat]);
      setFormData((p) => ({ ...p, category_id: cat.id }));
      setNewCatName("");
      toast({ title: "Categoria criada!" });
    } catch (err: any) {
      toast({ title: "Erro ao criar categoria", description: err.message, variant: "destructive" });
    } finally {
      setAddingCat(false);
    }
  };

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    const payload = {
      name:        formData.name,
      price:       parseFloat(formData.price),
      amount:      parseInt(formData.amount),
      min_amount:  parseInt(formData.min_amount),
      category_id: formData.category_id || null,
      image_url:   formData.image_url || null,
      active:      formData.active,
    };

    try {
      if (editingId) {
        await ProductService.updateProduct(editingId, payload);
        toast({ title: "Produto atualizado!" });
      } else {
        await ProductService.createProduct(user.id, payload);
        toast({ title: "Produto criado!" });
      }
      resetForm();
      await loadAll(user.id);
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja excluir este produto?")) return;
    try {
      await ProductService.deleteProduct(id);
      toast({ title: "Produto excluído!" });
      if (user) await loadAll(user.id);
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    }
  };

  // ── Edit ────────────────────────────────────────────────────────────────────

  const handleEdit = (p: Product) => {
    setEditingId(p.id);
    setFormData({
      name:        p.name,
      price:       p.price.toString(),
      amount:      p.amount.toString(),
      min_amount:  p.min_amount.toString(),
      category_id: p.category_id ?? "",
      image_url:   p.image_url ?? "",
      active:      p.active,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData(emptyForm);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

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
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Meus Produtos</h1>
              <p className="text-sm text-muted-foreground">
                Cadastre e gerencie seus produtos
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl">

        {/* Formulário */}
        <Card className="p-6 mb-8 border-border bg-card">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            {editingId ? "Editar Produto" : "Adicionar Novo Produto"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">

              {/* Nome */}
              <div>
                <Label htmlFor="name">Nome do Produto</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Pomada Capilar"
                  required
                />
              </div>

              {/* Preço */}
              <div>
                <Label htmlFor="price">Preço (R$)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="Ex: 35.00"
                  required
                />
              </div>

              {/* Quantidade atual */}
              <div>
                <Label htmlFor="amount">Quantidade em Estoque</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="Ex: 30"
                  required
                />
              </div>

              {/* Mínimo para alerta */}
              <div>
                <Label htmlFor="min_amount">Alerta de Estoque Mínimo</Label>
                <Input
                  id="min_amount"
                  type="number"
                  min="0"
                  value={formData.min_amount}
                  onChange={(e) => setFormData({ ...formData, min_amount: e.target.value })}
                  placeholder="Ex: 5"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Alerta será exibido quando o estoque atingir esse valor
                </p>
              </div>

              {/* Categoria */}
              <div>
                <Label>Categoria</Label>
                <div className="flex gap-2">
                  <Select
                    value={formData.category_id || "none"}
                    onValueChange={(v) => setFormData({ ...formData, category_id: v === "none" ? "" : v })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem categoria</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Criar categoria inline */}
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="Nova categoria..."
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    className="text-sm h-8"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddCategory}
                    disabled={!newCatName.trim() || addingCat}
                    className="h-8 px-3"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Imagem */}
              <div>
                <Label htmlFor="image">Foto do Produto</Label>
                <div className="flex gap-2">
                  <Input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploading}
                  />
                  {formData.image_url && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setFormData({ ...formData, image_url: "" })}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {formData.image_url && (
                  <img
                    src={formData.image_url}
                    alt="Preview"
                    className="mt-2 w-20 h-20 object-cover rounded-lg border border-border"
                  />
                )}
                <p className="text-xs text-muted-foreground mt-1">Proporção recomendada: 4:3</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={uploading || saving}>
                {editingId ? "Atualizar Produto" : "Adicionar Produto"}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
              )}
            </div>
          </form>
        </Card>

        {/* Lista de Produtos */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => {
            const badge = STOCK_BADGE[p.stock_status];
            return (
              <Card key={p.id} className="p-4 border-border bg-card hover:border-primary/50 transition-all">
                {p.image_url && (
                  <img
                    src={p.image_url}
                    alt={p.name}
                    className="w-full h-40 object-cover rounded-lg mb-4"
                  />
                )}

                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-lg leading-tight">{p.name}</h3>
                  <Badge className={badge.className}>{badge.label}</Badge>
                </div>

                {p.category_name && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                    <Tag className="h-3 w-3" />
                    {p.category_name}
                  </p>
                )}

                <div className="space-y-1 text-sm text-muted-foreground mb-4">
                  <p className="font-semibold text-foreground">R$ {p.price.toFixed(2)}</p>
                  <p>Estoque: <span className="font-medium text-foreground">{p.amount}</span> un.</p>
                  <p className="text-xs">Mínimo: {p.min_amount} un.</p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(p)}
                    className="flex-1"
                  >
                    Editar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(p.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        {products.length === 0 && (
          <Card className="p-12 text-center border-border bg-card">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Nenhum produto cadastrado ainda. Adicione seu primeiro produto acima!
            </p>
          </Card>
        )}
      </main>
    </div>
  );
};

export default ProductPage;