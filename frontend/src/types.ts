export type DeviceInfo = {
  activo?: boolean | string | number;
  estado?: string;
  lat?: number | string;
  lng?: number | string;
  latitud?: number | string;
  longitud?: number | string;
  actualizadoEn?: string | number;
  ownerUid?: string;
  historial?: Record<string, unknown>;
  alertas?: Record<string, any>;
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
