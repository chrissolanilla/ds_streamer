// ----- CONFIG -----
const APP_CONFIG = window.APP_CONFIG ?? {
    wsBase: `ws://${location.hostname}:9001`,
    whepBase: `http://${location.hostname}:8889`,
    streamPath: "ds",
};

// ----- ELEMENTS -----
const videoEl = document.getElementById("video");
const unmuteBtn = document.getElementById("unmute");
const forceUnmuteBtn = document.getElementById("force-unmute");
const streamVolumeSlider = document.getElementById("stream-volume");
const streamAudioEl = document.getElementById("stream-audio");
const playButton = document.getElementById("play-stream");

// ----- AUDIO -----
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
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

// Load button sounds
Promise.all([
    loadSound("a", "sounds/plink.mp3"),
    loadSound("b", "sounds/shiny-pokemon.mp3"),
    loadSound("start", "sounds/pokemon-battle.mp3"),
    loadSound("select", "sounds/quien.mp3"),
]).catch(console.error);

// ----- DEBUG LOG -----
function debugLog(...args) {
    console.log(...args);
    let box = document.getElementById("debug-log");
    if (!box) {
        box = document.createElement("pre");
        box.id = "debug-log";
        Object.assign(box.style, {
            position: "fixed", left: 0, right: 0, bottom: 0,
            maxHeight: "35vh", overflow: "auto",
            margin: 0, padding: "8px", background: "rgba(0,0,0,0.85)",
            color: "#0f0", fontSize: "12px", zIndex: "99999", whiteSpace: "pre-wrap"
        });
        document.body.appendChild(box);
    }
    box.textContent += args.map(String).join(" ") + "\n";
}

// ----- WEBRTC -----
let currentStream = null;
let userInteracted = false;

(async function initWebRTC() {
    videoEl.muted = true;
    videoEl.volume = 1.0;
    videoEl.autoplay = true;
    videoEl.playsInline = true;

    function waitIceComplete(pc) {
        if (pc.iceGatheringState === "complete") return Promise.resolve();
        return new Promise(resolve => {
            const check = () => {
                if (pc.iceGatheringState === "complete") {
                    pc.removeEventListener("icegatheringstatechange", check);
                    resolve();
                }
            };
            pc.addEventListener("icegatheringstatechange", check);
        });
    }

    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    const whepUrl = `${APP_CONFIG.whepBase}/${APP_CONFIG.streamPath}/whep`;

    pc.ontrack = (e) => {
        const stream = e.streams[0];
        currentStream = stream;
        videoEl.srcObject = stream;
        streamAudioEl.srcObject = stream;

        const audioTracks = stream.getAudioTracks();
        audioTracks.forEach((t,i) => {
            t.onmute = () => debugLog(`audio[${i}] muted`);
            t.onunmute = () => debugLog(`audio[${i}] unmuted`);
            t.onended = () => debugLog(`audio[${i}] ended`);
        });

        if (audioTracks.length > 0 && unmuteBtn) unmuteBtn.classList.remove("hidden");

        // iOS autoplay hack: defer playback if user tapped
        if (userInteracted) requestAnimationFrame(attemptPlay);
    };

    pc.oniceconnectionstatechange = () => debugLog("ICE state:", pc.iceConnectionState);

    const offer = await pc.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: true });
    await pc.setLocalDescription(offer);
    await waitIceComplete(pc);

    const res = await fetch(whepUrl, { method: "POST", headers: { "Content-Type": "application/sdp" }, body: pc.localDescription.sdp });
    const answerSDP = await res.text();
    await pc.setRemoteDescription({ type: "answer", sdp: answerSDP });

    // Unmute buttons
    unmuteBtn?.addEventListener("click", attemptPlay);
    forceUnmuteBtn?.addEventListener("click", attemptPlay);

})().catch(console.error);

function attemptPlay() {
    videoEl.muted = false;
    videoEl.volume = 1.0;
    videoEl.play().catch(err => debugLog("Video play failed:", err));
    audioCtx.resume().catch(() => {});
    //playButton?.style.display = "none";
    if (playButton) {
    	playButton.style.display = "none";
	}
}

// iOS unlock on first interaction
document.addEventListener("pointerdown", () => { userInteracted=true; attemptPlay(); }, { once: true });

// Volume slider
streamVolumeSlider?.addEventListener("input", () => {
    videoEl.volume = Number(streamVolumeSlider.value);
    debugLog("Volume set to", videoEl.volume);
});

