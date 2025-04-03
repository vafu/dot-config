import AstalBluetooth from "gi://AstalBluetooth?version=0.1";

export const BluetoothDeviceType = {
  COMPUTER: { icon: "computer" },
  PHONE: { icon: "phone" },
  MODEM: { icon: "modem" },
  NETWORK_WIRELESS: { icon: "network-wireless" },
  AUDIO_HEADSET: { icon: "audio-headset-symbolic" },
  AUDIO_HEADPHONES: { icon: "audio-headphones-symbolic" },
  CAMERA_VIDEO: { icon: "camera-video" },
  AUDIO_CARD: { icon: "audio-card" }, // Represents default or other audio device
  INPUT_GAMING: { icon: "input-gaming" },
  INPUT_KEYBOARD: { icon: "input-keyboard-symbolic" },
  INPUT_TABLET: { icon: "input-touchpad-symbolic" },
  INPUT_MOUSE: { icon: "input-mouse" }, // Represents default or other pointing device
  PRINTER: { icon: "printer" },
  CAMERA_PHOTO: { icon: "camera-photo" },
  UNKNOWN: { icon: "unknown" },
  VIDEO_DISPLAY: { icon: "video-display" },
  MULTIMEDIA_PLAYER: { icon: "multimedia-player" },
  SCANNER: { icon: "scanner" },
} as const;

export type BluetoothDeviceType = typeof BluetoothDeviceType[keyof typeof BluetoothDeviceType];


// For classToIcon (Bluetooth Classic Class of Device)
const COD_MAJOR_DEVICE_MASK = 0x1f00;
const COD_MAJOR_DEVICE_SHIFT = 8;
const COD_MINOR_AUDIO_MASK = 0xfc; // Also used for Phone minor class
const COD_MINOR_AUDIO_SHIFT = 2;  // Also used for Phone minor class
const COD_MINOR_PERIPH_TYPE_MASK = 0xc0;
const COD_MINOR_PERIPH_TYPE_SHIFT = 6;
const COD_MINOR_PERIPH_SUBTYPE_MASK = 0x1e; // Note: C code used 0x1e >> 2, directly checking values 1 and 2
const COD_MINOR_PERIPH_SUBTYPE_SHIFT = 2;  // Shift used in C code's switch condition
const COD_IMAGING_PRINTER_BIT = 0x80;
const COD_IMAGING_CAMERA_BIT = 0x20;

// For gapAppearanceToIcon (BLE GAP Appearance)
const GAP_APPEARANCE_CATEGORY_MASK = 0xffc0;
const GAP_APPEARANCE_CATEGORY_SHIFT = 6;
const GAP_APPEARANCE_SUBCATEGORY_MASK = 0x3f;
const GAP_APPEARANCE_HID_GENERIC_CATEGORY = 0x0f;


/**
 * Converts a Bluetooth Classic Class of Device (CoD) value to a predefined icon identifier.
 * @param deviceClass The 32-bit Class of Device value.
 * @returns A BluetoothIcon identifier or null if no specific mapping found.
 */
