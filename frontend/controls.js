//load config from appConfig
// const APP_CONFIG = window.APP_CONFIG ?? {
//     wsBase: `ws://${location.hostname}:9001`,
//     whepBase: `http://${location.hostname}:8889`,
//     streamPath: "ds",
// };
const APP_CONFIG = window.APP_CONFIG ?? {
    wsBase: `ws://${location.hostname}:9001`,
    whepBase: `http://${location.hostname}:8889`,
    streamPath: "ds",
};

const videoEl = document.getElementById("video");
const unmuteBtn = document.getElementById("unmute");
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// const debugMediaBtn = document.getElementById("debug-media");
const forceUnmuteBtn = document.getElementById("force-unmute");
const streamVolumeSlider = document.getElementById("stream-volume");

const streamAudioEl = document.getElementById("stream-audio");

let currentStream = null;

function debugLog(...args) {
    console.log(...args);

    let box = document.getElementById("debug-log");
    if (!box) {
        box = document.createElement("pre");
        box.id = "debug-log";
        box.style.position = "fixed";
        box.style.left = "0";
        box.style.right = "0";
        box.style.bottom = "0";
        box.style.maxHeight = "35vh";
        box.style.overflow = "auto";
        box.style.margin = "0";
        box.style.padding = "8px";
        box.style.background = "rgba(0,0,0,0.85)";
        box.style.color = "#0f0";
        box.style.fontSize = "12px";
        box.style.zIndex = "99999";
        box.style.whiteSpace = "pre-wrap";
        document.body.appendChild(box);
    }

    box.textContent += args.map(String).join(" ") + "\n";
}

//webrtc
(async () => {
    videoEl.muted = true;
    videoEl.volume = 1.0;
    videoEl.autoplay = true;
    videoEl.playsInline = true;

    function waitIceComplete(pc) {
        if (pc.iceGatheringState === "complete") return Promise.resolve();
        return new Promise((resolve) => {
            const check = () => {
                if (pc.iceGatheringState === "complete") {
                    pc.removeEventListener("icegatheringstatechange", check);
                    resolve();
                }
            };
            pc.addEventListener("icegatheringstatechange", check);
        });
    }

    const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    const whepUrl = `${APP_CONFIG.whepBase}/${APP_CONFIG.streamPath}/whep`;


	pc.ontrack = (e) => {
		const stream = e.streams[0];
		currentStream = stream;
		videoEl.srcObject = stream;

		const audioTracks = stream.getAudioTracks();
		const videoTracks = stream.getVideoTracks();

		console.log("audio tracks", audioTracks, "video tracks", videoTracks);
		console.log("video muted:", videoEl.muted);
		console.log("video volume:", videoEl.volume);

		if (audioTracks[0]) {
			audioTracks[0].onmute = () => console.log("remote audio track muted");
			audioTracks[0].onunmute = () => console.log("remote audio track unmuted");
			audioTracks[0].onended = () => console.log("remote audio track ended");
		}

		if (audioTracks.length > 0 && unmuteBtn) {
			unmuteBtn.classList.remove("hidden");
		}

		streamAudioEl.srcObject = stream;
		streamAudioEl.muted = false;
		streamAudioEl.volume = 1.0;
		streamAudioEl.play().catch((err) => {
			console.log("audio element play failed", err);
		});
	};
    // pc.ontrack = (e) => {
    //     const stream = e.streams[0];
    //     videoEl.srcObject = stream;
    //
    //     const audioTracks = stream.getAudioTracks();
    //     const videoTracks = stream.getVideoTracks();
    //
    //     console.log("audio tracks", audioTracks, "video tracks", videoTracks);
    //     console.log("video muted:", videoEl.muted);
    //     console.log("video volume:", videoEl.volume);
    //
    //     if (audioTracks.length > 0 && unmuteBtn) {
    //         unmuteBtn.classList.remove("hidden");
    //     }
    // };

    pc.oniceconnectionstatechange = () => {
        console.log("webrtc ice:", pc.iceConnectionState);
    };

    const offer = await pc.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: true,
    });

    await pc.setLocalDescription(offer);
    await waitIceComplete(pc);

    const res = await fetch(whepUrl, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: pc.localDescription.sdp,
    });

    const answerSDP = await res.text();
    await pc.setRemoteDescription({ type: "answer", sdp: answerSDP });

    if (unmuteBtn) {
        unmuteBtn.addEventListener("click", async () => {
            videoEl.muted = false;
            videoEl.volume = 1.0;

            try {
                await videoEl.play();
            } catch {}

            try {
                await audioCtx.resume();
            } catch {}

            unmuteBtn.classList.add("hidden");
        });
    }
})().catch(console.error);

