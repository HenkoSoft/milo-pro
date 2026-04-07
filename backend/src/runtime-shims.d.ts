declare const require: (id: string) => any;
declare const __dirname: string;
declare const process: {
  env: Record<string, string | undefined>;
  exit(code?: number): never;
};
declare const Buffer: {
  from(input: unknown): unknown;
};

declare module 'bcryptjs' {
  const bcrypt: {
    hashSync: (value: string, rounds: number) => string;
  };
  export default bcrypt;
}
