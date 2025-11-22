import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getWhitelistEmails } from "@/lib/services/whitelist.server";
import { WhitelistManager } from "@/components/whitelist-manager";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default async function WhitelistPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  const whitelist = await getWhitelistEmails();

  return (
    <div className="container mx-auto py-10">
      <div className="mb-6">
        <Link href="/">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="size-4 mr-2" />
            Back to Home
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Manage Whitelist</h1>
        <p className="text-muted-foreground mt-2">
          Add, edit, or remove emails from the whitelist. Only whitelisted emails can login.
        </p>
      </div>
      <WhitelistManager initialData={whitelist} />
    </div>
  );
}

