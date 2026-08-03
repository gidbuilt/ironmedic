/** Product plans shown in pricing UI. Stripe price IDs come from env. */

export const FREE_DIAGNOSIS_LIMIT = 3

export type PlanId = 'free' | 'pro'

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
    id: 'free',
    name: 'Free',
    priceLabel: '$0',
    priceDetail: 'to start',
    description: 'Try Gus on a couple of real jobs before you commit.',
    features: [
      `${FREE_DIAGNOSIS_LIMIT} free diagnoses`,
      'Photo attachments',
      'Machine history on this account',
      'No credit card required',
    ],
    cta: 'Continue free',
  },
  {
    id: 'pro',
    name: 'Pro',
    priceLabel: '$12',
    priceDetail: 'CAD / month',
    description: 'Unlimited diagnostic chats with Gus for your fleet.',
    features: [
      'Unlimited diagnoses',
      'Full fleet & service log',
      'Manual uploads for each machine',
      'Priority access as we ship new modes',
    ],
    highlighted: true,
    cta: 'Upgrade to Pro',
  },
]
