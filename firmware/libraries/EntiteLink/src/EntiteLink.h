// EntiteLink.h — liaison ESP-NOW de la mallette (hub <-> 2e S3, CYD 1, CYD 2). Diffusion (broadcast) sur le canal 1,
// filtrée par un mot magique et un n° de rôle. Aucune autre émission radio : pas de Wi-Fi connecté, pas de point d'accès.
#pragma once
#include <Arduino.h>
#include <WiFi.h>
#include <esp_wifi.h>
#include <esp_now.h>

namespace enl {

static const uint32_t MAGIC = 0x35544E45;  // "ENT5"
static const uint8_t LINK_VER = 1, LINK_CHANNEL = 1;
enum Role : uint8_t { ALL = 0xFF, HUB = 1, S3B = 2, CYD1 = 3, CYD2 = 4 };
inline const char *roleName(uint8_t r) { return r == HUB ? "HUB" : r == S3B ? "S3B" : r == CYD1 ? "CYD1" : r == CYD2 ? "CYD2" : "?"; }

enum Type : uint8_t {
  PING = 1, PONG = 2,
  S3B_IN = 10,     // 2e S3 -> hub : état des entrées
  S3B_CMD = 11,    // hub -> 2e S3 : servo / bench
  EYE = 20,        // hub -> CYD 1 : humeur de l'œil
  CYD2_STATE = 30, // hub -> CYD 2 : écran du bas
  TOUCH = 40,      // CYD -> hub : appui tactile
  BENCH = 50,      // hub -> tous : démarrer / arrêter le banc
  LOG = 60         // n'importe qui -> hub : ligne de rapport de banc (texte)
};

struct __attribute__((packed)) Hdr { uint32_t magic; uint8_t ver, src, dst, type; uint16_t seq; };
struct __attribute__((packed)) Ping { uint32_t t0; uint8_t from; };

// 2e S3 -> hub
struct __attribute__((packed)) S3bIn {
  int8_t plug[5];      // prise (0..4) où est branché le câble du port B1..B5, -1 = débranché, -2 = ambigu
  uint8_t locks;       // bit0 serrure I tournée, bit1 serrure II tournée (LOW = tournée)
  uint8_t levers;      // bit0 ARM levé, bit1 TRANSMIT levé (LOW = actif)
  uint8_t keySeq;      // nombre total de touches (mod 256) ; keys[3] = la plus récente
  char keys[4];
  uint8_t touchSeq;    // nombre total de contacts de prise (une fiche qui ENTRE dans une prise) ; touches[3] = la plus récente
  uint8_t touches[4];
  uint8_t bench;       // 1 = le 2e S3 est en mode banc
};
// hub -> 2e S3
enum ServoAct : uint8_t { SV_NONE = 0, SV_CLOSE = 1, SV_OPEN = 2, SV_SHAKE = 3, SV_DETACH = 4, SV_SWEEP_TEST = 5 };
struct __attribute__((packed)) S3bCmd { uint8_t trap; uint8_t act; uint8_t seq; };

// hub -> CYD 1
enum Mood : uint8_t { M_IDLE = 0, M_CALM, M_CLUE, M_LIE, M_OK, M_KO, M_ALERT, M_WIN, M_BOOM, M_TEST };
struct __attribute__((packed)) Eye { uint8_t mood; uint8_t level; int8_t lookX, lookY; };

// hub -> CYD 2
enum Cyd2Mode : uint8_t { C_IDLE = 0, C_ARM, C_LETTERS, C_CODE, C_SIMON, C_MAZE, C_TRAP, C_KEYS, C_PATCH, C_TX, C_WIN, C_BOOM, C_TEST };
struct __attribute__((packed)) Cyd2 {
  uint8_t mode, step;
  char serial[6]; uint16_t lot;
  char text[12];        // lettres / points du code / « BLOQUÉ » …
  char sub[24];         // ligne secondaire (score, « SIMON 2/5 »)
  uint8_t walls[25];    // labyrinthe (bits N1 E2 S4 W8), 0xFF = case cachée (étape 9)
  int8_t px, py, gx, gy;
  uint8_t flags;        // bit0 sabotage, bit1 éclair, bit2 glitch, bit3 voix en cours
  uint16_t timeLeft;    // s
  uint8_t battPct;
};
struct __attribute__((packed)) Touch { uint16_t x, y; uint8_t zone; uint8_t z; };   // zone : 1 = RÉÉCOUTER, 2 = INDICE
struct __attribute__((packed)) Bench { uint8_t on; };
struct __attribute__((packed)) LogLine { char txt[180]; };

struct Msg { Hdr h; uint8_t data[232]; int len; uint8_t mac[6]; int8_t rssi; };

class Link {
 public:
  uint8_t role = 0; uint16_t seq = 0; uint32_t rx = 0, tx = 0, txErr = 0;
  bool begin(uint8_t myRole) {
    role = myRole;
    WiFi.mode(WIFI_STA); WiFi.disconnect();
    esp_wifi_set_channel(LINK_CHANNEL, WIFI_SECOND_CHAN_NONE);
    if (esp_now_init() != ESP_OK) return false;
    esp_now_peer_info_t p = {}; memset(p.peer_addr, 0xFF, 6); p.channel = LINK_CHANNEL; p.encrypt = false;
    if (!esp_now_is_peer_exist(p.peer_addr)) esp_now_add_peer(&p);
    self() = this; q = xQueueCreate(16, sizeof(Msg));
    esp_now_register_recv_cb(onRecv);
    return true;
  }
  bool send(uint8_t dst, uint8_t type, const void *payload, size_t len) {
    uint8_t buf[250]; if (len > sizeof(buf) - sizeof(Hdr)) return false;
    Hdr h = {MAGIC, LINK_VER, role, dst, type, ++seq}; memcpy(buf, &h, sizeof h); if (len) memcpy(buf + sizeof h, payload, len);
    static const uint8_t bc[6] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};
    esp_err_t e = esp_now_send(bc, buf, sizeof h + len); tx++; if (e != ESP_OK) txErr++;
    return e == ESP_OK;
  }
  bool poll(Msg &m) { return q && xQueueReceive(q, &m, 0) == pdTRUE; }
  String mac() { return WiFi.macAddress(); }
 private:
  QueueHandle_t q = nullptr;
  static Link *&self() { static Link *s = nullptr; return s; }
  static void onRecv(const esp_now_recv_info_t *info, const uint8_t *d, int len) {
    Link *L = self(); if (!L || len < (int)sizeof(Hdr)) return;
    Msg m; memcpy(&m.h, d, sizeof(Hdr));
    if (m.h.magic != MAGIC || m.h.ver != LINK_VER || m.h.src == L->role) return;
    if (m.h.dst != ALL && m.h.dst != L->role) return;
    m.len = len - sizeof(Hdr); if (m.len > (int)sizeof m.data) m.len = sizeof m.data;
    memcpy(m.data, d + sizeof(Hdr), m.len); memcpy(m.mac, info->src_addr, 6);
    m.rssi = info->rx_ctrl ? info->rx_ctrl->rssi : 0; L->rx++;
    xQueueSend(L->q, &m, 0);
  }
};

}  // namespace enl