function logMediaState() {
    console.log("videoEl.paused:", videoEl.paused);
    console.log("videoEl.muted:", videoEl.muted);
    console.log("videoEl.volume:", videoEl.volume);
    console.log("videoEl.readyState:", videoEl.readyState);
    console.log("videoEl.currentTime:", videoEl.currentTime);
    console.log("videoEl.srcObject:", videoEl.srcObject);

    if (currentStream) {
        const audioTracks = currentStream.getAudioTracks();
        const videoTracks = currentStream.getVideoTracks();

        console.log("stream audio track count:", audioTracks.length);
        console.log("stream video track count:", videoTracks.length);

        audioTracks.forEach((t, i) => {
            console.log(`audio[${i}] enabled=${t.enabled} muted=${t.muted} readyState=${t.readyState}`);
        });

        videoTracks.forEach((t, i) => {
            console.log(`video[${i}] enabled=${t.enabled} muted=${t.muted} readyState=${t.readyState}`);
        });
    } else {
        console.log("currentStream is null");
    }
}

// if (debugMediaBtn) {
//     debugMediaBtn.addEventListener("click", () => {
//         logMediaState();
//     });
// }

if (forceUnmuteBtn) {
    forceUnmuteBtn.addEventListener("click", async () => {
        videoEl.muted = false;
        videoEl.volume = 1.0;

        try {
            await audioCtx.resume();
        } catch {}

        try {
            await videoEl.play();
        } catch (err) {
            console.log("video play failed", err);
        }

        logMediaState();
    });
}

if (streamVolumeSlider) {
    streamVolumeSlider.addEventListener("input", () => {
        videoEl.volume = Number(streamVolumeSlider.value);
        console.log("stream volume set to", videoEl.volume);
    });
}
// (async () => {
//     const video = document.getElementById("video");
//     const unmuteBtn = document.getElementById("unmute");
//
//     //autoplay stared mutd
//     video.muted = true;
//     video.autoplay = true;
//     video.playsInline = true;
//
//     function waitIceComplete(pc) {
//         if (pc.iceGatheringState === "complete") return Promise.resolve();
//         return new Promise((resolve) => {
//             const check = () => {
//                 if (pc.iceGatheringState === "complete") {
//                     pc.removeEventListener("icegatheringstatechange", check);
//                     resolve();
//                 }
//             };
//             pc.addEventListener("icegatheringstatechange", check);
//         });
//     }
//
//     const pc = new RTCPeerConnection({
//         iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
//     });
// 	// const pc = new RTCPeerConnection({
// 	// 	iceServers: [
// 	// 		{ urls: "stun:stun.l.google.com:19302" },
// 	// 		{
// 	// 			urls: "turn:103.124.104.244:3478",
// 	// 			username: "user",
// 	// 			credential: "dssecret"
// 	// 		}
// 	// 	]
// 	// });
//
// 	const whepUrl = `${APP_CONFIG.whepBase}/${APP_CONFIG.streamPath}/whep`;
// 	// debugLog("whep url:", whepUrl);
//     pc.ontrack = (e) => {
//         const stream = e.streams[0];
// 		// debugLog("ontrack fired, tracks:", stream.getTracks().length);
//         video.srcObject = stream;
//
//         const hasAudio = stream.getAudioTracks().length > 0;
//         if (hasAudio) unmuteBtn?.classList.remove("hidden");
//
// 		const audioTracks = stream.getAudioTracks();
//         const videoTracks = stream.getVideoTracks();
// 		console.log("audio tracks", audioTracks, "video tracks", videoTracks);
// 		console.log("video muted: ", video.muted);
// 		console.log("video volume: ", video.volume);
//     };
//
//     pc.oniceconnectionstatechange = () => {
//         console.log("webrtc ice:", pc.iceConnectionState);
// 		// debugLog("ice connection state:", pc.iceConnectionState);
//     };
//
// 	pc.onconnectionstatechange = () => {
// 		// debugLog("peer connection state:", pc.connectionState);
// 	};
//
// 	pc.onicegatheringstatechange = () => {
// 		// debugLog("ice gathering state:", pc.iceGatheringState);
// 	};
//
//     // prob dont start with that on the phone irl
//     // const whepBase = `http://${location.hostname}:8889`;
//     // const streamPath = "ds";
//     // const whepUrl = `${whepBase}/${streamPath}/whep`;
// 	//
//
//     const offer = await pc.createOffer({
//         offerToReceiveVideo: true,
//         offerToReceiveAudio: true,
//     });
//     await pc.setLocalDescription(offer);
//     await waitIceComplete(pc);
// 	// debugLog("local description is ready");
//
//     const res = await fetch(whepUrl, {
//         method: "POST",
//         headers: { "Content-Type": "application/sdp" },
//         body: pc.localDescription.sdp,
//     });
//
// 	// debugLog("whep response status:", res.status);
//
//
//     const answerSDP = await res.text();
//
// 	// debugLog("answer sdp length:", answerSDP.length);
// 	// debugLog("answer sdp preview:", answerSDP.slice(0, 1200));
//     await pc.setRemoteDescription({ type: "answer", sdp: answerSDP });
//
// 	// debugLog("remote description set");
//     //ujnmute
//     if (unmuteBtn) {
//         unmuteBtn.addEventListener("click", async () => {
//             video.muted = false;
//             try {
//                 await video.play();
//             } catch {}
//             unmuteBtn.classList.add("hidden");
//         });
//     }
// })().catch(console.error);