// ----- CONTROLLER BUTTONS -----
const dpad = document.querySelector(".dpad");
const btnMap = {
    left: document.getElementById("left"),
    right: document.getElementById("right"),
    up: document.getElementById("up"),
    down: document.getElementById("down"),
    a: document.getElementById("a"),
    b: document.getElementById("b"),
    x: document.getElementById("x"),
    y: document.getElementById("y"),
    start: document.getElementById("start"),
    select: document.getElementById("select"),
    l: document.getElementById("l"),
    r: document.getElementById("r")
};

let held = { left:false,right:false,up:false,down:false,a:false,b:false,x:false,y:false,start:false,select:false,l:false,r:false };

function clearHeld() { Object.keys(held).forEach(k=>held[k]=false); }
function setHeld(dir) { clearHeld(); if(dir) held[dir]=true; }
function directionFromPoint(x,y){
    const r=dpad.getBoundingClientRect();
    const cx=r.left+r.width/2,cy=r.top+r.height/2;
    const dx=x-cx,dy=y-cy;
    const deadZone=Math.min(r.width,r.height)*0.12;
    if(Math.hypot(dx,dy)<deadZone) return null;
    return Math.abs(dx)>Math.abs(dy)?(dx<0?"left":"right"):(dy<0?"up":"down");
}

function endDpad(e){ if(dpad.hasPointerCapture(e.pointerId)) dpad.releasePointerCapture(e.pointerId); clearHeld(); sendState(true); }

dpad.addEventListener("pointerdown", e=>{ e.preventDefault(); dpad.setPointerCapture(e.pointerId); setHeld(directionFromPoint(e.clientX,e.clientY)); sendState(true); });
dpad.addEventListener("pointermove", e=>{ if(!dpad.hasPointerCapture(e.pointerId)) return; e.preventDefault(); setHeld(directionFromPoint(e.clientX,e.clientY)); sendState(false); });
dpad.addEventListener("pointerup", endDpad);
dpad.addEventListener("pointercancel", endDpad);

function bindHold(btn,key){ ["pointerdown","pointerup","pointercancel","pointerleave"].forEach(ev=>{
    btn.addEventListener(ev,e=>{ e.preventDefault(); held[key]=ev==="pointerdown"; sendState(true); });
}); }

Object.entries(btnMap).forEach(([k,btn])=>bindHold(btn,k));

["a","b","start","select"].forEach(k=>{ btnMap[k]?.addEventListener("pointerdown",()=>playSound(k)); });

// ----- WEBSOCKET -----
let ws = null;
function connectWS(){
    ws=new WebSocket(APP_CONFIG.wsBase);
    ws.addEventListener("open", ()=>sendState(true));
    ws.addEventListener("close", ()=>setTimeout(connectWS,1500));
    ws.addEventListener("error", ()=>ws.close());
}
connectWS();

const BTN = { B:1<<0,Y:1<<1,SELECT:1<<2,START:1<<3,UP:1<<4,DOWN:1<<5,LEFT:1<<6,RIGHT:1<<7,A:1<<8,X:1<<9,L:1<<10,R:1<<11 };
let lastSentMask=-1;
function computeMask(){
    let m=0; if(held.up)m|=BTN.UP; if(held.down)m|=BTN.DOWN; if(held.left)m|=BTN.LEFT; if(held.right)m|=BTN.RIGHT;
    if(held.a)m|=BTN.A; if(held.b)m|=BTN.B; if(held.x)m|=BTN.X; if(held.y)m|=BTN.Y; if(held.l)m|=BTN.L;
    if(held.r)m|=BTN.R; if(held.start)m|=BTN.START; if(held.select)m|=BTN.SELECT; return m;
}
function sendState(force=false){
    if(!ws || ws.readyState!==WebSocket.OPEN) return;
    const mask=computeMask();
    if(!force && mask===lastSentMask) return;
    lastSentMask=mask;
    const buf=new ArrayBuffer(2);
    new DataView(buf).setUint16(0,lastSentMask,true);
    ws.send(buf);
}
setInterval(()=>sendState(false),1000/60);
setInterval(()=>sendState(true),10000);

// ----- PLAY BUTTON -----

