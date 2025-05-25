import { auth, signOut } from "../../auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { instagramConnections } from "@/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";

interface ConnectedInstagramAccount {
  id: string; // connection id
  instagramUserId: string;
  instagramUsername: string;
  // Add other fields you might want to display, e.g., accessTokenExpiresAt
}

export default async function DashboardPage() {
  // Server-side authentication check using NextAuth 5
  const session = await auth();
  
  // If user is not authenticated, redirect to login
  if (!session?.user?.id) {
    redirect("/login");
  }

  const appUserId = session.user.id;
  let connectedAccounts: ConnectedInstagramAccount[] = [];
  let fetchError: string | null = null;

  try {
    const accountsFromDb = await db
      .select({
        id: instagramConnections.id,
        instagramUserId: instagramConnections.instagramUserId,
        instagramUsername: instagramConnections.instagramUsername,
      })
      .from(instagramConnections)
      .where(eq(instagramConnections.appUserId, appUserId));
    
    connectedAccounts = accountsFromDb;
  } catch (error) {
    console.error("Error fetching connected Instagram accounts:", error);
    fetchError = "Could not load connected accounts. Please try again later.";
  }

  const userName = session.user.name || session.user.email || "User";
  const instagramAuthUrl = "/api/auth/instagram/login"; // Your backend endpoint to initiate Instagram OAuth

  return (
    <div className="container mx-auto p-4">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <p className="text-sm text-gray-600">Welcome back,</p>
            <p className="font-semibold">{userName}</p>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors duration-200"
            >
              Sign Out
            </button>
          </form>
        </div>
      </header>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-3">Manage Instagram Connection</h2>
        {!connectedAccounts.length && !fetchError && (
          <p className="mb-4 text-gray-600">
            You have not connected your Instagram account yet.
          </p>
        )}
        <Link 
          href={instagramAuthUrl} 
          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-3 px-6 rounded-lg inline-block transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          Connect Instagram Account
        </Link>
      </section>

      {fetchError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-4" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{fetchError}</span>
        </div>
      )}

      {connectedAccounts.length > 0 && (
        <section>
          <h2 className="text-2xl font-semibold mb-3">Your Connected Instagram Accounts</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {connectedAccounts.map((account) => (
              <div key={account.id} className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">IG</span>
                  </div>
                  <div>
                    <p className="font-semibold text-lg">@{account.instagramUsername}</p>
                    <p className="text-sm text-gray-500">ID: {account.instagramUserId}</p>
                  </div>
                </div>
                {/* Add more details or actions like "Disconnect" here */}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
