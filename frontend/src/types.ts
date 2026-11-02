export type DeviceInfo = {
  activo?: boolean | string | number;
  estado?: string;
  lat?: number | string;
  lng?: number | string;
  latitud?: number | string;
  longitud?: number | string;
  fuenteUbicacion?: 'GPS' | 'MANUAL' | 'DESCONOCIDA';
  sensores?: {
    vibracion?: boolean;
    movimiento?: boolean;
    inclinacionGrados?: number;
    pesoKg?: number;
    pesoValido?: boolean;
    pesoEstimado?: boolean;
    hx711Raw?: number;
    gpsSatelites?: number;
  };
  actualizadoEn?: string | number;
  ultimaConexion?: number;
  ownerUid?: string;
  // V9 PESOv5 publica la lectura en gramos y el rango en kilogramos.
  peso_actual?: number;
  peso_min?: number;
  peso_max?: number;
  peso_ts?: number;
  estado_peso?: string;
  moto_encendida?: boolean;
  historial?: Record<string, unknown>;
  alertas?: Record<string, any>;
  calibracion?: {
    estado?: 'PENDIENTE' | 'GUARDADA';
    guardadaEn?: number;
    solicitadaEn?: number;
    umbralGrados?: number;
    vector?: {x:number; y:number; z:number};
  };
};

export type Screen = 'inicio' | 'ubicacion' | 'alertas' | 'cuenta';

export function validCoordinate(value: unknown, min: number, max: number): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const num = Number(value);
    if (Number.isFinite(num) && num >= min && num <= max) return num;
  }
  return null;
}
