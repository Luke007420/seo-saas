export default function TermsPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold">Terms of Service</h1>
      <p className="mt-4 text-sm text-gray-700">
        By using this service you agree to our acceptable use, monthly billing via Stripe,
        and that generated content is provided “as-is”. You are responsible for reviewing
        content before publishing. Refunds are handled case-by-case via support.
      </p>
    </div>
  );
}
