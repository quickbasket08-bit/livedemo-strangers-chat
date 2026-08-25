"use client";

import { useState } from "react";

const REASONS: { value: string; label: string }[] = [
  { value: "nudity_or_sexual_content", label: "Nudity or sexual content" },
  { value: "harassment_or_hate_speech", label: "Harassment or hate speech" },
  { value: "underage_user", label: "Appears to be a minor" },
  { value: "spam_or_scam", label: "Spam or scam" },
  { value: "violence_or_threats", label: "Violence or threats" },
  { value: "other", label: "Other" },
];

export default function ReportButton({ roomId }: { roomId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0].value);
  const [details, setDetails] = useState("");
  const [block, setBlock] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    await fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, reason, details, block }),
    }).catch(() => {});
    setSubmitting(false);
    setSubmitted(true);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-red-400 hover:text-red-300 underline underline-offset-2"
      >
        Report
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-full max-w-sm space-y-4">
            {submitted ? (
              <>
                <p className="text-slate-200">Thanks — your report was submitted.</p>
                <button
                  onClick={() => setOpen(false)}
                  className="w-full rounded-lg bg-slate-800 hover:bg-slate-700 py-2 text-sm"
                >
                  Close
                </button>
              </>
            ) : (
              <>
                <h2 className="font-medium text-slate-100">Report this stranger</h2>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm"
                >
                  {REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Optional details"
                  rows={3}
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm"
                />
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={block}
                    onChange={(e) => setBlock(e.target.checked)}
                  />
                  Also block this person from matching me again
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setOpen(false)}
                    className="flex-1 rounded-lg bg-slate-800 hover:bg-slate-700 py-2 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submit}
                    disabled={submitting}
                    className="flex-1 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 py-2 text-sm font-medium"
                  >
                    {submitting ? "Submitting…" : "Submit report"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
