import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Search, Package, AlertTriangle, TrendingUp, TrendingDown,
  History, ChevronDown, ChevronUp, RefreshCw, Filter,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ProductService, Product, StockMovement, StockStats, ProductFilters, Category,
} from "@/services/prodcutService";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STOCK_BADGE: Record<string, { label: string; className: string }> = {
  ok:          { label: "OK",            className: "bg-green-500/10 text-green-400 border-green-500/20" },
  baixo:       { label: "Estoque Baixo", className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  sem_estoque: { label: "Sem Estoque",   className: "bg-red-500/10 text-red-400 border-red-500/20" },
};

const TYPE_LABEL: Record<StockMovement["type"], { label: string; icon: React.ReactNode; color: string }> = {
  entrada: { label: "Entrada", icon: <TrendingUp className="h-3 w-3" />, color: "text-green-400" },
  saida:   { label: "Saída",   icon: <TrendingDown className="h-3 w-3" />, color: "text-red-400" },
  ajuste:  { label: "Ajuste",  icon: <RefreshCw className="h-3 w-3" />,   color: "text-yellow-400" },
};

const formatDate = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    return isValid(d) ? format(d, "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—";
  } catch { return "—"; }
};

const defaultFilters: ProductFilters = {
  search: "", category_id: "", stock_status: "all", active: true,
};

// ─── Modal de movimentação ────────────────────────────────────────────────────

interface MovementModalProps {
  product: Product;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
}

