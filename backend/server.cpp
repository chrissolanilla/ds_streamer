#include "App.h"
#include <chrono>
#include <cstdint>
#include <string_view>
#include <cstdlib>
#include <iostream>

struct PerSocketData {
    uint32_t lastMask = 0;
    uint64_t lastMs = 0;
};

static uint64_t nowMs() {
    using namespace std::chrono;
    return duration_cast<milliseconds>(
        steady_clock::now().time_since_epoch()
    ).count();
}

static bool parseMask(std::string_view s, uint32_t &outMask){
    //TODO, replace auto with std::string_view::size_type maybe
    auto pos = s.find("\"mask\"");
    if(pos == std::string_view::npos) return false;
    pos = s.find(':', pos);
    if(pos == std::string_view::npos) return false;
    pos++;
    //we skip spaces
    while(pos< s.size() && (s[pos] == ' ' || s[pos] == '\t')){
        pos++;
    }
    uint32_t val = 0;
    //any seen digit
    bool sawDigit = false;
    while(pos< s.size() && (s[pos] >= '0' && s[pos] <= '9')){
        sawDigit = true;
        val = val * 10 +(uint32_t)(s[pos] - '0');
        pos++;
    }
    if(!sawDigit){
        return false;
    }
    outMask = val;
    return true;
}

int main(void){
    const int port = 9001; //not sure about this port number tbh
    //release threshold if no updates within 300ms.
    //TODO playaround with this
    const uint64_t DEADMAN_MS = 300;

    uWS::App().ws<PerSocketData>("/*", {
            .compression = uWS::DISABLED,
            .maxPayloadLength = 1024,
            .idleTimeout = 0, //handled by own deadman?
            //a lambda here is kind of crazy, idk about auto
            //auto type is uWS::WebSocket<false, true, PerSocketData>* ws
            .open = [](auto *ws){
                    ws->getUserData()->lastMs = nowMs();
                    ws->getUserData()->lastMask = 0;
                    std::cout << "client connected\n";
                },
            .message = [](auto *ws, std::string_view msg, uWS::OpCode){
                    //OpCode? what in the assembly
                    uint32_t mask;
                    if(!parseMask(msg, mask)){
                        return;
                    }
                    auto *d = ws->getUserData();
                    d->lastMs = nowMs();
                    if(mask != d->lastMask){
                        //idk why we do this tbh, if its wrong then make it right. i guess rollback? or state correction
                        d->lastMask = mask;
                        std::cout << "mask = " << mask << "\n";
                        //TODO: send the serial mask to the PCB sendSerial(mask);
                    }
                },
            .close = [](auto *ws, int, std::string_view){//yo passing int?!
                    //TODO: make the param int code, but we dont do anythign with it
                    auto *d = ws->getUserData();
                    d->lastMask = 0;
                    std::cout << "client disconnected: release(mask=0)\n";
                    //TODO: sendSerial(0); ig for disconnect or something idk
                }
            })
            //idk why .listen and .run() ar purple, maybe some syntax error
            .listen(port, [port](auto *listenSocket){
                        if(listenSocket){
                            std::cout << "ws server listenning on port " << port << "\n";
                        }
                        else {
                        std::cerr << "failed to listen on port " << port << "\n";
                        std::exit(1);
                        }
                    })
            .run();

    return 0;
}
