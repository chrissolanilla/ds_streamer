#include "App.h"
#include <chrono>
#include <thread>
#include <cstdint>
#include <string_view>
#include <cstdlib>
#include <iostream>
#include <cstring>

#ifdef _WIN32
    #include <windows.h>
    static HANDLE serialHandle = INVALID_HANDLE_VALUE;
#else
    #include <fcntl.h>
    #include <unistd.h>
    #include <termios.h>
    static int serialFd = -1;
#endif

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


// open the serial port to the arduino
static bool openSerial(const char *portName) {
#ifdef _WIN32
    serialHandle = CreateFileA(
        portName,
        GENERIC_READ | GENERIC_WRITE,
        0,
        nullptr,
        OPEN_EXISTING,
        0,
        nullptr
    );

    if (serialHandle == INVALID_HANDLE_VALUE) {
        std::cerr << "failed to open serial port: " << portName << "\n";
        return false;
    }

    DCB dcbSerialParams = {0};
    dcbSerialParams.DCBlength = sizeof(dcbSerialParams);

    if (!GetCommState(serialHandle, &dcbSerialParams)) {
        std::cerr << "GetCommState failed\n";
        CloseHandle(serialHandle);
        serialHandle = INVALID_HANDLE_VALUE;
        return false;
    }

    dcbSerialParams.BaudRate = CBR_115200;
    dcbSerialParams.ByteSize = 8;
    dcbSerialParams.StopBits = ONESTOPBIT;
    dcbSerialParams.Parity = NOPARITY;

    if (!SetCommState(serialHandle, &dcbSerialParams)) {
        std::cerr << "SetCommState failed\n";
        CloseHandle(serialHandle);
        serialHandle = INVALID_HANDLE_VALUE;
        return false;
    }

    return true;
#else
    serialFd = open(portName, O_RDWR | O_NOCTTY | O_SYNC);
    if (serialFd < 0) {
        std::cerr << "failed to open serial port: " << portName << "\n";
        return false;
    }

    struct termios tty;
    std::memset(&tty, 0, sizeof(tty));

    if (tcgetattr(serialFd, &tty) != 0) {
        std::cerr << "tcgetattr failed\n";
        close(serialFd);
        serialFd = -1;
        return false;
    }

    cfsetospeed(&tty, B115200);
    cfsetispeed(&tty, B115200);

    tty.c_cflag = (tty.c_cflag & ~CSIZE) | CS8;
    tty.c_iflag = 0;
    tty.c_oflag = 0;
    tty.c_lflag = 0;

    tty.c_cflag |= (CLOCAL | CREAD);
    tty.c_cflag &= ~(PARENB | PARODD);
    tty.c_cflag &= ~CSTOPB;
    tty.c_cflag &= ~CRTSCTS;

    tty.c_cc[VMIN] = 0;
    tty.c_cc[VTIME] = 1;

    if (tcsetattr(serialFd, TCSANOW, &tty) != 0) {
        std::cerr << "tcsetattr failed\n";
        close(serialFd);
        serialFd = -1;
        return false;
    }

    return true;
#endif
}

// send exactly 2 bytes: low byte first, then high byte
static void sendSerialMask(uint16_t mask) {
    uint8_t bytes[2];
    bytes[0] = (uint8_t)(mask & 0xFF);
    bytes[1] = (uint8_t)((mask >> 8) & 0xFF);

#ifdef _WIN32
    if (serialHandle == INVALID_HANDLE_VALUE) {
        return;
    }

    DWORD written = 0;
    if (!WriteFile(serialHandle, bytes, 2, &written, nullptr) || written != 2) {
        std::cerr << "failed to write serial bytes\n";
    }
#else
    if (serialFd < 0) {
        return;
    }

    ssize_t written = write(serialFd, bytes, 2);
    if (written != 2) {
        std::cerr << "failed to write serial bytes\n";
    }
#endif
}

static void closeSerial() {
#ifdef _WIN32
    if (serialHandle != INVALID_HANDLE_VALUE) {
        CloseHandle(serialHandle);
        serialHandle = INVALID_HANDLE_VALUE;
    }
#else
    if (serialFd >= 0) {
        close(serialFd);
        serialFd = -1;
    }
#endif
}


int main(void) {
    const int port = 9001;
    const uint64_t DEADMAN_MS = 300;
    (void)DEADMAN_MS;

#ifdef _WIN32
    const char *serialPort = "COM3";
#else
    const char *serialPort = "/dev/ttyACM0";
#endif

    if (!openSerial(serialPort)) {
        std::cerr << "warning: arduino serial not opened\n";
    } else {
        std::cout << "opened serial port " << serialPort << "\n";
		std::this_thread::sleep_for(std::chrono::seconds(2));
		sendSerialMask(1);
		std::cout << "sent test mask 1\n";
		std::this_thread::sleep_for(std::chrono::seconds(1));
		sendSerialMask(0);
		std::cout << "sent test mask 0\n";
    }


    uWS::App().ws<PerSocketData>("/*", {
        .compression = uWS::DISABLED,
        .maxPayloadLength = 1024,
        .idleTimeout = 0,

        .open = [](auto *ws) {
            ws->getUserData()->lastMs = nowMs();
            ws->getUserData()->lastMask = 0;
            std::cout << "client connected\n";
        },

        .message = [](auto *ws, std::string_view msg, uWS::OpCode op) {
            auto *d = ws->getUserData();
            d->lastMs = nowMs();
            uint32_t mask = 0;

            if (op == uWS::OpCode::BINARY) {
                if (msg.size() != 2) {
                    std::cout << "message size is not 2 bytes!\n";
                    return;
                }

                const uint8_t b0 = (uint8_t)msg[0];
                const uint8_t b1 = (uint8_t)msg[1];
                mask = (uint32_t)b0 | ((uint32_t)b1 << 8);
            } else {
                if (!parseMask(msg, mask)) {
                    return;
                }
            }

            if (mask != d->lastMask) {
                d->lastMask = mask;
                std::cout << "mask = " << mask << "\n";
                sendSerialMask((uint16_t)mask);
            }
        },

        .close = [](auto *ws, int, std::string_view) {
            auto *d = ws->getUserData();
            d->lastMask = 0;
            std::cout << "client disconnected: release(mask=0)\n";
            sendSerialMask(0);
        }
    })
    .listen(port, [port](auto *listenSocket) {
        if (listenSocket) {
            std::cout << "ws server listening on port " << port << "\n";
        } else {
            std::cerr << "failed to listen on port " << port << "\n";
            std::exit(1);
        }
    })
    .run();

    closeSerial();
    return 0;
}
