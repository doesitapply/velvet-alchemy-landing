export type ApiEndpointIdentity = {
  method: string;
  path: string;
};

/**
 * A REST path can legitimately appear more than once in an API reference when
 * different HTTP methods operate on it. React keys must distinguish both.
 */
export function getApiEndpointKey({ method, path }: ApiEndpointIdentity): string {
  return `${method.toUpperCase()}:${path}`;
}
