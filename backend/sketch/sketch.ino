#include <Wire.h>
#include <SoftwareSerial.h>

SoftwareSerial debugSerial(10, 11); // RX, TX

byte buttonData[12] = {0};
uint16_t lastMask = 0xFFFF;

const int lrSwitch = 7;

void applyMask(uint16_t mask)
{
  for (int i = 0; i < 12; i++) {
    buttonData[i] = (mask >> i) & 0x01;
  }
}

void printButtons()
{
  debugSerial.print("bits=");
  for (int i = 11; i >= 0; i--) {
    debugSerial.print(buttonData[i]);
  }
  debugSerial.println();
}

void setup()
{
  pinMode(A0, OUTPUT);
  pinMode(A1, OUTPUT);
  pinMode(A2, INPUT_PULLUP);
  pinMode(6, OUTPUT);
  pinMode(lrSwitch, INPUT);

  digitalWrite(6, HIGH);

  Serial.begin(9600);
  debugSerial.begin(9600);
  Wire.begin();

  debugSerial.println("boot");
}

void loop()
{
  while (Serial.available() >= 2)
  {
    uint8_t lowByte = Serial.read();
    uint8_t highByte = Serial.read();

    uint16_t mask = (uint16_t)lowByte | ((uint16_t)highByte << 8);
    applyMask(mask);

    if (mask != lastMask) {
      lastMask = mask;
      debugSerial.print("low=");
      debugSerial.print(lowByte);
      debugSerial.print(" high=");
      debugSerial.print(highByte);
      debugSerial.print(" mask=");
      debugSerial.println(mask);
      printButtons();
    }
  }

  Wire.beginTransmission(9);
  for (int i = 0; i < 12; i++)
  {
    Wire.write(buttonData[i]);
  }
  Wire.endTransmission();

  delay(5);
}