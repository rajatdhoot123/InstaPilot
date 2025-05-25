"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ConnectedInstagramAccount {
  id: string;
  instagramUserId: string;
  instagramUsername: string;
  accessTokenExpiresAt: string | null;
  createdAt: string;
}

export default function SelectAccountPage() {
  const router = useRouter();
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedInstagramAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const response = await fetch("/api/instagram/accounts");
        if (!response.ok) {
          throw new Error("Failed to fetch connected accounts");
        }
        const accounts = await response.json();
        setConnectedAccounts(accounts);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load accounts");
      } finally {
        setLoading(false);
      }
    };

    fetchAccounts();
  }, []);

  const handleAccountSelect = (accountId: string) => {
    router.push(`/post?accountId=${accountId}`);
  };

  const isTokenExpiringSoon = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    const expirationDate = new Date(expiresAt);
    const now = new Date();
    const daysUntilExpiration = Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiration <= 7;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your Instagram accounts...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-500 text-2xl">⚠️</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Accounts</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (connectedAccounts.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-6">
          <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-xl">IG</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">No Instagram Accounts Connected</h1>
          <p className="text-gray-600 mb-6">
            You need to connect at least one Instagram account before you can post.
          </p>
          <Link
            href="/dashboard"
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-3 px-6 rounded-lg inline-block transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Select Instagram Account</h1>
            <p className="text-gray-600 mt-1">Choose which account you want to post from</p>
          </div>
          <Link
            href="/dashboard"
            className="text-gray-500 hover:text-gray-700 font-medium"
          >
            ← Back to Dashboard
          </Link>
        </div>

        {/* Account Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {connectedAccounts.map((account) => (
            <div
              key={account.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 cursor-pointer group"
              onClick={() => handleAccountSelect(account.instagramUserId)}
            >
              <div className="p-6">
                {/* Account Info */}
                <div className="flex items-center space-x-4 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-lg">IG</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-gray-900">@{account.instagramUsername}</h3>
                    <p className="text-sm text-gray-500">ID: {account.instagramUserId}</p>
                  </div>
                </div>

                {/* Token Status */}
                <div className="mb-4">
                  {account.accessTokenExpiresAt ? (
                    <div className={`text-xs px-2 py-1 rounded-full inline-block ${
                      isTokenExpiringSoon(account.accessTokenExpiresAt)
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-green-100 text-green-800"
                    }`}>
                      {isTokenExpiringSoon(account.accessTokenExpiresAt)
                        ? "Token expires soon"
                        : "Token active"
                      }
                    </div>
                  ) : (
                    <div className="text-xs px-2 py-1 rounded-full inline-block bg-gray-100 text-gray-600">
                      No expiration info
                    </div>
                  )}
                </div>

                {/* Connected Date */}
                <p className="text-xs text-gray-500 mb-4">
                  Connected: {new Date(account.createdAt).toLocaleDateString()}
                </p>

                {/* Action Button */}
                <button className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md group-hover:shadow-lg">
                  Post to this Account
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Alternative Actions */}
        <div className="mt-8 text-center">
          <p className="text-gray-600 mb-4">Or</p>
          <div className="space-x-4">
            <Link
              href="/post"
              className="bg-white hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded-lg border border-gray-300 hover:border-gray-400 transition-colors duration-200"
            >
              Post to Any Account
            </Link>
            <Link
              href="/api/auth/instagram/login"
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200"
            >
              Connect Another Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 