"use client";

import { useState, useEffect } from "react";

interface ShareLinkProps {
  tripId: string;
}

export default function ShareLink({ tripId }: ShareLinkProps) {
  const [copied, setCopied] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");

  useEffect(() => {
    setInviteUrl(`${window.location.origin}/app/join/${tripId}`);
  }, [tripId]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const text = `Join my trip on TripKawan! ${inviteUrl}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      "_blank"
    );
  };

  if (!inviteUrl) return null;

  return (
    <div className="rounded-2xl bg-teal-50 p-4 mb-4 flex items-center gap-3">
      <p className="text-xs font-medium text-teal-700">Invite link</p>
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={handleCopy}
          aria-label={copied ? "Copied" : "Copy invite link"}
          title={copied ? "Copied" : "Copy invite link"}
          className="w-9 h-9 rounded-xl bg-white border border-teal-200 text-teal-600 hover:bg-teal-100 transition-colors flex items-center justify-center"
        >
          {copied ? (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
        <button
          onClick={handleShareWhatsApp}
          className="rounded-xl bg-[#25D366] px-4 py-2 text-xs font-medium text-white hover:bg-[#1fb855] transition-colors"
        >
          WhatsApp
        </button>
      </div>
    </div>
  );
}
