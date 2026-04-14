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
    <div className="rounded-2xl bg-teal-50 p-4 mb-4">
      <p className="text-xs font-medium text-teal-700 mb-2">
        Invite link
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleCopy}
          className="flex-1 rounded-xl bg-white border border-teal-200 px-3 py-2 text-xs font-medium text-teal-600 hover:bg-teal-100 transition-colors"
        >
          {copied ? "Copied!" : "Copy Link"}
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
