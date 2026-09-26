export type ErrorKind =
  | "missing_url"
  | "missing_key"
  | "unauthorized"
  | "rate_limited"
  | "unreachable"
  | "bad_response"
  | "db_unavailable"
  | "already_running";

export class AppError extends Error {
  readonly kind: ErrorKind;
  readonly retryAt: Date | null;

  constructor(kind: ErrorKind, options: { retryAt?: Date | null; cause?: unknown } = {}) {
    super(kind, { cause: options.cause });
    this.name = "AppError";
    this.kind = kind;
    this.retryAt = options.retryAt ?? null;
  }
}

const timeFormat = new Intl.DateTimeFormat("pt-PT", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Lisbon",
});

export function errorMessage(error: AppError): string {
  switch (error.kind) {
    case "missing_url":
      return "Falta configurar o endereço da API (FERRAPEX_API_URL no ficheiro .env).";
    case "missing_key":
      return "Falta configurar a chave da API (FERRAPEX_API_KEY no ficheiro .env).";
    case "unauthorized":
      return "A chave da API é inválida ou expirou.";
    case "rate_limited":
      return error.retryAt
        ? `Demasiados pedidos à API. Nova tentativa às ${timeFormat.format(error.retryAt)}.`
        : "Demasiados pedidos à API. Nova tentativa na próxima sincronização.";
    case "unreachable":
      return "Não foi possível contactar a caixa de encomendas. Nova tentativa na próxima sincronização.";
    case "bad_response":
      return "A caixa de encomendas devolveu dados inesperados.";
    case "db_unavailable":
      return "Não foi possível aceder à base de dados.";
    case "already_running":
      return "Sincronização já em curso.";
  }
}

export function failedEmailsMessage(emailIds: string[]): string {
  return `${emailIds.length} email(s) não foram guardados: ${emailIds.join(", ")}`;
}
