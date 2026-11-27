// hw.h — matériel du hub : molettes KY-040, boutons, joystick, TM1637, barrettes WS2812B, audio I2S (2 × MAX98357A).
#pragma once
#include <Adafruit_NeoPixel.h>
#include <LittleFS.h>
#include <AudioOutputI2S.h>
#include <AudioGeneratorMP3.h>
#include <AudioFileSourceLittleFS.h>
#include "config.h"

// ================= molettes (scrutation 2 kHz par esp_timer, table de quadrature)
struct EncState { volatile int32_t steps = 0, edges = 0; int8_t acc = 0; uint8_t prev = 3; };
EncState enc[5];
static const int8_t QDEC[16] = {0, -1, 1, 0, 1, 0, 0, -1, -1, 0, 0, 1, 0, 1, -1, 0};
static void IRAM_ATTR encTick(void *) {
  for (int i = 0; i < 5; i++) {
    uint8_t cur = (gpio_get_level((gpio_num_t)ENC_CLK[i]) << 1) | gpio_get_level((gpio_num_t)ENC_DT[i]);
    EncState &e = enc[i]; if (cur == e.prev) continue;
    int8_t d = QDEC[(e.prev << 2) | cur]; e.prev = cur; if (!d) continue;
    e.acc += d; e.edges += d;
    bool rest = ENC_HALF_DETENT ? (cur == 0 || cur == 3) : (cur == 3);
    int need = ENC_HALF_DETENT ? 2 : 3;
    if (rest) { if (e.acc >= need) e.steps += ENC_DIR; else if (e.acc <= -need) e.steps -= ENC_DIR; e.acc = 0; }
  }
}
int32_t encTaken[5] = {0};
int encDelta(int i) { int32_t s = enc[i].steps, d = s - encTaken[i]; encTaken[i] = s; return d; }

// ================= boutons (SW des molettes + SW du joystick), anti-rebond 30 ms
struct Btn { uint8_t pin; bool stable = true, last = true; uint32_t t = 0; bool pressed = false; };
Btn btnEnc[5], btnJoy;
void btnInit(Btn &b, uint8_t pin) { b.pin = pin; pinMode(pin, INPUT_PULLUP); b.stable = b.last = digitalRead(pin); }
void btnPoll(Btn &b) {
  bool v = digitalRead(b.pin); if (v != b.last) { b.last = v; b.t = millis(); }
  else if (v != b.stable && millis() - b.t >= 30) { b.stable = v; if (!v) b.pressed = true; }
}
bool btnTake(Btn &b) { bool p = b.pressed; b.pressed = false; return p; }

// ================= joystick
int joyCX = 2048, joyCY = 2048; int8_t joyLatched = -1; uint32_t joyRepeatAt = 0;
void joyCalibrate() { long sx = 0, sy = 0; for (int i = 0; i < 16; i++) { sx += analogRead(PIN_JOY_X); sy += analogRead(PIN_JOY_Y); delay(2); } joyCX = sx / 16; joyCY = sy / 16; }
// renvoie une direction entite::Dir (0 haut, 1 droite, 2 bas, 3 gauche) ou -1 ; une impulsion par geste, répétition après 450 ms
int joyRawDir() {
  int x = analogRead(PIN_JOY_X) - joyCX, y = analogRead(PIN_JOY_Y) - joyCY;
  if (JOY_SWAP_XY) { int t = x; x = y; y = t; }
  if (JOY_INV_X) x = -x; if (JOY_INV_Y) y = -y;
  if (abs(x) < JOY_THRESH && abs(y) < JOY_THRESH) return -1;
  if (abs(x) > abs(y)) return x > 0 ? 1 : 3;
  return y > 0 ? 2 : 0;
}
int joyEvent() {
  int d = joyRawDir();
  if (d < 0) { joyLatched = -1; return -1; }
  if (d != joyLatched) { joyLatched = d; joyRepeatAt = millis() + 450; return d; }
  if (millis() > joyRepeatAt) { joyRepeatAt = millis() + 220; return d; }
  return -1;
}

