'use client';

import FloatingChat from '@/components/FloatingChat';

export default function Home() {
  return (
    <>
      <FloatingChat />

      <div className="min-h-screen bg-slate-950">
        <nav className="px-8 py-8 bg-slate-900/50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-serif text-white">Sterling & Associates</h1>
              <p className="text-xs text-slate-500 uppercase tracking-wider">Attorneys at Law</p>
            </div>
            <div className="flex gap-12 text-slate-400 text-sm">
              <a href="#" className="hover:text-white transition">Practice Areas</a>
              <a href="#" className="hover:text-white transition">Attorneys</a>
              <a href="#" className="hover:text-white transition">Contact</a>
            </div>
          </div>
        </nav>

        <div className="px-8 py-28">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-6xl font-serif text-white mb-8 max-w-3xl leading-tight">
              Trusted Legal Counsel for
              <span className="text-blue-400"> Complex Matters</span>
            </h2>
            <p className="text-xl text-slate-400 mb-12 max-w-2xl">
              Over 30 years of experience providing strategic legal solutions in corporate law,
              litigation, and intellectual property.
            </p>
            <button className="px-10 py-5 bg-blue-600 hover:bg-blue-500 text-white font-medium transition">
              Schedule Consultation
            </button>
          </div>
        </div>

        <div className="px-8 py-20 bg-slate-900/50">
          <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-12">
            {[
              { title: 'Corporate Law', desc: 'M&A, contracts, compliance' },
              { title: 'Litigation', desc: 'Commercial disputes, arbitration' },
              { title: 'IP Protection', desc: 'Patents, trademarks, copyrights' },
            ].map((area, i) => (
              <div key={i} className="p-8 bg-slate-800/50 border border-slate-700">
                <h3 className="text-xl font-serif text-white mb-4">{area.title}</h3>
                <p className="text-slate-400 text-sm">{area.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
