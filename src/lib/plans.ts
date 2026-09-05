/** Product plans shown in pricing UI. Stripe price IDs come from env. */

import type { SubscriptionTier } from './subscription'

/** Card-on-file trial length (days) for new subscribers via Stripe Checkout. */
export const TRIAL_DAYS = 7

/** Basic tier: text diagnostics per calendar month. */
export const BASIC_MONTHLY_MESSAGE_LIMIT = 75

export type PlanId = Exclude<SubscriptionTier, 'free'>

export type Plan = {
  id: PlanId
  name: string
  priceLabel: string
  priceDetail: string
  description: string
  features: string[]
  highlighted?: boolean
  cta: string
}

export const PLANS: Plan[] = [
  {
    id: 'basic',
    name: 'Basic',
    priceLabel: '$14',
    priceDetail: 'CAD / month',
    description: 'Light shop use with a monthly text allowance.',
    features: [
      `${BASIC_MONTHLY_MESSAGE_LIMIT} text diagnostics per month`,
      '7-day free trial · card required',
      'Live web & forum intelligence for your exact make & model',
      'Full fleet & service log',
      'Standard text model (Haiku)',
    ],
    cta: 'Start 7-day free trial',
  },
  {
    id: 'pro',
    name: 'Pro',
    priceLabel: '$24',
    priceDetail: 'CAD / month',
    description: 'Unlimited text diagnostics for everyday shop work.',
    features: [
      'Unlimited text diagnostics',
      '7-day free trial · card required',
      'Live web & forum intelligence for your exact make & model',
      'Full fleet & service log',
      'Manual uploads per machine',
    ],
    highlighted: true,
    cta: 'Start 7-day free trial',
  },
  {
    id: 'premium',
    name: 'Premium',
    priceLabel: '$39',
    priceDetail: 'CAD / month',
    description: 'Unlimited text plus photo analysis when you need Gus to see the problem.',
    features: [
      'Everything in Pro',
      'Photo upload — vision model for photo analysis',
    ],
    cta: 'Start 7-day free trial',
  },
]
