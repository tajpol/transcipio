import React from 'react';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 py-16 px-6">
      <div className="max-w-3xl mx-auto bg-slate-900/80 rounded-2xl p-10 border border-slate-800/50">
        <h1 className="text-3xl font-bold mb-4 text-emerald-300">Privacy Policy</h1>
        <p className="mb-4 text-slate-300">
          Transcipio (TP Business Solutions) takes your privacy seriously. This page explains how we handle
          data when you use the service.
        </p>
        <h2 className="text-xl font-semibold mt-4 mb-2 text-emerald-200">What we collect</h2>
        <p className="text-slate-300 mb-3">We process the media file you upload in order to create a transcript. Uploaded files are sent to the configured cloud storage provider and to the transcription provider only for processing.</p>
        <h2 className="text-xl font-semibold mt-4 mb-2 text-emerald-200">API keys and secrets</h2>
        <p className="text-slate-300 mb-3">API keys (for transcription and storage providers) are stored on the server and are never exposed to the browser or client-side code.</p>
        <h2 className="text-xl font-semibold mt-4 mb-2 text-emerald-200">Retention</h2>
        <p className="text-slate-300 mb-3">Depending on your cloud storage and transcription provider settings, copies of uploaded media and transcripts may be retained by those services. Please consult the provider's privacy policies for specifics.</p>
        <h2 className="text-xl font-semibold mt-4 mb-2 text-emerald-200">Contact</h2>
        <p className="text-slate-300 mb-3">If you have questions about privacy, please contact hello@tpbsolutions.org </p>
        <div className="mt-6">
          <a href="/" className="text-emerald-400 underline">Back to Transcipio</a>
        </div>
      </div>
    </div>
  );
}
