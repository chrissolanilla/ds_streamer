(async () => {
  const video = document.getElementById("video");
  const unmuteBtn = document.getElementById("unmute");

  // autoplay policy: start muted, allow tap to unmute
  video.muted = true;
  video.autoplay = true;
  video.playsInline = true;

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
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  pc.ontrack = (e) => {
    video.srcObject = e.streams[0];

    // show "tap for audio" only if audio exists
    const hasAudio = e.streams[0].getAudioTracks().length > 0;
    if (hasAudio) unmuteBtn.classList.remove("hidden");
  };

  pc.oniceconnectionstatechange = () => {
    console.log("ice:", pc.iceConnectionState);
  };

  // IMPORTANT: don’t hardcode 127.0.0.1 if you’ll use it from a phone.
  // Use the same host the page came from:
  const whepBase = `http://${location.hostname}:8889`;
  const streamPath = "ds"; // mediamtx path
  const whepUrl = `${whepBase}/${streamPath}/whep`;

  const offer = await pc.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: true });
  await pc.setLocalDescription(offer);
  await waitIceComplete(pc);

  const res = await fetch(whepUrl, {
    method: "POST",
    headers: { "Content-Type": "application/sdp" },
    body: pc.localDescription.sdp
  });

  const answerSDP = await res.text();
  await pc.setRemoteDescription({ type: "answer", sdp: answerSDP });

  // tap to unmute
  unmuteBtn.addEventListener("click", async () => {
    video.muted = false;
    try { await video.play(); } catch {}
    unmuteBtn.classList.add("hidden");
  });
})();

