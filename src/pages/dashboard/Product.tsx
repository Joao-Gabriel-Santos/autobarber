import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2, Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: string;
  name: string;
  price: number;
  amount: number;
  image_url: string | null;
  active: boolean;
}

const Product = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<Product[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    amount: "",
    image_url: ""
  });
  const [uploading, setUploading] = useState(false);

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
      loadServices(user.id);
    } catch (error) {
      console.error("Error:", error);
      navigate("/login");
    } finally {
      setLoading(false);
    }
  };

  const loadServices = async (userId: string) => {
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .eq("barber_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Erro ao carregar serviços",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    // setProduct(data || []);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !user) return;

    const file = e.target.files[0];
    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError, data } = await supabase.storage
        .from("service-images")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("service-images")
        .getPublicUrl(fileName);

      setFormData(prev => ({ ...prev, image_url: publicUrl }));

      toast({
        title: "Imagem enviada com sucesso!",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao enviar imagem",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const serviceData = {
      name: formData.name,
      price: parseFloat(formData.price),
      amount: parseInt(formData.amount),
      image_url: formData.image_url || null,
      barber_id: user.id,
    };

    try {
      if (editingId) {
        const { error } = await supabase
          .from("services")
          .update(serviceData)
          .eq("id", editingId);

        if (error) throw error;

        toast({
          title: "Serviço atualizado com sucesso!",
        });
      } else {
       /* const { error } = await supabase
          .from("services")
          //.insert([serviceData]);

        if (error) throw error;

        toast({
          title: "Serviço criado com sucesso!",
        }); */
      }

      setFormData({ name: "", price: "", amount: "", image_url: "" });
      setEditingId(null);
      loadServices(user.id);
    } catch (error: any) {
      toast({
        title: "Erro ao salvar serviço",
        description: error.message,
        variant: "destructive",
      });
    }
  }; 
  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("services")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Serviço deletado com sucesso!",
      });

      if (user) loadServices(user.id);
    } catch (error: any) {
      toast({
        title: "Erro ao deletar serviço",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (service: Product) => {
    setEditingId(service.id);
    setFormData({
      name: service.name,
      price: service.price.toString(),
      amount: service.amount.toString(),
      image_url: service.image_url || ""
    });
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
            <h1 className="text-2xl font-bold">Meus Produtos</h1>
          </div>
        </div>
      </header>

       <main className="container mx-auto px-4 py-8">
        <Card className="p-6 mb-8 border-border bg-card">
          <h2 className="text-xl font-bold mb-4">
            {editingId ? "Editar Serviço" : "Adicionar Novo Serviço"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nome do Produto</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Corte Degradê"
                  required
                />
              </div>

              <div>
                <Label htmlFor="price">Preço (R$)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="Ex: 35.00"
                  required
                />
              </div>

              <div>
                <Label htmlFor="amount">Quantidade (estoque)</Label>
                <Input
                  id="amount"
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="Ex: 30"
                  required
                />
              </div>

              <div>
                <Label htmlFor="image">Foto do Corte</Label>
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
                    className="mt-2 w-20 h-20 object-cover rounded-lg"
                  />
                )}
                <p className="text-xs text-muted-foreground">Proporção 4:3</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={uploading}>
                {editingId ? "Atualizar" : "Adicionar"}
              </Button>
              {editingId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingId(null);
                    setFormData({ name: "", price: "", amount: "", image_url: "" });
                  }}
                >
                  Cancelar
                </Button>
              )}
            </div>
          </form>
        </Card>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {product.map((service) => (
            <Card key={service.id} className="p-4 border-border bg-card">
              {service.image_url && (
                <img
                  src={service.image_url}
                  alt={service.name}
                  className="w-full h-40 object-cover rounded-lg mb-4"
                />
              )}
              <h3 className="font-bold text-lg mb-2">{service.name}</h3>
              <div className="space-y-1 text-sm text-muted-foreground mb-4">
                <p>R$ {service.price.toFixed(2)}</p>
                <p>Quantidade do estoque: {service.amount}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(service)}
                  className="flex-1"
                >
                  Editar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(service.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {product.length === 0 && (
          <Card className="p-12 text-center border-border bg-card">
            <p className="text-muted-foreground">
              Nenhum Produto cadastrado ainda. Adicione seu primeiro serviço acima!
            </p>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Product;