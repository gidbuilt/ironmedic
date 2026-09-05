import { assertEquals } from 'jsr:@std/assert@1'
import * as x509 from 'npm:@peculiar/x509@1.12.3'
import { isKnownAppleProductId, tierFromAppleProductId } from './applePlans.ts'
import { isAppleEntitlementActive, transactionFromPayload } from './appleJws.ts'

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

Deno.test('App Store product IDs map to the same tiers Stripe uses', () => {
  assertEquals(tierFromAppleProductId('com.ironmedic.app.basic.monthly'), 'basic')
  assertEquals(tierFromAppleProductId('com.ironmedic.app.pro.monthly'), 'pro')
  assertEquals(tierFromAppleProductId('com.ironmedic.app.premium.monthly'), 'premium')
  assertEquals(isKnownAppleProductId('com.ironmedic.app.pro.monthly'), true)
  assertEquals(isKnownAppleProductId('com.other.app.pro'), false)
})

Deno.test('Apple Root CA G3 PEM parses', () => {
  const cert = new x509.X509Certificate(APPLE_ROOT_CA_G3_PEM)
  assertEquals(cert.subject, 'CN=Apple Root CA - G3, OU=Apple Certification Authority, O=Apple Inc., C=US')
})

Deno.test('signed transaction payload unlocks while unexpired and not revoked', () => {
  const now = Date.UTC(2026, 8, 5)
  const tx = transactionFromPayload({
    transactionId: '200000012345',
    originalTransactionId: '200000012300',
    productId: 'com.ironmedic.app.pro.monthly',
    bundleId: 'com.ironmedic.app',
    purchaseDate: now - 60_000,
    expiresDate: now + 86_400_000,
    environment: 'Sandbox',
    appAccountToken: '11111111-1111-1111-1111-111111111111',
  })
  assertEquals(tx.productId, 'com.ironmedic.app.pro.monthly')
  assertEquals(isAppleEntitlementActive(tx, now), true)
  assertEquals(isAppleEntitlementActive({ ...tx, expiresDate: now - 1 }, now), false)
  assertEquals(isAppleEntitlementActive({ ...tx, revocationDate: now }, now), false)
})
