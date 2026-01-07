'use client';

import FloatingChat from '@/components/FloatingChat';

export default function Home() {
  return (
    <>
      <FloatingChat />

      <div className="min-h-screen bg-gradient-to-b from-violet-950 via-purple-900 to-slate-900">
        {/* Navbar */}
        <nav className="px-8 py-6">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
              DevSolutions
            </h1>
            <div className="flex gap-6 text-gray-300 text-sm">
              <a href="#" className="hover:text-white transition">Services</a>
              <a href="#" className="hover:text-white transition">About</a>
              <a href="#" className="hover:text-white transition">Contact</a>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <div className="px-8 py-20">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-block px-4 py-2 bg-violet-500/20 rounded-full text-violet-300 text-sm mb-6">
                  Cloud • DevOps • Security
                </div>
                <h2 className="text-5xl font-bold text-white mb-6 leading-tight">
                  Transform Your
                  <br />
                  Business with
                  <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-purple-400">
                    Modern IT
                  </span>
                </h2>
                <p className="text-gray-300 text-lg mb-8">
                  Expert IT consulting, cloud migration, and DevOps solutions
                  for enterprises and startups.
                </p>
                <button className="px-8 py-4 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-semibold transition">
                  Get Started
                </button>
              </div>
              <div className="space-y-4">
                {[
                  { title: 'Cloud Migration', desc: 'AWS • Azure • GCP' },
                  { title: 'DevOps Automation', desc: 'CI/CD • Kubernetes' },
                  { title: 'Security Audit', desc: 'Penetration Testing' },
                ].map((service, i) => (
                  <div key={i} className="p-6 bg-white/5 backdrop-blur-sm rounded-xl border border-violet-500/20 hover:border-violet-500/40 transition">
                    <h3 className="text-xl font-semibold text-white mb-2">{service.title}</h3>
                    <p className="text-gray-400">{service.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="px-8 py-16">
          <div className="max-w-7xl mx-auto grid grid-cols-3 gap-8 text-center">
            {[
              { num: '500+', label: 'Projects' },
              { num: '98%', label: 'Satisfaction' },
              { num: '24/7', label: 'Support' },
            ].map((stat, i) => (
              <div key={i}>
                <div className="text-4xl font-bold text-violet-400 mb-2">{stat.num}</div>
                <div className="text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