//same controls
// const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const soundBuffers = new Map();

async function loadSound(name, url) {
    const res = await fetch(url);
    const arr = await res.arrayBuffer();
    const buf = await audioCtx.decodeAudioData(arr);
    soundBuffers.set(name, buf);
}

function playSound(name, { volume = 0.6 } = {}) {
    const buf = soundBuffers.get(name);
    if (!buf) return;
    if (audioCtx.state !== "running") audioCtx.resume();

    const src = audioCtx.createBufferSource();
    src.buffer = buf;

    const gain = audioCtx.createGain();
    gain.gain.value = volume;

    src.connect(gain);
    gain.connect(audioCtx.destination);
    src.start(0);
}

Promise.all([
    loadSound("a", "sounds/plink.mp3"),
    loadSound("b", "sounds/shiny-pokemon.mp3"),
    loadSound("start", "sounds/pokemon-battle.mp3"),
    loadSound("select", "sounds/quien.mp3"),
]).catch(console.error);

const dpad = document.querySelector(".dpad");
const leftButton = document.getElementById("left");
const rightButton = document.getElementById("right");
const upButton = document.getElementById("up");
const downButton = document.getElementById("down");

const aButton = document.getElementById("a");
const bButton = document.getElementById("b");
const xButton = document.getElementById("x");
const yButton = document.getElementById("y");
const startButton = document.getElementById("start");
const selectButton = document.getElementById("select");
const rButton = document.getElementById("r");
const lButton = document.getElementById("l");

let held = {
    left: false,
    right: false,
    up: false,
    down: false,
    a: false,
    b: false,
    x: false,
    y: false,
    start: false,
    select: false,
    l: false,
    r: false,
};

function clearHeld() {
    held.left = held.right = held.up = held.down = false;
}

function setHeld(dir) {
    clearHeld();
    if (dir) held[dir] = true;
}

function directionFromPoint(clientX, clientY) {
    const r = dpad.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;

    const deadZone = Math.min(r.width, r.height) * 0.12;
    if (Math.hypot(dx, dy) < deadZone) return null;

    if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? "left" : "right";
    return dy < 0 ? "up" : "down";
}

function endDpad(e) {
    if (dpad.hasPointerCapture(e.pointerId))
        dpad.releasePointerCapture(e.pointerId);
    clearHeld();
    sendState(true);
}

//good for no scrolls
document
    .querySelectorAll(".dpad button, .ab button, .meta button, .bumpers button")
    .forEach((btn) => {
        btn.addEventListener("contextmenu", (e) => e.preventDefault());
    });

dpad.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    dpad.setPointerCapture(e.pointerId);
    setHeld(directionFromPoint(e.clientX, e.clientY));
    sendState(true);
});

dpad.addEventListener("pointermove", (e) => {
    if (!dpad.hasPointerCapture(e.pointerId)) return;
    e.preventDefault();
    setHeld(directionFromPoint(e.clientX, e.clientY));
    sendState(false);
});