// ================= TM1637 (bit-bang ; CLK 7, DIO 8)
static const uint8_t SEG[10] = {0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f};
inline void tmLine(uint8_t pin, bool high) {
  if (TM_OPEN_DRAIN) { if (high) pinMode(pin, INPUT); else { pinMode(pin, OUTPUT); digitalWrite(pin, LOW); } }
  else { pinMode(pin, OUTPUT); digitalWrite(pin, high); }
}
inline void tmDelay() { delayMicroseconds(5); }
void tmStart() { tmLine(PIN_TM_DIO, 1); tmLine(PIN_TM_CLK, 1); tmDelay(); tmLine(PIN_TM_DIO, 0); tmDelay(); }
void tmStop() { tmLine(PIN_TM_CLK, 0); tmDelay(); tmLine(PIN_TM_DIO, 0); tmDelay(); tmLine(PIN_TM_CLK, 1); tmDelay(); tmLine(PIN_TM_DIO, 1); tmDelay(); }
bool tmWrite(uint8_t b) {
  for (int i = 0; i < 8; i++) { tmLine(PIN_TM_CLK, 0); tmDelay(); tmLine(PIN_TM_DIO, b & 1); tmDelay(); tmLine(PIN_TM_CLK, 1); tmDelay(); b >>= 1; }
  tmLine(PIN_TM_CLK, 0); tmLine(PIN_TM_DIO, 1); pinMode(PIN_TM_DIO, INPUT); tmDelay(); tmLine(PIN_TM_CLK, 1); tmDelay();
  bool ack = digitalRead(PIN_TM_DIO) == LOW; tmLine(PIN_TM_CLK, 0); tmDelay(); return ack;
}
uint8_t tmBright = 4;
bool tmShow(const uint8_t seg[4]) {
  tmStart(); bool a = tmWrite(0x40); tmStop();
  tmStart(); a &= tmWrite(0xC0); for (int i = 0; i < 4; i++) a &= tmWrite(seg[i]); tmStop();
  tmStart(); a &= tmWrite(0x88 | (tmBright & 7)); tmStop();
  return a;   // vrai si le module a acquitté (ACK) : preuve de vie
}
bool tmTime(int sec, bool colon, bool blankAll = false) {
  uint8_t s[4] = {0, 0, 0, 0};
  if (!blankAll) { if (sec < 0) sec = 0; int m = sec / 60, ss = sec % 60; s[0] = SEG[(m / 10) % 10]; s[1] = SEG[m % 10] | (colon ? 0x80 : 0); s[2] = SEG[ss / 10]; s[3] = SEG[ss % 10]; }
  return tmShow(s);
}

// ================= barrettes WS2812B : 5 × 8
Adafruit_NeoPixel strip(LED_COUNT, PIN_LED, NEO_GRB + NEO_KHZ800);
uint8_t ledCap = 255;   // plafond relatif (ex. 30 % pendant un tremblement de servo)
inline int ledIndex(int bar, int i) { return bar * LEDS_PER_BAR + ((BAR_REVERSED_MASK >> bar) & 1 ? LEDS_PER_BAR - 1 - i : i); }
void ledSet(int bar, int i, uint32_t rgb, float lvl) {
  float k = lvl * (LED_MAX / 255.0f) * (ledCap / 255.0f);
  strip.setPixelColor(ledIndex(bar, i), strip.Color(((rgb >> 16) & 255) * k, ((rgb >> 8) & 255) * k, (rgb & 255) * k));
}
void ledClear() { strip.clear(); }
void ledShow() { strip.show(); }

// ================= audio : file de répliques mp3 (LittleFS) + générateur de tons mélangé, sur le cœur 0
// Les voix sont les mp3 du web (voix/<id>.mp3), déjà passés par la recette v0.1.5 (RECETTE-VOIX.md) : AUCUN traitement ici.
class MixOut : public AudioOutputI2S {
 public:
  volatile uint16_t toneHz = 0; volatile uint8_t toneMask = 3; volatile int16_t toneAmp = 6000; uint32_t phase = 0;
  volatile uint32_t peak = 0; bool started = false, srcMono = false;
  // L'I2S reste ouvert en permanence : le décodeur mp3 appelle begin()/stop() à chaque réplique,
  // ce qui recréerait / détruirait le canal I2S (assert) et couperait les tons de Simon.
  bool begin() override { if (started) return true; started = AudioOutputI2S::begin(); return started; }
  bool stop() override { return true; }
  bool SetChannels(int c) override { srcMono = (c == 1); return AudioOutputI2S::SetChannels(2); }
  bool ConsumeSample(int16_t s[2]) override {
    int16_t t[2] = {s[0], srcMono ? s[0] : s[1]};   // voix mono -> les deux amplis
    uint32_t inc = 0;
    if (toneHz) {
      inc = (uint32_t)((uint64_t)toneHz * 4294967296ULL / (hertz ? hertz : 44100));
      int16_t v = (phase & 0x80000000u) ? toneAmp : -toneAmp;   // carré doux
      if (toneMask & 1) t[0] = constrain((int32_t)t[0] + v, -32767, 32767);
      if (toneMask & 2) t[1] = constrain((int32_t)t[1] + v, -32767, 32767);
    }
    if (!AudioOutputI2S::ConsumeSample(t)) return false;
    phase += inc; uint32_t a = abs(t[0]) + abs(t[1]); if (a > peak) peak = a;
    return true;
  }
};
MixOut *aout = nullptr;
AudioGeneratorMP3 *mp3 = nullptr;
AudioFileSourceLittleFS *afile = nullptr;
struct VoiceItem { char id[32]; bool lie; };
QueueHandle_t voiceQ;
volatile bool voiceBusy = false, voiceLie = false, voiceClearReq = false;
char voiceNow[32] = "";
volatile uint32_t toneUntil = 0;
volatile uint8_t voiceLevel = 0;
uint32_t voicesMissing = 0; String lastMissing;
bool fsOk = false;

