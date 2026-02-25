import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function UpdatePassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [userLoaded, setUserLoaded] = useState(false);

  useEffect(() => {
    
    async function checkUser() {
      const { data } = await supabase.auth.getUser();

      if (!data?.user) {
        setMessage("Link inválido ou expirado. Solicite a redefinição novamente.");
      } else {
        setUserLoaded(true);
      }
    }

    checkUser();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();

    if (password !== confirm) {
      setMessage("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setMessage("Erro: " + error.message);
    } else {
      setMessage("Senha alterada com sucesso!");
      setTimeout(() => navigate("/login"), 1500);
    }

    setLoading(false);
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md border rounded-lg p-6 shadow">
        <h1 className="text-xl font-bold mb-4">Definir nova senha</h1>

        {!userLoaded ? (
          <p>Validando link...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              placeholder="Nova senha"
              className="w-full border px-3 py-2 rounded"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <input
              type="password"
              placeholder="Confirmar nova senha"
              className="w-full border px-3 py-2 rounded"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded"
            >
              {loading ? "Salvando..." : "Salvar nova senha"}
            </button>

            {message && (
              <p className="text-center text-sm mt-2">{message}</p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
