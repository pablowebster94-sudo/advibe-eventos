/** Next llama a `register` una vez al arrancar el servidor. */
export async function register() {
  // Solo en Node: better-sqlite3 es nativo y no existe en el runtime edge.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ensureCurrentEvent } = await import("./lib/currentEvent");
  ensureCurrentEvent();
}
