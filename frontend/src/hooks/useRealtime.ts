import { useEffect, useRef } from "react";
import { api } from "../lib/api";

type Handler = (tipo: string, dados: any) => void;

/** Conecta ao WebSocket do backend e chama onEvento sempre que um evento chegar. */
export function useRealtime(onEvento: Handler) {
  const handlerRef = useRef(onEvento);
  handlerRef.current = onEvento;

  useEffect(() => {
    const wsUrl = api.baseUrl.replace(/^http/, "ws") + "/ws";
    let socket: WebSocket;
    let reconectarTimeout: ReturnType<typeof setTimeout>;

    function conectar() {
      socket = new WebSocket(wsUrl);
      socket.onmessage = (evento) => {
        try {
          const payload = JSON.parse(evento.data);
          handlerRef.current(payload.tipo, payload.dados);
        } catch {
          // ignora mensagens não-JSON
        }
      };
      socket.onclose = () => {
        reconectarTimeout = setTimeout(conectar, 3000);
      };
    }

    conectar();
    return () => {
      clearTimeout(reconectarTimeout);
      socket?.close();
    };
  }, []);
}
