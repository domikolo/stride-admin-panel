'use client';

import FloatingChat from '@/components/FloatingChat';

export default function Home() {
  return (
    <>
      <FloatingChat />

      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-950">
        {/* Navbar */}
        <nav className="px-8 py-8 border-b border-indigo-900/20">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <h1 className="text-3xl font-light text-white tracking-tight">
              LENS<span className="text-indigo-400">CRAFT</span>
            </h1>
            <div className="flex gap-10 text-gray-400 text-sm">
              <a href="#" className="hover:text-indigo-300 transition">Portfolio</a>
              <a href="#" className="hover:text-indigo-300 transition">Services</a>
              <a href="#" className="hover:text-indigo-300 transition">Contact</a>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <div className="px-8 py-28">
          <div className="max-w-7xl mx-auto">
            <div className="max-w-4xl">
              <div className="mb-8">
                <span className="px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-300 text-xs uppercase tracking-wider">
                  Award-Winning Photography
                </span>
              </div>
              <h2 className="text-8xl font-light text-white mb-8 leading-none">
                Capturing
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-blue-400 to-indigo-400">
                  Moments
                </span>
                <br />
                That Matter
              </h2>
              <p className="text-xl text-gray-400 mb-12 max-w-2xl font-light">
                Professional photography services for weddings, events, portraits, and commercial projects.
              </p>
              <button className="px-10 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition">
                View Portfolio
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="px-8 py-20">
          <div className="max-w-7xl mx-auto grid grid-cols-4 gap-8 text-center">
            {[
              { num: '1000+', label: 'Projects' },
              { num: '500+', label: 'Happy Clients' },
              { num: '15+', label: 'Awards' },
              { num: '10', label: 'Years Experience' },
            ].map((stat, i) => (
              <div key={i}>
                <div className="text-5xl font-light text-indigo-400 mb-2">{stat.num}</div>
                <div className="text-gray-500 text-sm uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
