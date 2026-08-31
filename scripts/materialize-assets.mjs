import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { access, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import unzipper from 'unzipper'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const localArchive = '/home/ubuntu/upload/cloudbound-assets.zip'
const managedArchiveKey = 'cloudbound-assets_31a1f23a.zip'
const expectedArchiveHash = '664a5714a1bbe86c02ac9d5828770b1c641590cba31e081c7606e602beeaafb3'
const temporaryArchive = path.join(projectRoot, '.cloudbound-assets.zip')
const outputRoot = path.join(projectRoot, 'dist/public')

async function exists(filename) {
  try {
    await access(filename)
    return true
  } catch {
    return false
  }
}

async function downloadManagedArchive(destination) {
  const forgeUrl = process.env.BUILT_IN_FORGE_API_URL?.replace(/\/+$/, '')
  const forgeKey = process.env.BUILT_IN_FORGE_API_KEY
  if (!forgeUrl || !forgeKey) {
    throw new Error('Managed File Storage credentials are unavailable during the build')
  }

  const presign = new URL('v1/storage/presign/get', `${forgeUrl}/`)
  presign.searchParams.set('path', managedArchiveKey)
  const signedResponse = await fetch(presign, {
    headers: { Authorization: `Bearer ${forgeKey}` },
  })
  if (!signedResponse.ok) {
    throw new Error(`Unable to sign the Cloudbound archive request: HTTP ${signedResponse.status}`)
  }
  const { url } = await signedResponse.json()
  const archiveResponse = await fetch(url)
  if (!archiveResponse.ok || !archiveResponse.body) {
    throw new Error(`Unable to download the Cloudbound archive: HTTP ${archiveResponse.status}`)
  }
  await pipeline(archiveResponse.body, createWriteStream(destination))
}

async function hashFile(filename) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(filename)) hash.update(chunk)
  return hash.digest('hex')
}

async function extractVerifiedMedia(archivePath) {
  const directory = await unzipper.Open.file(archivePath)
  const files = directory.files.filter(
    (entry) =>
      entry.type === 'File' &&
      /^assets\/(stills|idles|transitions)\/.+\.(png|mp4|webp)$/.test(entry.path),
  )
  if (files.length !== 326) {
    throw new Error(`Expected 326 Cloudbound media files, found ${files.length}`)
  }

  const assetRoot = path.join(outputRoot, 'assets')
  await Promise.all(
    ['stills', 'idles', 'transitions'].map((directoryName) =>
      rm(path.join(assetRoot, directoryName), { recursive: true, force: true }),
    ),
  )
  for (const entry of files) {
    const destination = path.resolve(outputRoot, entry.path)
    if (!destination.startsWith(`${assetRoot}${path.sep}`)) {
      throw new Error(`Invalid archive path: ${entry.path}`)
    }
    await mkdir(path.dirname(destination), { recursive: true })
    await pipeline(entry.stream(), createWriteStream(destination))
  }
}

const useLocalArchive = await exists(localArchive)
const archivePath = useLocalArchive ? localArchive : temporaryArchive
try {
  if (!useLocalArchive) await downloadManagedArchive(temporaryArchive)
  const archiveHash = await hashFile(archivePath)
  if (archiveHash !== expectedArchiveHash) {
    throw new Error(`Cloudbound archive checksum mismatch: ${archiveHash}`)
  }
  await extractVerifiedMedia(archivePath)
  console.log('Materialized 326 checksum-verified Cloudbound media files into dist/public/assets')
} finally {
  if (!useLocalArchive) await rm(temporaryArchive, { force: true })
}
