// La mallette de l'Entité — CYD 1 (couvercle) : l'ŒIL. Reçoit l'humeur du hub en ESP-NOW.
// Couleurs (web v0.5.4) : bleu = consigne / vérité, rouge = mensonge, vert = bien, blanc = repos.
#define CYD_ROLE 1
#include <EntiteCyd.h>

enl::Eye eye = {enl::M_IDLE, 0, 0, 0};
uint8_t drawnMood = 255; int lastPx = -999, lastPy = -999, lastR = -1; uint32_t blinkAt = 0, flashUntil = 0;
static const int CX = 160, CY = 120, IRIS = 78;

uint16_t moodColor(uint8_t m) {
  switch (m) {
    case enl::M_CLUE: return tft.color565(40, 120, 255);
    case enl::M_LIE: case enl::M_KO: case enl::M_BOOM: return tft.color565(230, 30, 30);
    case enl::M_OK: case enl::M_WIN: return tft.color565(30, 220, 90);
    case enl::M_ALERT: return tft.color565(255, 170, 0);
    case enl::M_TEST: return ILI9341_MAGENTA;
    default: return tft.color565(200, 200, 210);
  }
}
void drawEyeBase(uint8_t mood) {
  tft.fillScreen(ILI9341_BLACK);
  tft.fillCircle(CX, CY, IRIS + 14, tft.color565(25, 25, 30));
  tft.drawCircle(CX, CY, IRIS + 14, moodColor(mood));
  tft.fillCircle(CX, CY, IRIS, moodColor(mood));
  lastPx = lastPy = -999; lastR = -1;
}
void drawPupil() {
  // pupille : rayon selon le niveau de voix, position selon le regard (et une dérive lente)
  float t = millis() / 1000.0f;
  int px = CX + eye.lookX / 4 + (int)(sinf(t / 2.3f) * 14), py = CY + eye.lookY / 4 + (int)(sinf(t / 3.1f) * 9);
  int r = 26 + eye.level / 12; if (eye.mood == enl::M_LIE) r = 18 + eye.level / 16;
  if (px == lastPx && py == lastPy && r == lastR) return;
  if (lastR >= 0) tft.fillCircle(lastPx, lastPy, lastR + 1, moodColor(eye.mood));
  tft.fillCircle(px, py, r, ILI9341_BLACK);
  tft.fillCircle(px - r / 3, py - r / 3, 4, ILI9341_WHITE);
  lastPx = px; lastPy = py; lastR = r;
}
void setup() { cydCommonSetup(); drawEyeBase(eye.mood); drawnMood = eye.mood; }
void loop() {
  cydSerial();
  enl::Msg m;
  while (L.poll(m)) {
    if (cydCommonMsg(m)) { drawnMood = 255; continue; }
    if (m.h.type == enl::EYE && m.len >= (int)sizeof(enl::Eye)) memcpy(&eye, m.data, sizeof eye);
  }
  int x, y, z; static uint32_t lastT = 0;
  if (touchXY(x, y, z) && millis() - lastT > 300) { lastT = millis(); enl::Touch t = {(uint16_t)x, (uint16_t)y, 0, (uint8_t)min(z / 16, 255)}; L.send(enl::HUB, enl::TOUCH, &t, sizeof t); }
  if (eye.mood != drawnMood) { drawEyeBase(eye.mood); drawnMood = eye.mood; }
  static uint32_t hubMsgT = 0; if (millis() - hubMsgT > 1000) { hubMsgT = millis(); rgb(0, 0, !(lastHub && millis() - lastHub < 3000)); }   // DEL bleue = pas de hub
  if (millis() > blinkAt) {   // clignement
    tft.fillRect(CX - IRIS - 15, CY - IRIS - 15, 2 * IRIS + 30, 2 * IRIS + 30, ILI9341_BLACK); delay(90); drawEyeBase(eye.mood);
    blinkAt = millis() + 3000 + random(4000);
  }
  static uint32_t fr = 0; if (millis() - fr > 40) { fr = millis(); drawPupil(); }
}
