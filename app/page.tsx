import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SignOutButton } from "@/components/signout-button";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <main className="flex flex-col items-center gap-6 text-center px-6">
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-bold">
            Welcome, {session.user?.name || session.user?.email || "User"}!
          </h1>
          {session.user?.email && (
            <p className="text-muted-foreground">
              Signed in as {session.user.email}
            </p>
          )}
          {session.user?.role && (
            <p className="text-sm text-muted-foreground">
              Role: {session.user.role}
            </p>
          )}
        </div>
        <div className="flex gap-4">
          {session.user?.role === "ADMIN" && (
            <Link href="/admin/whitelist">
              <Button variant="outline">Manage Whitelist</Button>
            </Link>
          )}
          <SignOutButton />
        </div>
      </main>
    </div>
  );
}
