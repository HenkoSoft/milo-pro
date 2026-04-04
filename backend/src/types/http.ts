export interface RequestLike<TBody = unknown, THeaders extends Record<string, string | string[] | undefined> = Record<string, string | string[] | undefined>> {
  body?: TBody;
  headers: THeaders;
}

export interface AuthenticatedRequestLike<TBody = unknown> extends RequestLike<TBody> {
  user?: {
    id: number;
    username: string;
    role: string;
    name: string;
  };
}
