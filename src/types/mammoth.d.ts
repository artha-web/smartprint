declare module "mammoth" {
  export interface Result {
    value: string;
    messages: Array<{
      type: string;
      message: string;
    }>;
  }

  export function convertToHtml(
    input: { buffer?: Buffer | ArrayBuffer | Uint8Array; arrayBuffer?: ArrayBuffer; path?: string },
    options?: Record<string, unknown>
  ): Promise<Result>;

  export function extractRawText(
    input: { buffer?: Buffer | ArrayBuffer | Uint8Array; arrayBuffer?: ArrayBuffer; path?: string }
  ): Promise<{ value: string; messages: unknown[] }>;
}
