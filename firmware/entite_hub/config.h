// config.h — hub ESP32-S3 N16R8 (DORHEA). Broches FINAL (ASSEMBLAGE-CABLAGE.md §4.3, Pascal 09:16 / 09:54) : NE PAS CHANGER.
#pragma once
#define FW_VERSION "hub-1.0.0"

// Joystick KY-023
static const uint8_t PIN_JOY_X = 4, PIN_JOY_Y = 5, PIN_JOY_SW = 6;   // X/Y = ADC1, SW actif bas
// TM1637
static const uint8_t PIN_TM_CLK = 7, PIN_TM_DIO = 8;
// KY-040 E1..E5 (gauche -> droite) : CLK, DT, SW
static const uint8_t ENC_CLK[5] = {9, 12, 15, 18, 39};
static const uint8_t ENC_DT[5]  = {10, 13, 16, 21, 40};
static const uint8_t ENC_SW[5]  = {11, 14, 17, 38, 1};              // E5 SW = GPIO 1 (option A, 09:54)
// WS2812B (via 74AHCT125 dans le couvercle)
static const uint8_t PIN_LED = 41;
// I2S vers 2 × MAX98357A
static const uint8_t PIN_I2S_BCLK = 42, PIN_I2S_LRC = 47, PIN_I2S_DIN = 48;

// ---- réglages À CONFIRMER sur le matériel (banc)
static const int ENC_DIR = +1;              // +1 : sens horaire = lettre suivante ; -1 pour inverser
static const bool ENC_HALF_DETENT = false;  // true si le KY-040 donne 2 crans par cycle (le banc affiche les fronts par cran)
static const bool JOY_SWAP_XY = false, JOY_INV_X = false, JOY_INV_Y = false;   // orientation du joystick dans la cuvette
static const int JOY_THRESH = 1300;         // écart ADC (0..4095) pour une direction
static const uint8_t LED_COUNT = 40, LEDS_PER_BAR = 8, BARS = 5;
static const uint8_t BAR_REVERSED_MASK = 0b00000;   // bit b = la barrette b+1 est câblée à l'envers (zigzag)
static const uint8_t LED_MAX = 90;          // luminosité max (0..255) : pile 3 A, crêtes LED + audio + servos
static const float AUDIO_GAIN = 0.6f;       // 0..4 (ESP8266Audio) — commencer bas
static const bool TM_OPEN_DRAIN = true;     // CLK/DIO relâchés (pull-up du module). Mesurer : jamais > 3,3 V sur GPIO 7/8.
// Couleurs physiques des câbles banane, port B1..B5 (HARDWARE.md : prise 1 à 5 = noir, bleu, vert, rouge, jaune)
// index dans WIRE_COLORS {rouge, noir, jaune, vert, bleu}
static const int PORT_WIRE[5] = {1, 4, 3, 0, 2};
