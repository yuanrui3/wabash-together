import { TERMS_VERSION } from "../../lib/community";

export default function Terms() {
  return (
    <main className="shell legal-page">
      <a className="back-link" href="/">Back to Wabash Together</a>
      <h1>Terms of Use</h1>
      <p>Version {TERMS_VERSION}</p>

      <h2>Introductions and independent arrangements</h2>
      <p>Wabash Together provides a board for posting information and requesting introductions. Each participant independently decides whom to contact, whether to proceed, and how to arrange any trip or vehicle use outside the site. A post, introduction, or email exchange creates no obligation to ride, lend a vehicle, or pay anyone.</p>
      <p>The site’s role ends with the introduction. Participants arrange routes, schedules, lawful contributions to shared expenses, bookings, payments, applicable taxes, and any other agreements separately. Neighborhood distances are estimates for comparison and do not reflect live traffic, door-to-door routes, or exact pickup locations.</p>

      <h2>Who can participate</h2>
      <p>Use the board only if you are at least 18 years old. Post accurate information and respect others’ privacy. Leave exact addresses, phone numbers, email addresses, and payment requests out of public posts. Harassment, fraud, and unauthorized commercial solicitations are prohibited. The operator may limit access or remove posts that violate these terms.</p>

      <h2>Driver and vehicle responsibilities</h2>
      <p>Participants are responsible for evaluating each arrangement. Before driving or sharing a car, confirm the driver is properly licensed and authorized, the vehicle is safe and registered, and the relevant insurer covers the specific use. Ask the insurer about liability, damage to the vehicle, deductibles, and any effect of payment or cost sharing. Owners should check applicable lease, financing, and lien terms.</p>
      <p>Sign-in identifies a site account. Before making arrangements, verify the other participant’s identity and the details you rely on. You can leave an arrangement at any time before committing to it, subject to any separate terms you have agreed to.</p>

      <h2>Assumption of risk and limits on liability</h2>
      <p><strong>Travel and vehicle use can result in injury, death, property damage, or financial loss.</strong> By choosing to participate in an independent arrangement, you voluntarily assume the risks arising from the trip, the condition or use of a vehicle, and the conduct of other participants.</p>
      <p><strong>To the extent permitted by law, the site operator is not liable for injuries, damage, losses, disputes, or costs caused by other users or arising from the independent arrangements they make.</strong> Users are responsible for their own actions and their separate agreements. Nothing in these terms limits liability for the operator’s own conduct where the law imposes liability that cannot be limited, or waives any right or remedy you cannot waive under applicable law.</p>
      <p>The site is provided as available. To the extent permitted by law, the operator makes no warranty about uptime, post accuracy, participant suitability, route estimates, or any third-party service. Indiana law applies to these terms to the extent permitted by applicable law.</p>

      <h2>Contact sharing</h2>
      <p>Requesting an introduction authorizes the exchange of your account email with that particular participant if they accept. Accepting an introduction authorizes the same exchange with the requester. Your use of information received through an introduction is limited to that introduction. See the <a href="/privacy">Privacy Notice</a> for details.</p>
    </main>
  );
}
