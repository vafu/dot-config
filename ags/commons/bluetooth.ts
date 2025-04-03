/**
 * I don't know Typescript, sorry
 */

export const ComputerMinorClasses = {
  UNCATEGORIZED: { code: 0x00, name: 'Uncategorized, code not assigned' },
  DESKTOP_WORKSTATION: { code: 0x01, name: 'Desktop workstation' },
  SERVER_CLASS_COMPUTER: { code: 0x02, name: 'Server-class computer' },
  LAPTOP: { code: 0x03, name: 'Laptop' },
  HANDHELD_PC_PDA: { code: 0x04, name: 'Handheld PC/PDA (clam shell)' },
  PALM_SIZED_PC_PDA: { code: 0x05, name: 'Palm sized PC/PDA' },
  WEARABLE_COMPUTER: { code: 0x06, name: 'Wearable computer (Watch sized)' },
} as const

// Define the Minor classes specifically for the PHONE Major Class
export const PhoneMinorClasses = {
  UNCATEGORIZED: { code: 0x00, name: 'Uncategorized, code not assigned' },
  CELLULAR: { code: 0x01, name: 'Cellular' },
  CORDLESS: { code: 0x02, name: 'Cordless' },
  SMART_PHONE: { code: 0x03, name: 'Smart phone' },
  WIRED_MODEM_OR_VOICE: { code: 0x04, name: 'Wired modem or voice gateway' },
  COMMON_ISDN_ACCESS: { code: 0x05, name: 'Common ISDN Access' },
} as const

export const LanNetworkAPMinorClasses = {
  FULLY_AVAILABLE: { code: 0x01, name: 'Fully available' },
  ONE_TO_17_PERCENT_UTILIZED: { code: 0x02, name: '1% to 17% utilized' },
  SEVENTEEN_TO_33_PERCENT_UTILIZED: { code: 0x03, name: '17% to 33% utilized' },
  THIRTY_THREE_TO_50_PERCENT_UTILIZED: {
    code: 0x04,
    name: '33% to 50% utilized',
  },
  FIFTY_TO_67_PERCENT_UTILIZED: { code: 0x05, name: '50% to 67% utilized' },
  SIXTY_SEVEN_TO_83_PERCENT_UTILIZED: {
    code: 0x06,
    name: '67% to 83% utilized',
  },
  EIGHTY_THREE_TO_99_PERCENT_UTILIZED: {
    code: 0x07,
    name: '83% to 99% utilized',
  },
  FULL_UTILIZATION: { code: 0x08, name: 'Full utilization' },
} as const

export const AudioVideoMinorClasses = {
  HEADSET: { code: 0x01, name: 'Headset' },
  HANDSFREE: { code: 0x02, name: 'Handsfree' },
  MICROPHONE: { code: 0x03, name: 'Microphone' },
  LOUDSPEAKER: { code: 0x04, name: 'Loudspeaker' },
  HEADPHONES: { code: 0x05, name: 'Headphones' },
  PORTABLE_AUDIO: { code: 0x06, name: 'Portable audio' },
  STEREO_HEADSET: { code: 0x07, name: 'Stereo headset' },
  VIDEO_CONFERENCING: { code: 0x08, name: 'Video conferencing' },
  VIDEO_MONITOR: { code: 0x09, name: 'Video monitor' },
  VIDEO_DISPLAY_AND_RECORDING: {
    code: 0x0a,
    name: 'Video display and recording',
  },
  VIDEO_CONFERENCING_DISPLAY: {
    code: 0x0b,
    name: 'Video conferencing display',
  },
} as const

export const PeripheralKeyboardPointing = {
  NONE: { code: 0b00, name: 'Not Keyboard / Not Pointing Device' },
  KEYBOARD: { code: 0b01, name: 'Keyboard' },
  POINTING: { code: 0b10, name: 'Pointing device' },
  COMBO: { code: 0b11, name: 'Combo keyboard/pointing device' },
} as const

// Define constants for the Device Type part (Bits 5-2)
export const PeripheralDeviceType = {
  UNCATEGORIZED: { code: 0b0000, name: 'Uncategorized device' },
  JOYSTICK: { code: 0b0001, name: 'Joystick' },
  GAMEPAD: { code: 0b0010, name: 'Gamepad' },
  REMOTE_CONTROL: { code: 0b0011, name: 'Remote control' },
  SENSING_DEVICE: { code: 0b0100, name: 'Sensing device' },
  DIGITIZER_TABLET: { code: 0b0101, name: 'Digitizer tablet' },
  CARD_READER: { code: 0b0110, name: 'Card Reader' },
} as const

/**
 * Minor Device Class Info for Peripheral
 */
export const PeripheralMinorClasses = {
  JOYSTICK: { code: 0x01, name: 'Joystick' },
  GAMEPAD: { code: 0x02, name: 'Gamepad' },
  REMOTE_CONTROL: { code: 0x03, name: 'Remote control' },
  SENSING_DEVICE: { code: 0x04, name: 'Sensing device' },
  DIGITIZER_TABLET: { code: 0x05, name: 'Digitizer tablet' },
  CARD_READER: { code: 0x06, name: 'Card reader' },
  DIGITAL_PEN: { code: 0x07, name: 'Digital pen' },
  SCANNING_DEVICE: { code: 0x08, name: 'Scanning device' },
  WEARABLE_KEYBOARD: { code: 0x09, name: 'Wearable keyboard' },
  WEARABLE_POINTING_DEVICE: { code: 0x0a, name: 'Wearable pointing device' },
} as const

/**
 * Minor Device Class Info for Imaging
 */
