// La mallette de l'Entité — CYD 2 (base) : n° de série, lettres des molettes (étapes 1 et 8), points du code (6 et 11),
// Simon (3), labyrinthe (5 et 9). Deux boutons tactiles : RÉÉCOUTER et INDICE. Ne montre jamais le chrono ni une réponse.
#define CYD_ROLE 2
#include <EntiteCyd.h>

enl::Cyd2 S = {}; bool dirtyAll = true; uint32_t lastDraw = 0; enl::Cyd2 shown = {};
static const int BTN_Y = 200, BTN_H = 38;

void drawButtons() {
  tft.fillRoundRect(4, BTN_Y, 154, BTN_H, 6, tft.color565(30, 60, 120)); tft.fillRoundRect(162, BTN_Y, 154, BTN_H, 6, tft.color565(90, 60, 10));
  tft.setTextSize(2); tft.setTextColor(ILI9341_WHITE); tft.setCursor(22, BTN_Y + 12); tft.print("REECOUTER"); tft.setCursor(200, BTN_Y + 12); tft.print("INDICE");
}
void drawHeader() {
  tft.fillRect(0, 0, 320, 30, tft.color565(15, 15, 20));
  tft.setTextSize(2); tft.setTextColor(ILI9341_WHITE); tft.setCursor(6, 8); tft.print("N\xF8 "); tft.print(S.serial[0] ? S.serial : "--");   // \xF8 = ° en cp437
  tft.setTextSize(1); tft.setTextColor(ILI9341_DARKGREY); tft.setCursor(150, 12); tft.printf("LOT %u", S.lot);
  if (S.step) { tft.setCursor(250, 12); tft.setTextColor(ILI9341_LIGHTGREY); tft.printf("%02u/12", S.step); }
}
void drawMaze() {
  const int cs = 32, ox = 16, oy = 36; uint16_t wc = (S.flags & 1) ? ILI9341_RED : ILI9341_CYAN;
  tft.fillRect(ox - 2, oy - 2, cs * 5 + 5, cs * 5 + 5, ILI9341_BLACK);
  for (int y = 0; y < 5; y++) for (int x = 0; x < 5; x++) {
    uint8_t w = S.walls[y * 5 + x]; int X = ox + x * cs, Y = oy + y * cs;
    if (w == 0xFF) { tft.fillRect(X + 1, Y + 1, cs - 2, cs - 2, tft.color565(10, 10, 12)); continue; }
    if (w & 1) tft.drawFastHLine(X, Y, cs + 1, wc); if (w & 4) tft.drawFastHLine(X, Y + cs, cs + 1, wc);
    if (w & 8) tft.drawFastVLine(X, Y, cs + 1, wc); if (w & 2) tft.drawFastVLine(X + cs, Y, cs + 1, wc);
  }
  if (S.gx >= 0 && S.walls[S.gy * 5 + S.gx] != 0xFF) tft.drawRect(ox + S.gx * cs + 8, oy + S.gy * cs + 8, cs - 16, cs - 16, ILI9341_GREEN);
  tft.fillCircle(ox + S.px * cs + cs / 2, oy + S.py * cs + cs / 2, 8, ILI9341_YELLOW);
  tft.fillRect(190, 40, 128, 150, ILI9341_BLACK);
  tft.setTextSize(2); tft.setTextColor(ILI9341_WHITE); tft.setCursor(190, 60); tft.print(S.text);
  tft.setTextSize(1); tft.setCursor(190, 90); tft.print(S.sub);
  if (S.flags & 1) { tft.setTextColor(ILI9341_RED); tft.setCursor(190, 110); tft.print("SABOTAGE"); }
}
void drawBody() {
  tft.fillRect(0, 30, 320, BTN_Y - 30, ILI9341_BLACK);
  switch (S.mode) {
    case enl::C_IDLE: centerText("L'ENTITE", 80, 3, ILI9341_RED); centerText(S.sub, 130, 1, ILI9341_LIGHTGREY); break;
    case enl::C_ARM: centerText("ARMER", 70, 4, tft.color565(40, 120, 255)); centerText("capot bleu, puis levier", 130, 1, ILI9341_LIGHTGREY); break;
    case enl::C_LETTERS: {
      // 5 cases : la lettre de chaque molette E1..E5 ; S.sub = lettres mêlées (étape 1) ou score
      for (int i = 0; i < 5; i++) { int X = 14 + i * 60; tft.drawRoundRect(X, 50, 52, 64, 6, ILI9341_WHITE); char b[2] = {S.text[i] ? S.text[i] : ' ', 0}; tft.setTextSize(5); tft.setTextColor(ILI9341_YELLOW); tft.setCursor(X + 12, 62); tft.print(b); tft.setTextSize(1); tft.setTextColor(ILI9341_DARKGREY); tft.setCursor(X + 20, 118); tft.printf("E%d", i + 1); }
      centerText(S.sub, 150, 3, ILI9341_CYAN); break;
    }
    case enl::C_CODE: centerText(S.text, 75, 5, strcmp(S.text, "BLOQUE") ? ILI9341_WHITE : ILI9341_RED); centerText(S.sub, 140, 1, ILI9341_LIGHTGREY); break;
    case enl::C_SIMON: centerText(S.text, 70, 4, ILI9341_MAGENTA); centerText(S.sub, 130, 2, ILI9341_LIGHTGREY); break;
    case enl::C_MAZE: drawMaze(); break;
    case enl::C_WIN: centerText("SIGNAL", 60, 4, ILI9341_GREEN); centerText("TRANSMIS", 110, 4, ILI9341_GREEN); break;
    case enl::C_BOOM: tft.fillRect(0, 30, 320, BTN_Y - 30, ILI9341_RED); centerText("ECHEC", 80, 5, ILI9341_WHITE, ILI9341_RED); break;
    case enl::C_TEST: centerText("BANC", 60, 4, ILI9341_MAGENTA); centerText(S.text, 120, 2, ILI9341_WHITE); centerText(S.sub, 150, 1, ILI9341_LIGHTGREY); break;
    default: centerText(S.text, 70, 3, ILI9341_WHITE); centerText(S.sub, 120, 2, ILI9341_LIGHTGREY); break;
  }
}
void setup() { cydCommonSetup(); strcpy(S.sub, "en attente du hub"); }
void loop() {
  cydSerial();
  enl::Msg m;
  while (L.poll(m)) {
    if (cydCommonMsg(m)) { dirtyAll = true; continue; }
    if (m.h.type == enl::CYD2_STATE && m.len >= (int)sizeof(enl::Cyd2)) memcpy(&S, m.data, sizeof S);
  }
  bool changed = memcmp(&S, &shown, sizeof S) != 0;
  if (dirtyAll || (changed && millis() - lastDraw > 60)) {
    bool onlyMaze = !dirtyAll && S.mode == enl::C_MAZE && shown.mode == enl::C_MAZE && !strcmp(S.serial, shown.serial) && S.step == shown.step;
    if (onlyMaze) drawMaze(); else { if (dirtyAll) tft.fillScreen(ILI9341_BLACK); drawHeader(); drawBody(); drawButtons(); }
    shown = S; dirtyAll = false; lastDraw = millis();
  }
  int x, y, z; static uint32_t lastT = 0;
  if (touchXY(x, y, z) && millis() - lastT > 350) {
    lastT = millis(); uint8_t zone = y >= BTN_Y - 6 ? (x < 160 ? 1 : 2) : 0;
    enl::Touch t = {(uint16_t)x, (uint16_t)y, zone, (uint8_t)min(z / 16, 255)}; L.send(enl::HUB, enl::TOUCH, &t, sizeof t);
    if (zone) { tft.drawRoundRect(zone == 1 ? 4 : 162, BTN_Y, 154, BTN_H, 6, ILI9341_WHITE); delay(80); drawButtons(); }
  }
  rgb(0, 0, lastHub && millis() - lastHub < 3000 ? 0 : (millis() / 500) % 2);   // bleu clignotant = pas de hub
}