dpad.addEventListener("pointerup", endDpad);
dpad.addEventListener("pointercancel", endDpad);

function bindHold(btn, key) {
    btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        held[key] = true;
        sendState(true);
    });
    btn.addEventListener("pointerup", (e) => {
        e.preventDefault();
        held[key] = false;
        sendState(true);
    });
    btn.addEventListener("pointercancel", () => {
        held[key] = false;
        sendState(true);
    });
    btn.addEventListener("pointerleave", () => {
        held[key] = false;
        sendState(true);
    });
}

function bindHoldFlag(btn, flagName) {
    btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        held[flagName] = true;
        sendState(true);
    });
    btn.addEventListener("pointerup", (e) => {
        e.preventDefault();
        held[flagName] = false;
        sendState(true);
    });
    btn.addEventListener("pointercancel", () => {
        held[flagName] = false;
        sendState(true);
    });
    btn.addEventListener("pointerleave", () => {
        held[flagName] = false;
        sendState(true);
    });
}

bindHold(leftButton, "left");
bindHold(rightButton, "right");
bindHold(upButton, "up");
bindHold(downButton, "down");

bindHoldFlag(aButton, "a");
bindHoldFlag(bButton, "b");
bindHoldFlag(xButton, "x");
bindHoldFlag(yButton, "y");
bindHoldFlag(startButton, "start");
bindHoldFlag(selectButton, "select");
bindHoldFlag(rButton, "r");
bindHoldFlag(lButton, "l");

function onPress(btn, soundName) {
    btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        playSound(soundName);
    });
}
onPress(aButton, "a");
onPress(bButton, "b");
onPress(startButton, "start");
onPress(selectButton, "select");

// const ws = new WebSocket(`ws://${location.hostname}:9001`);
// const ws = new WebSocket(APP_CONFIG.wsBase);
let ws = null;
// let ws = null;

function connectWS() {
    ws = new WebSocket(APP_CONFIG.wsBase);

    ws.addEventListener("open", () => {
        console.log("ws connected");
        sendState(true);
    });

    ws.addEventListener("close", () => {
        console.log("ws closed");
        setTimeout(connectWS, 1500);
    });

    ws.addEventListener("error", () => {
        console.log("ws error");
        ws.close();
    });
}

connectWS();
// ws.addEventListener("open", () => console.log("ws connected"));
// ws.addEventListener("close", () => console.log("ws closed"));
// ws.addEventListener("error", () => console.log("ws error"));

const BTN = {
    B: 1 << 0,
    Y: 1 << 1,
    SELECT: 1 << 2,
    START: 1 << 3,
    UP: 1 << 4,
    DOWN: 1 << 5,
    LEFT: 1 << 6,
    RIGHT: 1 << 7,
    A: 1 << 8,
    X: 1 << 9,
    L: 1 << 10,
    R: 1 << 11,
};

function computeMask() {
    let m = 0;
    if (held.up) m |= BTN.UP;
    if (held.down) m |= BTN.DOWN;
    if (held.left) m |= BTN.LEFT;
    if (held.right) m |= BTN.RIGHT;
    if (held.a) m |= BTN.A;
    if (held.b) m |= BTN.B;
    if (held.x) m |= BTN.X;
    if (held.y) m |= BTN.Y;
    if (held.l) m |= BTN.L;
    if (held.r) m |= BTN.R;
    if (held.start) m |= BTN.START;
    if (held.select) m |= BTN.SELECT;
    return m;
}

let lastSentMask = -1;

function sendState(force = false) {
    if (ws.readyState !== WebSocket.OPEN) return;
    const mask = computeMask();
    if (!force && mask === lastSentMask) return;

    lastSentMask = mask;

    //ts lil endian
    const buf = new ArrayBuffer(2);
    new DataView(buf).setUint16(0, lastSentMask, true);
    ws.send(buf);
}

setInterval(() => sendState(false), 1000 / 60);

function unlockMedia() {
    videoEl.muted = false;
    videoEl.volume = 1.0;
    videoEl.play().catch(() => {});
    audioCtx.resume().catch(() => {});

    document.removeEventListener("pointerdown", unlockMedia);
}

document.addEventListener("pointerdown", unlockMedia, { once: true });

setInterval(() => {
    sendState(true);
}, 10000);