playButton?.addEventListener("click", async () => {
    try {
        userInteracted = true;

        // Attach current stream if already exists
        if (currentStream) {
            videoEl.srcObject = currentStream;
            streamAudioEl.srcObject = currentStream;
        }

        videoEl.muted = false;
        videoEl.volume = 1.0;
        streamAudioEl.muted = false;
        streamAudioEl.volume = 1.0;

        await videoEl.play();
        await streamAudioEl.play();
        await audioCtx.resume();

        playButton.style.display = "none";

        debugLog("Playback started on iOS!");
    } catch (err) {
        debugLog("iOS playback failed", err);
    }
});
////load config from appConfig
//// const APP_CONFIG = window.APP_CONFIG ?? {
////     wsBase: `ws://${location.hostname}:9001`,
////     whepBase: `http://${location.hostname}:8889`,
////     streamPath: "ds",
//// };
//const APP_CONFIG = window.APP_CONFIG ?? {
//    wsBase: `ws://${location.hostname}:9001`,
//    whepBase: `http://${location.hostname}:8889`,
//    streamPath: "ds",
//};
//
//const videoEl = document.getElementById("video");
//const unmuteBtn = document.getElementById("unmute");
//const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
//
//// const debugMediaBtn = document.getElementById("debug-media");
//const forceUnmuteBtn = document.getElementById("force-unmute");
//const streamVolumeSlider = document.getElementById("stream-volume");
//
//const streamAudioEl = document.getElementById("stream-audio");
//
//let currentStream = null;
//
//function debugLog(...args) {
//    console.log(...args);
//
//    let box = document.getElementById("debug-log");
//    if (!box) {
//        box = document.createElement("pre");
//        box.id = "debug-log";
//        box.style.position = "fixed";
//        box.style.left = "0";
//        box.style.right = "0";
//        box.style.bottom = "0";
//        box.style.maxHeight = "35vh";
//        box.style.overflow = "auto";
//        box.style.margin = "0";
//        box.style.padding = "8px";
//        box.style.background = "rgba(0,0,0,0.85)";
//        box.style.color = "#0f0";
//        box.style.fontSize = "12px";
//        box.style.zIndex = "99999";
//        box.style.whiteSpace = "pre-wrap";
//        document.body.appendChild(box);
//    }
//
//    box.textContent += args.map(String).join(" ") + "\n";
//}
//
////webrtc
//(async () => {
//    videoEl.muted = true;
//    videoEl.volume = 1.0;
//    videoEl.autoplay = true;
//    videoEl.playsInline = true;
//
//    function waitIceComplete(pc) {
//        if (pc.iceGatheringState === "complete") return Promise.resolve();
//        return new Promise((resolve) => {
//            const check = () => {
//                if (pc.iceGatheringState === "complete") {
//                    pc.removeEventListener("icegatheringstatechange", check);
//                    resolve();
//                }
//            };
//            pc.addEventListener("icegatheringstatechange", check);
//        });
//    }
//
//    const pc = new RTCPeerConnection({
//        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
//    });
//
//    const whepUrl = `${APP_CONFIG.whepBase}/${APP_CONFIG.streamPath}/whep`;
//
//
//	pc.ontrack = (e) => {
//		const stream = e.streams[0];
//		currentStream = stream;
//		videoEl.srcObject = stream;
//
//		const audioTracks = stream.getAudioTracks();
//		const videoTracks = stream.getVideoTracks();
//
//		console.log("audio tracks", audioTracks, "video tracks", videoTracks);
//		console.log("video muted:", videoEl.muted);
//		console.log("video volume:", videoEl.volume);
//
//		if (audioTracks[0]) {
//			audioTracks[0].onmute = () => console.log("remote audio track muted");
//			audioTracks[0].onunmute = () => console.log("remote audio track unmuted");
//			audioTracks[0].onended = () => console.log("remote audio track ended");
//		}
//
//		if (audioTracks.length > 0 && unmuteBtn) {
//			unmuteBtn.classList.remove("hidden");
//		}
//
//		streamAudioEl.srcObject = stream;
//		streamAudioEl.muted = false;
//		streamAudioEl.volume = 1.0;
//		streamAudioEl.play().catch((err) => {
//			console.log("audio element play failed", err);
//		});
//	};
//    // pc.ontrack = (e) => {
//    //     const stream = e.streams[0];
//    //     videoEl.srcObject = stream;
//    //
//    //     const audioTracks = stream.getAudioTracks();
//    //     const videoTracks = stream.getVideoTracks();
//    //
//    //     console.log("audio tracks", audioTracks, "video tracks", videoTracks);
//    //     console.log("video muted:", videoEl.muted);
//    //     console.log("video volume:", videoEl.volume);
//    //
//    //     if (audioTracks.length > 0 && unmuteBtn) {
//    //         unmuteBtn.classList.remove("hidden");
//    //     }
//    // };
//
//    pc.oniceconnectionstatechange = () => {
//        console.log("webrtc ice:", pc.iceConnectionState);
//    };
//
//    const offer = await pc.createOffer({
//        offerToReceiveVideo: true,
//        offerToReceiveAudio: true,
//    });
//
//    await pc.setLocalDescription(offer);
//    await waitIceComplete(pc);
//
//    const res = await fetch(whepUrl, {
//        method: "POST",
//        headers: { "Content-Type": "application/sdp" },
//        body: pc.localDescription.sdp,
//    });
//
//    const answerSDP = await res.text();
//    await pc.setRemoteDescription({ type: "answer", sdp: answerSDP });
//
//    if (unmuteBtn) {
//        unmuteBtn.addEventListener("click", async () => {
//            videoEl.muted = false;
//            videoEl.volume = 1.0;
//
//            try {
//                await videoEl.play();
//            } catch {}
//
//            try {
//                await audioCtx.resume();
//            } catch {}
//
//            unmuteBtn.classList.add("hidden");
//        });
//    }
//})().catch(console.error);
//
//function logMediaState() {
//    console.log("videoEl.paused:", videoEl.paused);
//    console.log("videoEl.muted:", videoEl.muted);
//    console.log("videoEl.volume:", videoEl.volume);
//    console.log("videoEl.readyState:", videoEl.readyState);
//    console.log("videoEl.currentTime:", videoEl.currentTime);
//    console.log("videoEl.srcObject:", videoEl.srcObject);
//
//    if (currentStream) {
//        const audioTracks = currentStream.getAudioTracks();
//        const videoTracks = currentStream.getVideoTracks();
//
//        console.log("stream audio track count:", audioTracks.length);
//        console.log("stream video track count:", videoTracks.length);
//
//        audioTracks.forEach((t, i) => {
//            console.log(`audio[${i}] enabled=${t.enabled} muted=${t.muted} readyState=${t.readyState}`);
//        });
//
//        videoTracks.forEach((t, i) => {
//            console.log(`video[${i}] enabled=${t.enabled} muted=${t.muted} readyState=${t.readyState}`);
//        });
//    } else {
//        console.log("currentStream is null");
//    }
//}
//
//// if (debugMediaBtn) {
////     debugMediaBtn.addEventListener("click", () => {
////         logMediaState();
////     });
//// }
//
//if (forceUnmuteBtn) {
//    forceUnmuteBtn.addEventListener("click", async () => {
//        videoEl.muted = false;
//        videoEl.volume = 1.0;
//
//        try {
//            await audioCtx.resume();
//        } catch {}
//
//        try {
//            await videoEl.play();
//        } catch (err) {
//            console.log("video play failed", err);
//        }
//
//        logMediaState();
//    });
//}
//
//if (streamVolumeSlider) {
//    streamVolumeSlider.addEventListener("input", () => {
//        videoEl.volume = Number(streamVolumeSlider.value);
//        console.log("stream volume set to", videoEl.volume);
//    });
//}
//// (async () => {
////     const video = document.getElementById("video");
////     const unmuteBtn = document.getElementById("unmute");
////
////     //autoplay stared mutd
////     video.muted = true;
////     video.autoplay = true;
////     video.playsInline = true;
////
////     function waitIceComplete(pc) {
////         if (pc.iceGatheringState === "complete") return Promise.resolve();
////         return new Promise((resolve) => {
////             const check = () => {
////                 if (pc.iceGatheringState === "complete") {
////                     pc.removeEventListener("icegatheringstatechange", check);
////                     resolve();
////                 }
////             };
////             pc.addEventListener("icegatheringstatechange", check);
////         });
////     }
////
////     const pc = new RTCPeerConnection({
////         iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
////     });
//// 	// const pc = new RTCPeerConnection({
//// 	// 	iceServers: [
//// 	// 		{ urls: "stun:stun.l.google.com:19302" },
//// 	// 		{
//// 	// 			urls: "turn:103.124.104.244:3478",
//// 	// 			username: "user",
//// 	// 			credential: "dssecret"
//// 	// 		}
//// 	// 	]
//// 	// });
////
//// 	const whepUrl = `${APP_CONFIG.whepBase}/${APP_CONFIG.streamPath}/whep`;
//// 	// debugLog("whep url:", whepUrl);
////     pc.ontrack = (e) => {
////         const stream = e.streams[0];
//// 		// debugLog("ontrack fired, tracks:", stream.getTracks().length);
////         video.srcObject = stream;
////
////         const hasAudio = stream.getAudioTracks().length > 0;
////         if (hasAudio) unmuteBtn?.classList.remove("hidden");
////
//// 		const audioTracks = stream.getAudioTracks();
////         const videoTracks = stream.getVideoTracks();
//// 		console.log("audio tracks", audioTracks, "video tracks", videoTracks);
//// 		console.log("video muted: ", video.muted);
//// 		console.log("video volume: ", video.volume);
////     };
////
////     pc.oniceconnectionstatechange = () => {
////         console.log("webrtc ice:", pc.iceConnectionState);
//// 		// debugLog("ice connection state:", pc.iceConnectionState);
////     };
////
//// 	pc.onconnectionstatechange = () => {
//// 		// debugLog("peer connection state:", pc.connectionState);
//// 	};
////
//// 	pc.onicegatheringstatechange = () => {
//// 		// debugLog("ice gathering state:", pc.iceGatheringState);
//// 	};
////
////     // prob dont start with that on the phone irl
////     // const whepBase = `http://${location.hostname}:8889`;
////     // const streamPath = "ds";
////     // const whepUrl = `${whepBase}/${streamPath}/whep`;
//// 	//
////
////     const offer = await pc.createOffer({
////         offerToReceiveVideo: true,
////         offerToReceiveAudio: true,
////     });
////     await pc.setLocalDescription(offer);
////     await waitIceComplete(pc);
//// 	// debugLog("local description is ready");
////
////     const res = await fetch(whepUrl, {
////         method: "POST",
////         headers: { "Content-Type": "application/sdp" },
////         body: pc.localDescription.sdp,
////     });
////
//// 	// debugLog("whep response status:", res.status);
////
////
////     const answerSDP = await res.text();
////
//// 	// debugLog("answer sdp length:", answerSDP.length);
//// 	// debugLog("answer sdp preview:", answerSDP.slice(0, 1200));
////     await pc.setRemoteDescription({ type: "answer", sdp: answerSDP });
////
//// 	// debugLog("remote description set");
////     //ujnmute
////     if (unmuteBtn) {
////         unmuteBtn.addEventListener("click", async () => {
////             video.muted = false;
////             try {
////                 await video.play();
////             } catch {}
////             unmuteBtn.classList.add("hidden");
////         });
////     }
//// })().catch(console.error);
//
////same controls
//// const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
//const soundBuffers = new Map();
//
//async function loadSound(name, url) {
//    const res = await fetch(url);
//    const arr = await res.arrayBuffer();
//    const buf = await audioCtx.decodeAudioData(arr);
//    soundBuffers.set(name, buf);
//}
//
//function playSound(name, { volume = 0.6 } = {}) {
//    const buf = soundBuffers.get(name);
//    if (!buf) return;
//    if (audioCtx.state !== "running") audioCtx.resume();
//
//    const src = audioCtx.createBufferSource();
//    src.buffer = buf;
//
//    const gain = audioCtx.createGain();
//    gain.gain.value = volume;
//
//    src.connect(gain);
//    gain.connect(audioCtx.destination);
//    src.start(0);
//}
//
//Promise.all([
//    loadSound("a", "sounds/plink.mp3"),
//    loadSound("b", "sounds/shiny-pokemon.mp3"),
//    loadSound("start", "sounds/pokemon-battle.mp3"),
//    loadSound("select", "sounds/quien.mp3"),
//]).catch(console.error);
//
//const dpad = document.querySelector(".dpad");
//const leftButton = document.getElementById("left");
//const rightButton = document.getElementById("right");
//const upButton = document.getElementById("up");
//const downButton = document.getElementById("down");
//
//const aButton = document.getElementById("a");
//const bButton = document.getElementById("b");
//const xButton = document.getElementById("x");
//const yButton = document.getElementById("y");
//const startButton = document.getElementById("start");
//const selectButton = document.getElementById("select");
//const rButton = document.getElementById("r");
//const lButton = document.getElementById("l");
//
//let held = {
//    left: false,
//    right: false,
//    up: false,
//    down: false,
//    a: false,
//    b: false,
//    x: false,
//    y: false,
//    start: false,
//    select: false,
//    l: false,
//    r: false,
//};
//
//function clearHeld() {
//    held.left = held.right = held.up = held.down = false;
//}
//
//function setHeld(dir) {
//    clearHeld();
//    if (dir) held[dir] = true;
//}
//
//function directionFromPoint(clientX, clientY) {
//    const r = dpad.getBoundingClientRect();
//    const cx = r.left + r.width / 2;
//    const cy = r.top + r.height / 2;
//    const dx = clientX - cx;
//    const dy = clientY - cy;
//
//    const deadZone = Math.min(r.width, r.height) * 0.12;
//    if (Math.hypot(dx, dy) < deadZone) return null;
//
//    if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? "left" : "right";
//    return dy < 0 ? "up" : "down";
//}
//
//function endDpad(e) {
//    if (dpad.hasPointerCapture(e.pointerId))
//        dpad.releasePointerCapture(e.pointerId);
//    clearHeld();
//    sendState(true);
//}
//
////good for no scrolls
//document
//    .querySelectorAll(".dpad button, .ab button, .meta button, .bumpers button")
//    .forEach((btn) => {
//        btn.addEventListener("contextmenu", (e) => e.preventDefault());
//    });
//
//dpad.addEventListener("pointerdown", (e) => {
//    e.preventDefault();
//    dpad.setPointerCapture(e.pointerId);
//    setHeld(directionFromPoint(e.clientX, e.clientY));
//    sendState(true);
//});
//
//dpad.addEventListener("pointermove", (e) => {
//    if (!dpad.hasPointerCapture(e.pointerId)) return;
//    e.preventDefault();
//    setHeld(directionFromPoint(e.clientX, e.clientY));
//    sendState(false);
//});
//
//dpad.addEventListener("pointerup", endDpad);
//dpad.addEventListener("pointercancel", endDpad);
//
//function bindHold(btn, key) {
//    btn.addEventListener("pointerdown", (e) => {
//        e.preventDefault();
//        held[key] = true;
//        sendState(true);
//    });
//    btn.addEventListener("pointerup", (e) => {
//        e.preventDefault();
//        held[key] = false;
//        sendState(true);
//    });
//    btn.addEventListener("pointercancel", () => {
//        held[key] = false;
//        sendState(true);
//    });
//    btn.addEventListener("pointerleave", () => {
//        held[key] = false;
//        sendState(true);
//    });
//}
//
//function bindHoldFlag(btn, flagName) {
//    btn.addEventListener("pointerdown", (e) => {
//        e.preventDefault();
//        held[flagName] = true;
//        sendState(true);
//    });
//    btn.addEventListener("pointerup", (e) => {
//        e.preventDefault();
//        held[flagName] = false;
//        sendState(true);
//    });
//    btn.addEventListener("pointercancel", () => {
//        held[flagName] = false;
//        sendState(true);
//    });
//    btn.addEventListener("pointerleave", () => {
//        held[flagName] = false;
//        sendState(true);
//    });
//}
//
//bindHold(leftButton, "left");
//bindHold(rightButton, "right");
//bindHold(upButton, "up");
//bindHold(downButton, "down");
//
//bindHoldFlag(aButton, "a");
//bindHoldFlag(bButton, "b");
//bindHoldFlag(xButton, "x");
//bindHoldFlag(yButton, "y");
//bindHoldFlag(startButton, "start");
//bindHoldFlag(selectButton, "select");
//bindHoldFlag(rButton, "r");
//bindHoldFlag(lButton, "l");
//
//function onPress(btn, soundName) {
//    btn.addEventListener("pointerdown", (e) => {
//        e.preventDefault();
//        playSound(soundName);
//    });
//}
//onPress(aButton, "a");
//onPress(bButton, "b");
//onPress(startButton, "start");
//onPress(selectButton, "select");
//
//// const ws = new WebSocket(`ws://${location.hostname}:9001`);
//// const ws = new WebSocket(APP_CONFIG.wsBase);
//let ws = null;
//// let ws = null;
//
//function connectWS() {
//    ws = new WebSocket(APP_CONFIG.wsBase);
//
//    ws.addEventListener("open", () => {
//        console.log("ws connected");
//        sendState(true);
//    });
//
//    ws.addEventListener("close", () => {
//        console.log("ws closed");
//        setTimeout(connectWS, 1500);
//    });
//
//    ws.addEventListener("error", () => {
//        console.log("ws error");
//        ws.close();
//    });
//}
//
//connectWS();
//// ws.addEventListener("open", () => console.log("ws connected"));
//// ws.addEventListener("close", () => console.log("ws closed"));
//// ws.addEventListener("error", () => console.log("ws error"));
//
//const BTN = {
//    B: 1 << 0,
//    Y: 1 << 1,
//    SELECT: 1 << 2,
//    START: 1 << 3,
//    UP: 1 << 4,
//    DOWN: 1 << 5,
//    LEFT: 1 << 6,
//    RIGHT: 1 << 7,
//    A: 1 << 8,
//    X: 1 << 9,
//    L: 1 << 10,
//    R: 1 << 11,
//};
//
//function computeMask() {
//    let m = 0;
//    if (held.up) m |= BTN.UP;
//    if (held.down) m |= BTN.DOWN;
//    if (held.left) m |= BTN.LEFT;
//    if (held.right) m |= BTN.RIGHT;
//    if (held.a) m |= BTN.A;
//    if (held.b) m |= BTN.B;
//    if (held.x) m |= BTN.X;
//    if (held.y) m |= BTN.Y;
//    if (held.l) m |= BTN.L;
//    if (held.r) m |= BTN.R;
//    if (held.start) m |= BTN.START;
//    if (held.select) m |= BTN.SELECT;
//    return m;
//}
//
//let lastSentMask = -1;
//
//function sendState(force = false) {
//    if (ws.readyState !== WebSocket.OPEN) return;
//    const mask = computeMask();
//    if (!force && mask === lastSentMask) return;
//
//    lastSentMask = mask;
//
//    //ts lil endian
//    const buf = new ArrayBuffer(2);
//    new DataView(buf).setUint16(0, lastSentMask, true);
//    ws.send(buf);
//}
//
//setInterval(() => sendState(false), 1000 / 60);
//
//function unlockMedia() {
//    videoEl.muted = false;
//    videoEl.volume = 1.0;
//    videoEl.play().catch(() => {});
//    audioCtx.resume().catch(() => {});
//
//    document.removeEventListener("pointerdown", unlockMedia);
//}
//
//document.addEventListener("pointerdown", unlockMedia, { once: true });
//
//setInterval(() => {
//    sendState(true);
//}, 10000);
//
//let userInteracted = false;
//const playButton = document.getElementById("play-stream");
//playButton.addEventListener("click", async () => {
//    try {
//        videoEl.muted = false;
//        videoEl.volume = 1.0;
//        await videoEl.play();
//        await audioCtx.resume();
//        playButton.style.display = "none";
//    } catch (err) {
//        console.log("Failed to play video", err);
//    }
//});
////const playButton = document.getElementById("play-stream");
////
////playButton.addEventListener("click", () => {
////    userInteracted = true;
////    // Try to play immediately if stream is already attached
////    if (videoEl.srcObject) {
////        attemptPlay();
////    }
////});
//
//pc.ontrack = (e) => {
//    const stream = e.streams[0];
//    currentStream = stream;
//    videoEl.srcObject = stream;
//    streamAudioEl.srcObject = stream;
//
//    // Only attempt play if user tapped already
//    if (userInteracted) {
//        // iOS timing hack: defer slightly
//        requestAnimationFrame(() => attemptPlay());
//    }
//};
//
//function attemptPlay() {
//    videoEl.muted = false;
//    videoEl.volume = 1.0;
//    videoEl.play().then(() => {
//        playButton.style.display = "none";
//        console.log("Playback started!");
//    }).catch((err) => {
//        console.log("Video play failed:", err);
//    });
//
//    audioCtx.resume().catch(() => {});
//}
//
////const playStreamBtn = document.getElementById("play-stream");
////
////if (playStreamBtn) {
////    playStreamBtn.addEventListener("click", async () => {
////        try {
////            videoEl.muted = false; // optional if audio exists
////            videoEl.volume = 1.0;
////
////            await videoEl.play(); 
////            await audioCtx.resume(); // resume audio context if you use it
////
////            playStreamBtn.style.display = "none"; // hide button after play
////            console.log("Stream started by user interaction");
////        } catch (err) {
////            console.log("Failed to play video", err);
////        }
////    });
////}