const MovementModal = ({ product, onClose, onSuccess, userId }: MovementModalProps) => {
  const { toast } = useToast();
  const [type,     setType]     = useState<StockMovement["type"]>("entrada");
  const [quantity, setQuantity] = useState("");
  const [reason,   setReason]   = useState("");
  const [saving,   setSaving]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(quantity);
    if (!qty || qty <= 0) {
      toast({ title: "Quantidade inválida", variant: "destructive" });
      return;
    }

    // Validar saída não ultrapassa estoque
    if (type === "saida" && qty > product.amount) {
      toast({ title: "Quantidade maior que o estoque disponível", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await ProductService.addMovement(userId, product.id, type, qty, reason);
      toast({ title: "Movimentação registrada!" });
      onSuccess();
    } catch (err: any) {
      toast({ title: "Erro ao registrar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md p-6 border-border bg-card">
        <h3 className="text-lg font-bold mb-1">Movimentar Estoque</h3>
        <p className="text-sm text-muted-foreground mb-6">{product.name}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Tipo de Movimentação</Label>
            <Select value={type} onValueChange={(v) => setType(v as StockMovement["type"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="entrada">📦 Entrada — adicionar ao estoque</SelectItem>
                <SelectItem value="saida">📤 Saída — retirar do estoque</SelectItem>
                <SelectItem value="ajuste">🔧 Ajuste — corrigir estoque</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="qty">Quantidade</Label>
            <Input
              id="qty"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Ex: 10"
              required
            />
            {type !== "ajuste" && (
              <p className="text-xs text-muted-foreground mt-1">
                Estoque atual: {product.amount} un.
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="reason">Motivo <span className="text-muted-foreground">(opcional)</span></Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Compra fornecedor, Uso interno..."
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving} className="flex-1">
              Registrar
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

// ─── Painel de histórico inline ───────────────────────────────────────────────

interface HistoryPanelProps {
  productId: string;
}

const HistoryPanel = ({ productId }: HistoryPanelProps) => {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    ProductService.listMovements(productId).then((data) => {
      setMovements(data);
      setLoading(false);
    });
  }, [productId]);

  if (loading) {
    return <p className="text-xs text-muted-foreground py-2">Carregando histórico...</p>;
  }

  if (movements.length === 0) {
    return <p className="text-xs text-muted-foreground py-2">Nenhuma movimentação registrada.</p>;
  }

  return (
    <div className="mt-4 space-y-2 border-t border-border pt-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        Histórico recente
      </p>
      {movements.map((m) => {
        const info = TYPE_LABEL[m.type];
        return (
          <div key={m.id} className="flex items-center justify-between text-sm">
            <div className={`flex items-center gap-1.5 ${info.color}`}>
              {info.icon}
              <span>{info.label}</span>
              {m.reason && (
                <span className="text-muted-foreground text-xs">— {m.reason}</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-right">
              <span className={`font-semibold ${info.color}`}>
                {m.quantity > 0 ? "+" : ""}{m.quantity} un.
              </span>
              <span className="text-xs text-muted-foreground">{formatDate(m.created_at)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const Stock = () => {
  const navigate  = useNavigate();
  const { toast } = useToast();

  const [user,       setUser]       = useState<any>(null);
  const [loading,    setLoading]    = useState(true);
  const [products,   setProducts]   = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats,      setStats]      = useState<StockStats | null>(null);

  const [filters,       setFilters]       = useState<ProductFilters>(defaultFilters);
  const [movProduct,    setMovProduct]    = useState<Product | null>(null);
  const [expandedId,    setExpandedId]    = useState<string | null>(null);

  // ── Auth ────────────────────────────────────────────────────────────────────

  useEffect(() => { checkUser(); }, []);
  useEffect(() => { if (user) loadAll(); }, [user, filters]);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "owner") {
        toast({
          title: "Acesso negado",
          description: "Apenas donos podem acessar esta página",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      setUser(user);
    } catch {
      navigate("/login");
    } finally {
      setLoading(false);
    }
  };

  // ── Loaders ─────────────────────────────────────────────────────────────────

  const loadAll = async () => {
    if (!user) return;
    const [prods, cats, st] = await Promise.all([
      ProductService.listProducts(user.id, filters),
      ProductService.listCategories(user.id),
      ProductService.getStats(user.id),
    ]);
    setProducts(prods);
    setCategories(cats);
    setStats(st);
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
      {/* Modal de movimentação */}
      {movProduct && (
        <MovementModal
          product={movProduct}
          userId={user.id}
          onClose={() => setMovProduct(null)}
          onSuccess={() => { setMovProduct(null); loadAll(); }}
        />
      )}

      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Gerenciar Estoque</h1>
              <p className="text-sm text-muted-foreground">
                Movimentações, alertas e histórico de produtos
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl">

        {/* Estatísticas */}
        {stats && (
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            <Card className="p-6 border-border bg-card hover:border-primary/50 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Total de Produtos</span>
                <Package className="h-4 w-4 text-primary" />
              </div>
              <p className="text-3xl font-bold text-primary">{stats.total_produtos}</p>
            </Card>

            <Card className="p-6 border-border bg-card hover:border-primary/50 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Produtos Ativos</span>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </div>
              <p className="text-3xl font-bold text-green-500">{stats.produtos_ativos}</p>
            </Card>

            <Card className="p-6 border-border bg-card hover:border-primary/50 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Estoque Baixo</span>
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              </div>
              <p className="text-3xl font-bold text-yellow-500">{stats.estoque_baixo}</p>
              <p className="text-xs text-muted-foreground mt-1">Abaixo do mínimo</p>
            </Card>

            <Card className="p-6 border-border bg-card hover:border-primary/50 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Sem Estoque</span>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </div>
              <p className="text-3xl font-bold text-red-500">{stats.sem_estoque}</p>
              <p className="text-xs text-muted-foreground mt-1">Quantidade zero</p>
            </Card>
          </div>
        )}

        {/* Filtros */}
        <Card className="p-6 mb-6 border-border bg-card">
          <div className="grid md:grid-cols-4 gap-4">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="pl-10"
              />
            </div>

            <Select
              value={filters.category_id || "all"}
              onValueChange={(v) => setFilters({ ...filters, category_id: v === "all" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Button
                variant={filters.stock_status === "baixo" ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  setFilters({
                    ...filters,
                    stock_status: filters.stock_status === "baixo" ? "all" : "baixo",
                  })
                }
                className="flex-1"
              >
                <AlertTriangle className="h-4 w-4 mr-1" />
                Baixo
              </Button>
              <Button
                variant={filters.stock_status === "sem_estoque" ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  setFilters({
                    ...filters,
                    stock_status: filters.stock_status === "sem_estoque" ? "all" : "sem_estoque",
                  })
                }
                className="flex-1"
              >
                <Filter className="h-4 w-4 mr-1" />
                Zerado
              </Button>
            </div>
          </div>
        </Card>

        {/* Lista de Produtos */}
        <div className="space-y-4">
          {products.length === 0 ? (
            <Card className="p-12 text-center border-border bg-card">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Nenhum produto encontrado com os filtros aplicados.
              </p>
            </Card>
          ) : (
            products.map((p) => {
              const badge     = STOCK_BADGE[p.stock_status];
              const expanded  = expandedId === p.id;

              return (
                <Card
                  key={p.id}
                  className="p-6 border-border bg-card hover:border-primary/50 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Avatar / Imagem */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="h-14 w-14 rounded-lg object-cover border border-border flex-shrink-0"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Package className="h-6 w-6 text-primary" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-lg truncate">{p.name}</h3>
                          <Badge className={badge.className}>{badge.label}</Badge>
                        </div>
                        {p.category_name && (
                          <p className="text-xs text-muted-foreground mb-2">{p.category_name}</p>
                        )}

                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Preço</p>
                            <p className="font-semibold">R$ {p.price.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Estoque Atual</p>
                            <p className={`font-bold text-lg ${
                              p.stock_status === "sem_estoque" ? "text-red-400" :
                              p.stock_status === "baixo"       ? "text-yellow-400" :
                              "text-green-400"
                            }`}>
                              {p.amount} un.
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Mínimo</p>
                            <p className="font-semibold">{p.min_amount} un.</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        onClick={() => setMovProduct(p)}
                        className="whitespace-nowrap"
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Movimentar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedId(expanded ? null : p.id)}
                        className="whitespace-nowrap"
                      >
                        <History className="h-4 w-4 mr-1" />
                        Histórico
                        {expanded
                          ? <ChevronUp className="h-3 w-3 ml-1" />
                          : <ChevronDown className="h-3 w-3 ml-1" />
                        }
                      </Button>
                    </div>
                  </div>

                  {/* Histórico expandido */}
                  {expanded && <HistoryPanel productId={p.id} />}
                </Card>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
};

export default Stock;