export const ImagingMinorClasses = {
  DISPLAY: { code: 0x04, name: 'Display' },
  CAMERA: { code: 0x08, name: 'Camera' },
  SCANNER: { code: 0x0c, name: 'Scanner' },
  PRINTER: { code: 0x10, name: 'Printer' },
} as const

/**
 * Minor Device Class Info for Wearable
 */
export const WearableMinorClasses = {
  WRIST_WATCH: { code: 0x01, name: 'Wrist Watch' },
  PAGER: { code: 0x02, name: 'Pager' },
  JACKET: { code: 0x03, name: 'Jacket' },
  HELMET: { code: 0x04, name: 'Helmet' },
  GLASSES: { code: 0x05, name: 'Glasses' },
} as const

/**
 * Minor Device Class Info for Toy
 */
export const ToyMinorClasses = {
  ROBOT: { code: 0x01, name: 'Robot' },
  VEHICLE: { code: 0x02, name: 'Vehicle' },
  DOLL: { code: 0x03, name: 'Doll' },
  CONTROLLER: { code: 0x04, name: 'Controller' },
  GAME: { code: 0x05, name: 'Game' },
} as const

/**
 * Minor Device Class Info for Health
 */
export const HealthMinorClasses = {
  BLOOD_PRESSURE_MONITOR: { code: 0x01, name: 'Blood pressure monitor' },
  THERMOMETER: { code: 0x02, name: 'Thermometer' },
  WEIGHT_SCALE: { code: 0x03, name: 'Weight scale' },
  GLUCOSE_METER: { code: 0x04, name: 'Glucose meter' },
  PULSE_OXIMETER: { code: 0x05, name: 'Pulse oximeter' },
  HEART_RATE_MONITOR: { code: 0x06, name: 'Heart rate monitor' },
  HEALTH_DATA_DISPLAY: { code: 0x07, name: 'Health data display' },
} as const

export enum MajorDeviceClass {
  MISCELLANEOUS = 0x00,
  COMPUTER = 0x01,
  PHONE = 0x02,
  LANNETWORKAP = 0x03,
  AUDIOVIDEO = 0x04,
  PERIPHERAL = 0x05,
  IMAGING = 0x06,
  WEARABLE = 0x07,
  TOY = 0x08,
  HEALTH = 0x09,
  UNCATEGORIZED = 0x1f,
}

export const DeviceClasses = {
  [MajorDeviceClass.COMPUTER]: ComputerMinorClasses,
  [MajorDeviceClass.PHONE]: PhoneMinorClasses,
  [MajorDeviceClass.LANNETWORKAP]: LanNetworkAPMinorClasses,
  [MajorDeviceClass.AUDIOVIDEO]: AudioVideoMinorClasses,
  [MajorDeviceClass.PERIPHERAL]: {
    kbPointing: PeripheralKeyboardPointing,
    type: PeripheralDeviceType,
  },
  [MajorDeviceClass.IMAGING]: ImagingMinorClasses,
  [MajorDeviceClass.WEARABLE]: WearableMinorClasses,
  [MajorDeviceClass.TOY]: ToyMinorClasses,
  [MajorDeviceClass.HEALTH]: HealthMinorClasses,
  [MajorDeviceClass.UNCATEGORIZED]: {},
  [MajorDeviceClass.MISCELLANEOUS]: {},
} as const

type MinorClassInfo<M extends MajorDeviceClass> = (typeof DeviceClasses)[M]

export type MajorClassInfo = typeof MajorDeviceClass

export interface ParsedDeviceClass<
  M extends MajorDeviceClass = MajorDeviceClass,
> {
  major: M
  minor?: (typeof DeviceClasses)[M]
}

export function parseCoD(cod: number): ParsedDeviceClass | null {
  // 1. Extract Bit Fields (No change)
  const formatType = cod & 0x03
  if (formatType !== 0x00) return null
  const minorCode = (cod >> 2) & 0x3f
  const majorCode = (cod >> 8) & 0x1f
  // const serviceClassBits = (cod >> 13)r& 0x7FF;

  // if (!majorClassKey) return null
  //
  //

  // 3. Determine Minor Class Information (Using casting based on majorInfo.name)
  // Declare minorInfo with the final result type based on the specific major name
  let minorInfo: MinorClassInfo<typeof majorCode> | null = null

  // Use if/else if on the major name to decide how to cast and process mapValue
  if (majorCode === MajorDeviceClass.PERIPHERAL) {
    // **CAST**: Assume mapValue is the array/tuple based on the major name check
    const peripheralLookups = DeviceClasses[MajorDeviceClass.PERIPHERAL]

    // Proceed with logic, trusting the cast
    const kbCode = (minorCode >> 4) & 0x03
    const dtCode = minorCode & 0x0f
    const kbLookupObject = peripheralLookups.kbPointing // Relies on cast being correct
    const dtLookupObject = peripheralLookups.type // Relies on cast being correct
    const kbInfo = Object.values(kbLookupObject).find(
      (info) => info.code === kbCode
    )
    const dtInfo = Object.values(dtLookupObject).find(
      (info) => info.code === dtCode
    )

    if (kbInfo && dtInfo) {
      minorInfo = [kbInfo, dtInfo]
    } else {
    }
  } else {
    const simpleLookup = DeviceClasses[majorCode]
    if (simpleLookup) {
      const found = Object.values(simpleLookup).find(
        (info: any) => info.code === minorCode
      )
      minorInfo = found
    }
  }

  if (minorInfo === null) {
    console.error('Minor info parsing failed unexpectedly for: ', majorCode)
    return null
  }

  return {
    major: majorCode,
    minor: minorInfo, // Type is correctly constrained by MinorResultType<M>
    // serviceClasses: serviceClasses,
  } as ParsedDeviceClass<typeof majorCode> // Final assertion
}
