/** El slug va en la URL pública que se imprime en el QR (`/g/<slug>`), así que
 *  se normaliza a algo corto, sin acentos y escribible a mano:
 *  "Boda Ana & Luis 2026" → "boda-ana-luis-2026". */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, MAX_SLUG)
    .replace(/^-+|-+$/g, "");
}

export const MIN_SLUG = 2;
export const MAX_SLUG = 60;

/** Lo que `slugify` produce y lo único que se acepta si el operador lo escribe
 *  a mano: minúsculas, dígitos y guiones simples, sin guion al principio ni al final. */
export function isValidSlug(slug: string): boolean {
  return (
    slug.length >= MIN_SLUG &&
    slug.length <= MAX_SLUG &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
  );
}
