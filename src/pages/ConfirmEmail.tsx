import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const ConfirmEmail = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkUser = async () => {
      const user = supabase.auth.getUser(); // retorna a info do usuário atual
      if (user) {
        alert("E-mail confirmado! Você pode fazer login agora.");
        navigate("/login");
      } else {
        alert("Não foi possível confirmar o e-mail automaticamente. Tente fazer login.");
        navigate("/login");
      }
    };

    checkUser();
  }, [navigate]);

  return <div>Confirmando e-mail...</div>;
};

export default ConfirmEmail;
