"use client";

import React from "react";
// import { signIn } from "next-auth/react"; // No longer needed

const InstagramLoginButton: React.FC = () => {
  const handleLogin = () => {
    // Redirect to the backend route that will initiate Passport Instagram authentication
    window.location.href = '/api/auth/instagram/login';
  };

  return (
    <button
      onClick={handleLogin} // Changed from signIn('facebook')
      className="px-4 py-2 font-semibold text-white bg-pink-600 rounded-md hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2"
    >
      Connect Instagram Account
    </button>
  );
};

export default InstagramLoginButton;
