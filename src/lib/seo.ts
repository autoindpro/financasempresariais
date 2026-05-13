export const BRAND_NAME = "Flux Soluções";
export const APP_NAME = "Finanças Empresariais";
export const APP_TAGLINE = "DRE Gerencial";

export const DEFAULT_TITLE = `${BRAND_NAME} | ${APP_TAGLINE}`;
export const DEFAULT_DESCRIPTION =
  "Plataforma da Flux Soluções para medir e acompanhar a DRE (Demonstração do Resultado do Exercício) das empresas.";

export function getSiteUrl(): string | null {
  const raw = import.meta.env.VITE_SITE_URL as string | undefined;
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}