void audioTone(uint16_t hz, uint16_t ms, uint8_t mask = 3) { if (!aout) return; aout->toneMask = mask; aout->toneHz = hz; toneUntil = millis() + ms; }
void say(const char *id, bool lie = false) { VoiceItem v = {}; strncpy(v.id, id, sizeof v.id - 1); v.lie = lie; xQueueSend(voiceQ, &v, 0); }
void sayClear() { voiceClearReq = true; uint32_t t = millis(); while (voiceClearReq && millis() - t < 60) delay(1); }   // synchrone
bool voiceFileExists(const char *id) { if (!fsOk) return false; char p[48]; snprintf(p, sizeof p, "/v/%s.mp3", id); return LittleFS.exists(p); }

static void audioTask(void *) {
  int16_t silence[2] = {0, 0};
  for (;;) {
    if (voiceClearReq) { voiceClearReq = false; if (mp3 && mp3->isRunning()) mp3->stop(); xQueueReset(voiceQ); voiceBusy = false; voiceNow[0] = 0; }
    if (mp3 && mp3->isRunning()) {
      if (!mp3->loop()) { mp3->stop(); voiceNow[0] = 0; }
      static uint8_t yc = 0; if (++yc >= 8) { yc = 0; vTaskDelay(1); }
    } else {
      VoiceItem v;
      if (xQueueReceive(voiceQ, &v, 0) == pdTRUE) {
        char p[48]; snprintf(p, sizeof p, "/v/%s.mp3", v.id);
        if (fsOk && LittleFS.exists(p)) {
          delete afile; afile = new AudioFileSourceLittleFS(p);
          strncpy(voiceNow, v.id, sizeof voiceNow - 1); voiceLie = v.lie; voiceBusy = true;
          mp3->begin(afile, aout);
        } else { voicesMissing++; lastMissing = v.id; Serial.printf("[voix] manquante : %s (fichier /v/%s.mp3)\n", v.id, v.id); }
        continue;
      }
      voiceBusy = false;
      for (int i = 0; i < 64; i++) if (!aout->ConsumeSample(silence)) break;   // garde l'I2S nourri (tons de Simon)
      vTaskDelay(1);
    }
    if (aout->toneHz && (int32_t)(millis() - toneUntil) >= 0) aout->toneHz = 0;
    static uint32_t lv = 0; if (millis() - lv > 40) { lv = millis(); uint32_t pk = aout->peak; aout->peak = 0; voiceLevel = min<uint32_t>(255, pk / 160); }
  }
}
void audioBegin() {
  fsOk = LittleFS.begin(false, "/littlefs", 10, "spiffs");
  aout = new MixOut(); aout->SetPinout(PIN_I2S_BCLK, PIN_I2S_LRC, PIN_I2S_DIN); aout->SetGain(AUDIO_GAIN); aout->SetRate(44100); aout->SetChannels(2); aout->begin();
  mp3 = new AudioGeneratorMP3();
  voiceQ = xQueueCreate(24, sizeof(VoiceItem));
  xTaskCreatePinnedToCore(audioTask, "audio", 8192, nullptr, 3, nullptr, 0);
}
bool audioIdle() { return !voiceBusy && uxQueueMessagesWaiting(voiceQ) == 0 && !(mp3 && mp3->isRunning()); }

void hwBegin() {
  for (int i = 0; i < 5; i++) { pinMode(ENC_CLK[i], INPUT_PULLUP); pinMode(ENC_DT[i], INPUT_PULLUP); btnInit(btnEnc[i], ENC_SW[i]);
    enc[i].prev = (digitalRead(ENC_CLK[i]) << 1) | digitalRead(ENC_DT[i]); }
  btnInit(btnJoy, PIN_JOY_SW);
  analogReadResolution(12); joyCalibrate();
  esp_timer_create_args_t ta = {}; ta.callback = encTick; ta.name = "enc"; esp_timer_handle_t th; esp_timer_create(&ta, &th); esp_timer_start_periodic(th, 500);
  strip.begin(); strip.clear(); strip.show();
  tmTime(0, true, true);
  audioBegin();
}
void hwPollButtons() { for (int i = 0; i < 5; i++) btnPoll(btnEnc[i]); btnPoll(btnJoy); }
