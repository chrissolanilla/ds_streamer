const USE_NGROK = true;

window.APP_CONFIG = USE_NGROK
    ? {
          // wsBase: "wss://your-ws-domain.ngrok-free.dev",
		  wsBase: "https://fairfield-metal-scanned-national.trycloudflare.com",
          // whepBase: "https://your-whep-domain.ngrok-free.dev",
		  whepBase: "https://contacts-jvc-technician-pounds.trycloudflare.com",
          streamPath: "ds_opus",
      }
    : {
          wsBase: `ws://${location.hostname}:9001`,
          whepBase: `http://${location.hostname}:8889`,
          streamPath: "ds_opus",
      };
