import { appConfig } from "./config.js";
import { fetchJson } from "./utils.js";

export function createLanyardController({ getSubscribedUserIds, onStatusesChange }) {
  const state = {
    ws: null,
    heartbeatInterval: null,
    reconnectTimeout: null,
    statusMap: {}
  };

  function emitStatuses() {
    onStatusesChange({ ...state.statusMap });
  }

  async function fetchLanyardStatus(userId) {
    try {
      const json = await fetchJson(`/api/lanyard/${userId}`);
      return json?.data?.discord_status || "offline";
    } catch (error) {
      console.warn("Nao foi possivel buscar status inicial do Lanyard.", error);
      return "offline";
    }
  }

  function setStatus(userId, status) {
    if (!userId) {
      return;
    }

    state.statusMap[userId] = status || "offline";
    emitStatuses();
  }

  function handlePresencePayload(payload) {
    if (payload?.discord_user?.id) {
      setStatus(payload.discord_user.id, payload.discord_status);
      return;
    }

    if (payload?.id) {
      setStatus(payload.id, payload.discord_status);
    }
  }

  function startHeartbeat(intervalMs) {
    clearInterval(state.heartbeatInterval);
    state.heartbeatInterval = setInterval(() => {
      if (state.ws && state.ws.readyState === WebSocket.OPEN) {
        state.ws.send(JSON.stringify({ op: 3 }));
      }
    }, intervalMs);
  }

  function scheduleReconnect() {
    clearInterval(state.heartbeatInterval);

    if (state.reconnectTimeout) {
      return;
    }

    state.reconnectTimeout = setTimeout(() => {
      state.reconnectTimeout = null;
      connect();
    }, appConfig.lanyardReconnectMs);
  }

  async function bootstrap() {
    const subscribedIds = getSubscribedUserIds();
    if (!subscribedIds.length) {
      return;
    }

    const statuses = await Promise.all(
      subscribedIds.map(async (userId) => [userId, await fetchLanyardStatus(userId)])
    );

    statuses.forEach(([userId, status]) => {
      state.statusMap[userId] = status;
    });

    emitStatuses();
  }

  function connect() {
    const subscribedIds = getSubscribedUserIds();
    if (!subscribedIds.length) {
      return;
    }

    if (state.ws && (state.ws.readyState === WebSocket.OPEN || state.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    state.ws = new WebSocket("wss://api.lanyard.rest/socket");

    state.ws.addEventListener("open", () => {
      state.ws.send(JSON.stringify({
        op: 2,
        d: {
          subscribe_to_ids: subscribedIds
        }
      }));
    });

    state.ws.addEventListener("message", (event) => {
      let payload;

      try {
        payload = JSON.parse(event.data);
      } catch (error) {
        console.warn("Mensagem invalida do Lanyard.", error);
        return;
      }

      if (payload.op === 1 && payload.d?.heartbeat_interval) {
        startHeartbeat(payload.d.heartbeat_interval);
        return;
      }

      if (payload.t === "INIT_STATE") {
        if (Array.isArray(payload.d)) {
          payload.d.forEach(handlePresencePayload);
        } else {
          handlePresencePayload(payload.d);
        }
        return;
      }

      if (payload.t === "PRESENCE_UPDATE") {
        handlePresencePayload(payload.d);
      }
    });

    state.ws.addEventListener("close", scheduleReconnect);
    state.ws.addEventListener("error", () => {
      if (state.ws && state.ws.readyState !== WebSocket.CLOSED) {
        state.ws.close();
      }
    });
  }

  function cleanup() {
    clearInterval(state.heartbeatInterval);
    clearTimeout(state.reconnectTimeout);

    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
      state.ws.close();
    }
  }

  return {
    bootstrap,
    connect,
    cleanup
  };
}
