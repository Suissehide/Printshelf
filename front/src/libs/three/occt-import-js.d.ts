// Paquet sans types : seule la fabrique du module WebAssembly est utilisée (voir parse-step.ts).
declare module 'occt-import-js' {
  const occtimportjs: (options?: {
    locateFile?: (file: string) => string
  }) => Promise<unknown>
  export default occtimportjs
}
