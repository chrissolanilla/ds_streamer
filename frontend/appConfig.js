const USE_NGROK = true;

window.APP_CONFIG = USE_NGROK
    ? {
          // wsBase: "wss://your-ws-domain.ngrok-free.dev",
		  wsBase: "https://determine-ram-cayman-apparently.trycloudflare.com",
          // whepBase: "https://your-whep-domain.ngrok-free.dev",
		  whepBase: "https://remained-uri-muscle-derived.trycloudflare.com",
          streamPath: "ds",
      }
    : {
          wsBase: `ws://${location.hostname}:9001`,
          whepBase: `http://${location.hostname}:8889`,
          streamPath: "ds_opus",
      };
