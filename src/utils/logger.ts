type LogLevel = "info" | "warn" | "error";

function write(level: LogLevel, line: string) {
  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export function log(level: LogLevel, message: string, fields: Record<string, unknown> = {}) {
  write(level, JSON.stringify({ time: new Date().toISOString(), level, message, ...fields }));
}
