import { useEffect, useState } from "react";

/** Lê/persiste a preferência de tema e aplica a classe "dark" no <html>. */
export function useTheme() {
  const [escuro, setEscuro] = useState(true);

  useEffect(() => {
    const salvo = localStorage.getItem("inframonitor_tema");
    const claro = salvo === "light";
    setEscuro(!claro);
    document.documentElement.classList.toggle("dark", !claro);
  }, []);

  function definirTema(novoEscuro: boolean) {
    setEscuro(novoEscuro);
    document.documentElement.classList.toggle("dark", novoEscuro);
    localStorage.setItem("inframonitor_tema", novoEscuro ? "dark" : "light");
  }

  return { escuro, definirTema };
}
