import { Link } from 'react-router-dom'
import { SUPPORT_EMAIL } from '../lib/support'
import { Card } from '../components/ui/Card'

/** Public privacy policy — required for App Store Connect. */
export function PrivacyPage() {
  return (
    <div className="tech-grid min-h-screen px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link to="/" className="im-pill !px-2.5">
          ← Back to IronMedic
        </Link>
        <Card accent="tech" className="fade-up space-y-4 p-6 text-sm leading-relaxed text-steel-300 sm:p-7">
          <h1 className="text-2xl font-semibold tracking-tight text-steel-50">Privacy Policy</h1>
          <p className="text-steel-500">Last updated: August 2, 2026</p>

          <p>
            IronMedic (“we”, “us”) provides AI-assisted heavy-equipment diagnostic guidance through the
            IronMedic app and website. This policy explains what we collect and how we use it.
          </p>

          <h2 className="pt-2 text-base font-semibold text-steel-100">Information we collect</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Account information (email) if you create an account</li>
            <li>Machine profiles and service notes you enter</li>
            <li>Chat messages you send to Gus, including photos you attach</li>
            <li>Uploaded manuals you choose to add for a machine</li>
            <li>Basic technical logs needed to run and secure the service</li>
          </ul>

          <h2 className="pt-2 text-base font-semibold text-steel-100">How we use information</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>To power diagnostic conversations and improve answers for your machines</li>
            <li>To store your fleet history and repair outcomes you confirm</li>
            <li>To operate, secure, and troubleshoot the app</li>
          </ul>

          <h2 className="pt-2 text-base font-semibold text-steel-100">AI processing</h2>
          <p>
            Messages and photos you send may be processed by third-party AI providers (currently Anthropic)
            solely to generate diagnostic responses. Do not send passwords, payment cards, or unrelated
            personal data in chat.
          </p>

          <h2 className="pt-2 text-base font-semibold text-steel-100">Photos &amp; camera</h2>
          <p>
            Camera and photo library access are used only when you choose to attach an image for diagnosis.
            Images are stored in your private account storage and sent to the diagnostic service for that
            conversation.
          </p>

          <h2 className="pt-2 text-base font-semibold text-steel-100">Data retention &amp; deletion</h2>
          <p>
            You can delete machines and conversation data from the app. You may request full account deletion
            from Account settings. After deletion, associated machine and chat data is removed from our
            systems subject to short-term backup retention.
          </p>

          <h2 className="pt-2 text-base font-semibold text-steel-100">Not professional advice</h2>
          <p>
            IronMedic is a decision-support tool. It does not replace a qualified technician, OEM guidance,
            or safety procedures. Always follow lockout/tagout and manufacturer instructions.
          </p>

          <h2 className="pt-2 text-base font-semibold text-steel-100">Payments</h2>
          <p>
            Paid subscriptions are processed by Stripe. We store your Stripe customer id and
            subscription status on your profile so we can unlock Pro features. We do not store full
            card numbers on IronMedic servers.
          </p>

          <h2 className="pt-2 text-base font-semibold text-steel-100">Contact</h2>
          <p>
            Questions about privacy:{' '}
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=IronMedic%20Privacy`}
              className="text-tech-400 hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>{' '}
            or visit our{' '}
            <Link to="/support" className="text-tech-400 hover:underline">
              Support page
            </Link>
            .
          </p>
        </Card>
      </div>
    </div>
  )
}