function parseClass(deviceClass: number): BluetoothDeviceType | null {
  // Extract Major Device Class (bits 8-12)
  const majorDeviceClass = (deviceClass & COD_MAJOR_DEVICE_MASK) >> COD_MAJOR_DEVICE_SHIFT;

  switch (majorDeviceClass) {
    case 0x01: // Computer Major Class
      return BluetoothDeviceType.COMPUTER;
    case 0x02: // Phone Major Class
      // Extract Minor Device Class for Phone (bits 2-7 -> values 0-63)
      const phoneMinorClass = (deviceClass & COD_MINOR_AUDIO_MASK) >> COD_MINOR_AUDIO_SHIFT;
      switch (phoneMinorClass) {
        case 0x01: // Cellular
        case 0x02: // Cordless
        case 0x03: // Smartphone
        case 0x05: // Common ISDN Access
          return BluetoothDeviceType.PHONE;
        case 0x04: // Wired modem or voice gateway
          return BluetoothDeviceType.MODEM;
      }
      break; // Important: break if no minor class matched within phone
    case 0x03: // LAN/Network Access Point Major Class
      return BluetoothDeviceType.NETWORK_WIRELESS;
    case 0x04: // Audio/Video Major Class
      // Extract Minor Device Class for AV (bits 2-7 -> values 0-63)
      const audioMinorClass = (deviceClass & COD_MINOR_AUDIO_MASK) >> COD_MINOR_AUDIO_SHIFT;
      switch (audioMinorClass) {
        case 0x01: // Wearable Headset Device
        case 0x02: // Hands-free Device
          return BluetoothDeviceType.AUDIO_HEADSET;
        case 0x06: // Headphones
          return BluetoothDeviceType.AUDIO_HEADPHONES;
        case 0x0b: // VCR
        case 0x0c: // Video Camera
        case 0x0d: // Camcorder
          return BluetoothDeviceType.CAMERA_VIDEO;
        default:
          // Other audio device cases fall through here
          return BluetoothDeviceType.AUDIO_CARD;
      }
      break;
    case 0x05: // Peripheral Major Class (keyboards, mice, etc.)
      // Extract Peripheral Type (bits 6-7 -> values 0-3)
      const peripheralType = (deviceClass & COD_MINOR_PERIPH_TYPE_MASK) >> COD_MINOR_PERIPH_TYPE_SHIFT;
      // Extract Peripheral SubType based on C code logic (bits 2-4 >> 2)
      const peripheralSubType = (deviceClass & COD_MINOR_PERIPH_SUBTYPE_MASK) >> COD_MINOR_PERIPH_SUBTYPE_SHIFT;

      switch (peripheralType) {
        case 0x00: // Uncategorized or Not Keyboard/Pointing Device
          switch (peripheralSubType) {
            case 0x01: // Joystick
            case 0x02: // Gamepad
              return BluetoothDeviceType.INPUT_GAMING;
          }
          break; // Break inner switch
        case 0x01: // Keyboard
          return BluetoothDeviceType.INPUT_KEYBOARD;
        case 0x02: // Pointing device
          switch (peripheralSubType) {
            case 0x05: // Digitizer tablet
              return BluetoothDeviceType.INPUT_TABLET;
            default:
              // Includes Mouse (0x04 according to spec, but handled by default here)
              return BluetoothDeviceType.INPUT_MOUSE;
          }
          // Break technically not needed after return
          break;
      }
      break; // Important: break if no type/subtype matched within peripheral
    case 0x06: // Imaging Major Class
      if (deviceClass & COD_IMAGING_PRINTER_BIT) // Check bit 7
        return BluetoothDeviceType.PRINTER;
      if (deviceClass & COD_IMAGING_CAMERA_BIT) // Check bit 5
        return BluetoothDeviceType.CAMERA_PHOTO;
      break; // Important: break if no imaging bit matched
  }

  // No specific match found
  return null;
}

function parseAppearance(appearance: number): BluetoothDeviceType | null {
  const category = (appearance & GAP_APPEARANCE_CATEGORY_MASK) >> GAP_APPEARANCE_CATEGORY_SHIFT;

  switch (category) {
    case 0x00: // Unknown
      return BluetoothDeviceType.UNKNOWN;
    case 0x01: // Generic Phone
      return BluetoothDeviceType.PHONE;
    case 0x02: // Generic Computer
      return BluetoothDeviceType.COMPUTER;
    case 0x05: // Generic Display
      return BluetoothDeviceType.VIDEO_DISPLAY;
    case 0x0a: // Generic Media Player
      return BluetoothDeviceType.MULTIMEDIA_PLAYER;
    case 0x0b: // Generic Scanner (Barcode)
      // Note: C code maps this to multimedia-player, but spec says Barcode Scanner. Let's use SCANNER.
      // Adjusted based on likely intent. Check C code comment if source available.
      // Original C code returned "multimedia-player" here, which seems potentially incorrect based on spec value 0x0A.
      // Let's assume the C code had a typo and map 0x0B (Barcode Scanner) to SCANNER.
      // If the C code's mapping of 0x0A to multimedia-player was intended, adjust case 0x0a above.
      return BluetoothDeviceType.SCANNER;
    case GAP_APPEARANCE_HID_GENERIC_CATEGORY: // HID Generic (0x0f or 15)
      // Extract Sub-category (lower 6 bits: 0-5)
      const subCategory = appearance & GAP_APPEARANCE_SUBCATEGORY_MASK;
      switch (subCategory) {
        case 0x01: // Keyboard
          return BluetoothDeviceType.INPUT_KEYBOARD;
        case 0x02: // Mouse
          return BluetoothDeviceType.INPUT_MOUSE;
        case 0x03: // Joystick
        case 0x04: // Gamepad
          return BluetoothDeviceType.INPUT_GAMING;
        case 0x05: // Digitizer Tablet
          return BluetoothDeviceType.INPUT_TABLET;
        case 0x08: // Barcode Scanner (HID Sub-category)
          return BluetoothDeviceType.SCANNER;
      }
      break; // Important: break if no HID sub-category matched
    // Add more top-level categories here if needed
  }

  // No specific match found
  return null;
}

export function getDeviceType(device: AstalBluetooth.Device): BluetoothDeviceType {
  return parseClass(device.class) ?? parseAppearance(device.appearance) ?? BluetoothDeviceType.UNKNOWN
}

