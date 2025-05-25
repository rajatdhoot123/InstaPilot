"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

interface ConnectedInstagramAccount {
  id: string;
  instagramUserId: string;
  instagramUsername: string;
}

interface PostFormData {
  imageUrl: string;
  caption: string;
  selectedAccountId: string;
}

export default function PostPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedAccountId = searchParams.get("accountId");

  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedInstagramAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [postSuccess, setPostSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState<PostFormData>({
    imageUrl: "",
    caption: "",
    selectedAccountId: preselectedAccountId || "",
  });

  // Fetch connected Instagram accounts
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const response = await fetch("/api/instagram/accounts");
        if (!response.ok) {
          throw new Error("Failed to fetch connected accounts");
        }
        const accounts = await response.json();
        setConnectedAccounts(accounts);
        
        // If no preselected account and accounts exist, select the first one
        if (!preselectedAccountId && accounts.length > 0) {
          setFormData(prev => ({ ...prev, selectedAccountId: accounts[0].instagramUserId }));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load accounts");
      } finally {
        setLoading(false);
      }
    };

    fetchAccounts();
  }, [preselectedAccountId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPosting(true);
    setError(null);
    setPostSuccess(null);

    if (!formData.imageUrl) {
      setError("Image URL is required");
      setPosting(false);
      return;
    }

    if (!formData.selectedAccountId) {
      setError("Please select an Instagram account");
      setPosting(false);
      return;
    }

    try {
      const response = await fetch("/api/instagram/post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageUrl: formData.imageUrl,
          caption: formData.caption,
          instagramUserId: formData.selectedAccountId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Error: ${response.status}`);
      }

      setPostSuccess(`Successfully posted! Post ID: ${data.postId}`);
      setFormData(prev => ({ ...prev, imageUrl: "", caption: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post to Instagram");
    } finally {
      setPosting(false);
    }
  };

  const selectedAccount = connectedAccounts.find(
    account => account.instagramUserId === formData.selectedAccountId
  );

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
          <button
            onClick={() => router.push("/dashboard")}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Create Instagram Post</h1>
            <p className="text-gray-600 mt-1">Share your content with your audience</p>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="text-gray-500 hover:text-gray-700 font-medium"
          >
            ← Back to Dashboard
          </button>
        </div>

        {/* Account Selection */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Instagram Account</h2>
          <div className="space-y-3">
            {connectedAccounts.map((account) => (
              <label
                key={account.instagramUserId}
                className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                  formData.selectedAccountId === account.instagramUserId
                    ? "border-purple-500 bg-purple-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="selectedAccountId"
                  value={account.instagramUserId}
                  checked={formData.selectedAccountId === account.instagramUserId}
                  onChange={handleInputChange}
                  className="sr-only"
                />
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mr-3">
                  <span className="text-white font-bold text-sm">IG</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">@{account.instagramUsername}</p>
                  <p className="text-sm text-gray-500">ID: {account.instagramUserId}</p>
                </div>
                {formData.selectedAccountId === account.instagramUserId && (
                  <div className="ml-auto">
                    <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                )}
              </label>
            ))}
          </div>
        </div>

        {/* Post Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Post Details</h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Image URL */}
            <div>
              <label htmlFor="imageUrl" className="block text-sm font-medium text-gray-700 mb-2">
                Image URL <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                id="imageUrl"
                name="imageUrl"
                value={formData.imageUrl}
                onChange={handleInputChange}
                placeholder="https://example.com/image.jpg"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-sm text-gray-500 mt-1">
                Must be a publicly accessible JPEG image URL
              </p>
            </div>

            {/* Image Preview */}
            {formData.imageUrl && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Preview</label>
                <div className="relative w-full max-w-md">
                  <img
                    src={formData.imageUrl}
                    alt="Post preview"
                    width={400}
                    height={400}
                    className="rounded-lg object-cover"
                    onError={() => setError("Invalid image URL")}
                  />
                </div>
              </div>
            )}

            {/* Caption */}
            <div>
              <label htmlFor="caption" className="block text-sm font-medium text-gray-700 mb-2">
                Caption
              </label>
              <textarea
                id="caption"
                name="caption"
                value={formData.caption}
                onChange={handleInputChange}
                rows={4}
                placeholder="Write a caption for your post..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              />
              <p className="text-sm text-gray-500 mt-1">
                Optional: Add a caption to your post
              </p>
            </div>

            {/* Selected Account Display */}
            {selectedAccount && (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">Posting to:</p>
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mr-2">
                    <span className="text-white font-bold text-xs">IG</span>
                  </div>
                  <span className="font-semibold text-gray-900">@{selectedAccount.instagramUsername}</span>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                <div className="flex">
                  <svg className="w-5 h-5 text-red-400 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span>{error}</span>
                </div>
              </div>
            )}

            {/* Success Message */}
            {postSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                <div className="flex">
                  <svg className="w-5 h-5 text-green-400 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>{postSuccess}</span>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={posting || !formData.imageUrl || !formData.selectedAccountId}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-400 disabled:to-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:cursor-not-allowed"
            >
              {posting ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Posting to Instagram...
                </div>
              ) : (
                "Post to Instagram"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
} 