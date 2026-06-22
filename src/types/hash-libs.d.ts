// Ambient module declarations for the lightweight, dependency-free hashing
// libraries. These ship as CommonJS and either lack types or expose loose
// ones; we declare the minimal synchronous surface HashLens uses.

declare module 'js-md5' {
  interface Hasher {
    update(data: string | ArrayBuffer | Uint8Array | number[]): Hasher;
    hex(): string;
  }
  interface Md5 {
    (data: string | ArrayBuffer | Uint8Array | number[]): string;
    create(): Hasher;
    update(data: string | ArrayBuffer | Uint8Array | number[]): Hasher;
  }
  const md5: Md5;
  export = md5;
}

declare module 'js-sha1' {
  interface Sha1 {
    (data: string | ArrayBuffer | Uint8Array | number[]): string;
  }
  const sha1: Sha1;
  export = sha1;
}

declare module 'js-sha256' {
  export function sha256(data: string | ArrayBuffer | Uint8Array | number[]): string;
}

declare module 'js-sha512' {
  export function sha512(data: string | ArrayBuffer | Uint8Array | number[]): string;
}
