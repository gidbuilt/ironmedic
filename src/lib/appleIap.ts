import { NativePurchases, PURCHASE_TYPE, type Product, type Transaction } from '@capgo/native-purchases'
import { supabase } from './supabase'
import type { PlanId } from './plans'
import { APPLE_PRODUCT_ID_LIST, appleProductIdForPlan } from './appleProducts'
import type { SubscriptionTier } from './subscription'
import { isNativeIos } from './platform'

export class AppleIapCancelledError extends Error {
  constructor() {
    super('Purchase canceled')
    this.name = 'AppleIapCancelledError'
  }
}

export class AppleIapUnavailableError extends Error {
  constructor(message = 'App Store billing is not available on this device.') {
    super(message)
    this.name = 'AppleIapUnavailableError'
  }
}

function isUserCancelled(err: unknown): boolean {
  const code = typeof err === 'object' && err && 'code' in err ? String((err as { code?: unknown }).code) : ''
  const message = err instanceof Error ? err.message : String(err)
  return (
    /cancel/i.test(code) ||
    /cancel/i.test(message) ||
    /USER_CANCELLED/i.test(code) ||
    /PURCHASE_CANCELLED/i.test(code)
  )
}

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not signed in')
  const base = import.meta.env.VITE_SUPABASE_URL
  if (!base) throw new Error('Missing VITE_SUPABASE_URL')
  return {
    Authorization: `Bearer ${token}`,
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
    'Content-Type': 'application/json',
  }
}

async function postVerify(signedTransactions: string[]): Promise<{
  tier: SubscriptionTier
  upgraded?: boolean
}> {
  const base = import.meta.env.VITE_SUPABASE_URL
  const headers = await authHeaders()
  const res = await fetch(`${base}/functions/v1/verify-apple-purchase`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ signedTransactions }),
  })
  const json = (await res.json()) as {
    tier?: SubscriptionTier
    upgraded?: boolean
    error?: string
    message?: string
  }
  if (!res.ok || !json.tier) {
    throw new Error(json.message || json.error || `App Store verification failed (${res.status})`)
  }
  return { tier: json.tier, upgraded: json.upgraded }
}

function signedJws(tx: Transaction): string | null {
  return tx.jwsRepresentation && tx.jwsRepresentation.includes('.') ? tx.jwsRepresentation : null
}

export async function loadAppleProducts(): Promise<Product[]> {
  if (!isNativeIos()) return []
  const supported = await NativePurchases.isBillingSupported()
  if (!supported.isBillingSupported) return []
  const { products } = await NativePurchases.getProducts({
    productIdentifiers: APPLE_PRODUCT_ID_LIST,
    productType: PURCHASE_TYPE.SUBS,
  })
  return products
}

export async function purchaseApplePlan(plan: PlanId, userId: string): Promise<{
  tier: SubscriptionTier
  upgraded?: boolean
}> {
  if (!isNativeIos()) throw new AppleIapUnavailableError()
  const supported = await NativePurchases.isBillingSupported()
  if (!supported.isBillingSupported) throw new AppleIapUnavailableError()

  let transaction: Transaction
  try {
    transaction = await NativePurchases.purchaseProduct({
      productIdentifier: appleProductIdForPlan(plan),
      productType: PURCHASE_TYPE.SUBS,
      appAccountToken: userId,
    })
  } catch (err) {
    if (isUserCancelled(err)) throw new AppleIapCancelledError()
    throw err instanceof Error ? err : new Error('App Store purchase failed.')
  }

  const jws = signedJws(transaction)
  if (!jws) {
    throw new Error('The App Store did not return a signed transaction. Try Restore purchases.')
  }
  return postVerify([jws])
}

export async function restoreApplePurchases(): Promise<{
  tier: SubscriptionTier
  upgraded?: boolean
}> {
  if (!isNativeIos()) throw new AppleIapUnavailableError()
  await NativePurchases.restorePurchases()
  const { purchases } = await NativePurchases.getPurchases({
    productType: PURCHASE_TYPE.SUBS,
    onlyCurrentEntitlements: true,
  })
  const signed = purchases.map(signedJws).filter((jws): jws is string => Boolean(jws))
  if (!signed.length) {
    throw new Error('No active App Store subscription found for this Apple ID.')
  }
  return postVerify(signed)
}

export async function manageAppleSubscriptions(): Promise<void> {
  if (!isNativeIos()) throw new AppleIapUnavailableError()
  await NativePurchases.manageSubscriptions()
}

export function appleProductByPlan(products: Product[], plan: PlanId): Product | undefined {
  const id = appleProductIdForPlan(plan)
  return products.find((product) => product.identifier === id)
}

let transactionListenerStarted = false

/** Finish / re-verify StoreKit 2 transactions that arrive while the app is open. */
export async function initAppleIapListeners(): Promise<void> {
  if (!isNativeIos() || transactionListenerStarted) return
  transactionListenerStarted = true
  await NativePurchases.addListener('transactionUpdated', (transaction) => {
    const jws = signedJws(transaction)
    if (!jws) return
    void postVerify([jws]).catch((err) => {
      console.warn('[iap] pending transaction verify failed', err)
    })
  })
}
