# WIP
Remote Control of DS hardware via web that is mobile friendly

# How to run
You will need mediaMTX installed, and configure OBS accordingly.
for obs go to settings-> stream: service should be custom
    stream key: ds
    server: rtmp://127.0.0.1:1935
obs output settings:
    audio encoder: libfdk AAC
    video encoder Nvidia NVENC H.264
    rescale ouput: disabled, 1920x1080
    Encoder settings:
        constant bitrate
        bitrate: 10000kbps
        keyframe interval: 0s
        preset: P5 slow good quality
        tuning: high quality
        multipass mode: two passes quarter res
        profile: high
        B-Frames: 0 THIS IS THE MOST IMPORTANT SETTING



if you nodejs installed:
```
npx serve frontend/.
```

For running the backend server:
```
at repo root:
git clone --recurse-submodules <repo>
cd server
make
./server
```
