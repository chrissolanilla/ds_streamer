#we gotta compile our server code in C++ but the library in C
CXX := g++
CXXFLAGS := -std=c++20 -O2 -Wall -Wextra \
  -IuWebSockets/src -IuWebSockets/uSockets/src

# libs uWebSockets expects
LDLIBS := -lz -lpthread
# IDK if we ever need SSL BUT if we ever enable ssl in uSockets:
# LDLIBS += -lssl -lcrypto

all: server

#build uSockets archive using its own Makefile
uWebSockets/uSockets/uSockets.a:
	$(MAKE) -C uWebSockets/uSockets

server: server.cpp uWebSockets/uSockets/uSockets.a
	$(CXX) $(CXXFLAGS) server.cpp uWebSockets/uSockets/uSockets.a -o $@ $(LDLIBS)

clean:
	rm -f server
	$(MAKE) -C uWebSockets/uSockets clean

