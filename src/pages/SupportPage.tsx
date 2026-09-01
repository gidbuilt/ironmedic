import { Link } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { supportMailtoUrl } from '../lib/support'

/** Public support page — required for App Store Connect Support URL. */
export function SupportPage() {
  return (
    <div className="tech-grid min-h-screen px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link to="/" className="im-pill !px-2.5">
          ← Back to IronMedic
        </Link>
        <Card accent="tech" className="fade-up space-y-4 p-6 text-sm leading-relaxed text-steel-300 sm:p-7">
          <h1 className="text-2xl font-semibold tracking-tight text-steel-50">Support</h1>
          <p className="text-steel-500">IronMedic — AI heavy-equipment diagnostics with Gus</p>

          <p>
            Need help with the app, your account, billing, or a diagnostic conversation? Send us a message
            and we&apos;ll get back to you as soon as we can.
          </p>

          <div className="rounded-2xl border border-steel-700/80 bg-steel-950/50 px-4 py-4">
            <p className="font-mono text-[10px] tracking-[0.16em] text-steel-500 uppercase">Contact</p>
            <a href={supportMailtoUrl()} className="mt-3 inline-block">
              <Button type="button">Email IronMedic support</Button>
            </a>
            <p className="mt-3 text-steel-400">
              Opens your mail app with a pre-filled subject line. Include your device (iPhone/iPad), iOS
              version, and a short description of the issue. Screenshots help if something looks broken.
            </p>
          </div>

          <h2 className="pt-2 text-base font-semibold text-steel-100">Common questions</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="font-medium text-steel-200">Create an account:</strong> Menu → Sign in →
              Create an account, or Account → Save this account. You may need to confirm your email before
              signing in.
            </li>
            <li>
              <strong className="font-medium text-steel-200">Free tier:</strong> Each account includes a
              limited number of Gus messages. Upgrade to Pro from Pricing in the app menu.
            </li>
            <li>
              <strong className="font-medium text-steel-200">Delete my data:</strong> Account → Delete my
              data.
            </li>
          </ul>

          <h2 className="pt-2 text-base font-semibold text-steel-100">Privacy</h2>
          <p>
            See our{' '}
            <Link to="/privacy" className="text-tech-400 hover:underline">
              Privacy Policy
            </Link>{' '}
            for how we handle your data.
          </p>
        </Card>
      </div>
    </div>
  )
}
