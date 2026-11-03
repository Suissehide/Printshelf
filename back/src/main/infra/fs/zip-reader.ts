import fs from 'node:fs/promises'
import zlib from 'node:zlib'

// Lecteur ZIP minimal, sans dépendance. Sert aux 3MF (qui sont des ZIP) et aux archives .zip
// parcourues comme des dossiers. Ne lit que le répertoire central puis l'entrée demandée :
// un pack de plusieurs Go n'est jamais chargé en mémoire.
// ponytail: pas de ZIP64 (archive > 4 Go ou > 65 535 entrées) ni de chiffrement. RAR/7z : archive.ts.

export type ByteSource = {
  size: number
  read: (offset: number, length: number) => Promise<Buffer>
  close: () => Promise<void>
}

export type ZipEntry = {
  name: string
  method: number
  compressedSize: number
  size: number
  localOffset: number
}

export const bufferSource = (buffer: Buffer): ByteSource => ({
  size: buffer.length,
  read: async (offset, length) => buffer.subarray(offset, offset + length),
  close: () => Promise.resolve(),
})

export const fileSource = async (filePath: string): Promise<ByteSource> => {
  const handle = await fs.open(filePath, 'r')
  const { size } = await handle.stat()
  return {
    size,
    read: async (offset, length) => {
      const buffer = Buffer.alloc(length)
      const { bytesRead } = await handle.read(buffer, 0, length, offset)
      return buffer.subarray(0, bytesRead)
    },
    close: () => handle.close(),
  }
}

const EOCD_SIGNATURE = 0x06054b50
const CENTRAL_SIGNATURE = 0x02014b50

export const listEntries = async (source: ByteSource): Promise<ZipEntry[]> => {
  // L'EOCD fait 22 octets plus un commentaire d'au plus 65 535 octets.
  const tailLength = Math.min(source.size, 22 + 65_535)
  const tail = await source.read(source.size - tailLength, tailLength)
  let eocd = tail.length - 22
  while (eocd >= 0 && tail.readUInt32LE(eocd) !== EOCD_SIGNATURE) {
    eocd--
  }
  if (eocd < 0) {
    return []
  }
  const count = tail.readUInt16LE(eocd + 10)
  const centralSize = tail.readUInt32LE(eocd + 12)
  const centralOffset = tail.readUInt32LE(eocd + 16)
  const central = await source.read(centralOffset, centralSize)

  const entries: ZipEntry[] = []
  let offset = 0
  for (
    let i = 0;
    i < count && central.readUInt32LE(offset) === CENTRAL_SIGNATURE;
    i++
  ) {
    const flags = central.readUInt16LE(offset + 8)
    const nameLength = central.readUInt16LE(offset + 28)
    const extraLength = central.readUInt16LE(offset + 30)
    const commentLength = central.readUInt16LE(offset + 32)
    const rawName = central.subarray(offset + 46, offset + 46 + nameLength)
    // Bit 11 : nom en UTF-8. Sinon CP437, que latin1 approche assez pour les noms usuels.
    const name = rawName.toString(flags & 0x800 ? 'utf8' : 'latin1')
    if (!name.endsWith('/')) {
      entries.push({
        name,
        method: central.readUInt16LE(offset + 10),
        compressedSize: central.readUInt32LE(offset + 20),
        size: central.readUInt32LE(offset + 24),
        localOffset: central.readUInt32LE(offset + 42),
      })
    }
    offset += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

export const readEntry = async (
  source: ByteSource,
  entry: ZipEntry,
): Promise<Buffer> => {
  const header = await source.read(entry.localOffset, 30)
  const dataStart =
    entry.localOffset + 30 + header.readUInt16LE(26) + header.readUInt16LE(28)
  const raw = await source.read(dataStart, entry.compressedSize)
  if (entry.method === 0) {
    return raw
  }
  if (entry.method === 8) {
    return zlib.inflateRawSync(raw)
  }
  throw new Error(`Compression ZIP non gérée (méthode ${entry.method})`)
}

export const withZip = async <T>(
  source: ByteSource,
  fn: (entries: ZipEntry[], source: ByteSource) => Promise<T>,
): Promise<T> => {
  try {
    return await fn(await listEntries(source), source)
  } finally {
    await source.close()
  }
}
