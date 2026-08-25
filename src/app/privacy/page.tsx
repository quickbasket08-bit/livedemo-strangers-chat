export default function PrivacyPage() {
  return (
    <main className="flex-1 max-w-2xl mx-auto px-6 py-12 prose prose-invert prose-sm">
      <h1>Privacy Policy (template — replace before launch)</h1>
      <p>
        This is placeholder text, not legal advice. Have a lawyer review a real
        privacy policy before launch — requirements differ by region (GDPR, CCPA,
        etc.), and this app handles live video/audio between strangers.
      </p>
      <h2>What we store</h2>
      <ul>
        <li>A random session ID and the username you typed — no email or password.</li>
        <li>Text chat messages, associated with the room and sender, for abuse investigation.</li>
        <li>Reports you submit (reason, optional details, who was reported).</li>
      </ul>
      <h2>What we don't store</h2>
      <p>
        Video/audio streams are relayed live through LiveKit and are not recorded or
        stored by this application by default.
      </p>
      <h2>Retention</h2>
      <p>
        Define and document a real retention/deletion schedule for messages and
        reports before launch.
      </p>
    </main>
  );
}
