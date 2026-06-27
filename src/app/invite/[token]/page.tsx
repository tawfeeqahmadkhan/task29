import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import InviteClient from "./InviteClient";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: Props) {
  const session = await auth();
  const { token } = await params;

  // Pre-fetch invitation info server-side
  const res = await fetch(`${process.env.NEXTAUTH_URL}/api/invite/${token}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Invitation</h1>
          <p className="text-gray-500">This invitation link is invalid or has expired.</p>
          <a href="/" className="mt-4 inline-block text-indigo-600 hover:underline">Go home</a>
        </div>
      </div>
    );
  }

  const data = await res.json();

  return <InviteClient token={token} invitation={data.invitation} isLoggedIn={!!session?.user} />;
}
