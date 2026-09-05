/**
 * Verify StoreKit 2 / App Store Server Notifications V2 JWS locally.
 * Pins the x5c chain to Apple Root CA - G3 (no App Store Server API key required).
 */
import * as jose from 'npm:jose@5.10.0'
import * as x509 from 'npm:@peculiar/x509@1.12.3'
import { APPLE_BUNDLE_ID, isKnownAppleProductId } from './applePlans.ts'

/** Official Apple Root CA - G3 (https://www.apple.com/certificateauthority/). */
const APPLE_ROOT_CA_G3_PEM = `-----BEGIN CERTIFICATE-----
MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwS
QXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9u
IEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcN
MTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBS
b290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9y
aXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49
AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtf
TjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517
IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySr
MA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gA
MGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4
at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM
6BgD56KyKA==
-----END CERTIFICATE-----`

const APPLE_ROOT_CA_G3_FINGERPRINT256 = '63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179'

export type AppleTransaction = {
  transactionId: string
  originalTransactionId: string
  productId: string
  bundleId: string
  purchaseDate: number
  expiresDate: number | null
  revocationDate: number | null
  environment: 'Sandbox' | 'Production'
  appAccountToken: string | null
  type: string | null
}

export type AppleNotification = {
  notificationType: string
  subtype: string | null
  environment: string | null
  transaction: AppleTransaction | null
}

function base64UrlToBytes(part: string): Uint8Array<ArrayBuffer> {
  const padded = part.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((part.length + 3) % 4)
  return bytesFromBinary(atob(padded))
}

function decodeJsonPart(part: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(part))) as Record<string, unknown>
}

function bytesFromBinary(bin: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function derFromX5c(entry: string): Uint8Array<ArrayBuffer> {
  return bytesFromBinary(atob(entry))
}

function pemFromX5c(entry: string): string {
  const lines = entry.match(/.{1,64}/g) ?? [entry]
  return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----`
}

async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function verifyAppleCertChain(x5c: string[]): Promise<void> {
  if (!x5c.length) throw new Error('missing_x5c')

  const chain = x5c.map((entry) => new x509.X509Certificate(derFromX5c(entry)))
  const root = new x509.X509Certificate(APPLE_ROOT_CA_G3_PEM)
  const rootFp = APPLE_ROOT_CA_G3_FINGERPRINT256

  for (let i = 0; i < chain.length - 1; i++) {
    const ok = await chain[i].verify({ publicKey: await chain[i + 1].publicKey })
    if (!ok) throw new Error('invalid_cert_chain')
  }

  const last = chain[chain.length - 1]
  const lastFp = await sha256Hex(new Uint8Array(last.rawData.slice(0)))
  if (lastFp === rootFp) return

  const signedByRoot = await last.verify({ publicKey: await root.publicKey })
  if (!signedByRoot) throw new Error('untrusted_apple_root')
}

function asMillis(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function transactionFromPayload(payload: Record<string, unknown>): AppleTransaction {
  const productId = asString(payload.productId) ?? ''
  const bundleId = asString(payload.bundleId) ?? ''
  const environment = payload.environment === 'Sandbox' ? 'Sandbox' : 'Production'
  return {
    transactionId: asString(payload.transactionId) ?? '',
    originalTransactionId: asString(payload.originalTransactionId) ?? asString(payload.transactionId) ?? '',
    productId,
    bundleId,
    purchaseDate: asMillis(payload.purchaseDate) ?? 0,
    expiresDate: asMillis(payload.expiresDate),
    revocationDate: asMillis(payload.revocationDate),
    environment,
    appAccountToken: asString(payload.appAccountToken),
    type: asString(payload.type),
  }
}

export function isAppleEntitlementActive(tx: AppleTransaction, now = Date.now()): boolean {
  if (tx.revocationDate && tx.revocationDate <= now) return false
  if (tx.expiresDate != null && tx.expiresDate <= now) return false
  return Boolean(tx.productId) && isKnownAppleProductId(tx.productId)
}

export async function verifyAppleJws(jws: string): Promise<Record<string, unknown>> {
  if (typeof jws !== 'string' || jws.split('.').length !== 3) {
    throw new Error('invalid_jws')
  }
  const [headerPart] = jws.split('.')
  const header = decodeJsonPart(headerPart)
  const x5c = header.x5c
  if (!Array.isArray(x5c) || x5c.length === 0 || typeof x5c[0] !== 'string') {
    throw new Error('missing_x5c')
  }

  await verifyAppleCertChain(x5c as string[])

  const alg = typeof header.alg === 'string' ? header.alg : 'ES256'
  const key = await jose.importX509(pemFromX5c(x5c[0]), alg)
  const { payload } = await jose.compactVerify(jws, key)
  return JSON.parse(new TextDecoder().decode(payload)) as Record<string, unknown>
}

export async function verifyAndDecodeTransaction(jws: string): Promise<AppleTransaction> {
  const payload = await verifyAppleJws(jws)
  const tx = transactionFromPayload(payload)
  if (!tx.transactionId || !tx.originalTransactionId) throw new Error('missing_transaction_id')
  if (tx.bundleId !== APPLE_BUNDLE_ID) throw new Error('bundle_mismatch')
  if (!isKnownAppleProductId(tx.productId)) throw new Error('unknown_product')
  return tx
}

export async function verifyAndDecodeNotification(signedPayload: string): Promise<AppleNotification> {
  const payload = await verifyAppleJws(signedPayload)
  const data = (payload.data ?? {}) as Record<string, unknown>
  const signedTx = asString(data.signedTransactionInfo)
  let transaction: AppleTransaction | null = null
  if (signedTx) {
    try {
      transaction = await verifyAndDecodeTransaction(signedTx)
    } catch {
      // Renewal info–only notifications may omit a current product we sell.
      const inner = await verifyAppleJws(signedTx)
      const decoded = transactionFromPayload(inner)
      if (decoded.bundleId && decoded.bundleId !== APPLE_BUNDLE_ID) throw new Error('bundle_mismatch')
      transaction = decoded.transactionId ? decoded : null
    }
  }
  return {
    notificationType: asString(payload.notificationType) ?? '',
    subtype: asString(payload.subtype),
    environment: asString(payload.environment) ?? asString(data.environment),
    transaction,
  }
}
