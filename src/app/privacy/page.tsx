export default function PrivacyPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold">Privacy Policy</h1>
      <p className="mt-4 text-sm text-gray-700">
        We store your account email, generation history, and subscription status.
        Payments are processed by Stripe; we don’t store card details.
        Contact support to delete your account and data.
      </p>
    </div>
  );
}
