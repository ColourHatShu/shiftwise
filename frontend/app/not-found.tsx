import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA] p-6">
      <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
        <p className="text-sm font-medium text-[#003087] mb-2">404</p>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Page not found</h1>
        <p className="text-gray-600 mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/dashboard"
          className="inline-block px-4 py-2 bg-[#003087] text-white rounded-md hover:bg-[#002066] focus:outline-none focus:ring-2 focus:ring-[#003087] focus:ring-offset-2"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
