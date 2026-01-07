'use client';

import FloatingChat from '@/components/FloatingChat';

export default function Home() {
  return (
    <>
      <FloatingChat />

      <div className="min-h-screen bg-black">
        {/* Top Bar */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white text-center py-3 text-sm font-semibold">
          🎉 New Member Special: First Month 50% OFF
        </div>

        {/* Navbar */}
        <nav className="px-8 py-6 bg-gradient-to-b from-black to-transparent absolute w-full z-10">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">
              FITPRO
            </h1>
            <div className="flex gap-8 items-center">
              <a href="#" className="text-gray-300 hover:text-white transition">Classes</a>
              <a href="#" className="text-gray-300 hover:text-white transition">Pricing</a>
              <button className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold transition">
                JOIN NOW
              </button>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <div className="relative pt-32 pb-20 px-8 bg-gradient-to-b from-green-950/30 to-black">
          <div className="max-w-7xl mx-auto">
            <div className="max-w-3xl">
              <h2 className="text-7xl font-black text-white mb-6 leading-tight">
                TRANSFORM
                <br />
                YOUR
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">
                  BODY
                </span>
              </h2>
              <p className="text-2xl text-gray-300 mb-8">
                Premium equipment. Expert trainers. Results guaranteed.
              </p>
              <div className="flex gap-4">
                <button className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold rounded-lg transition text-lg">
                  START FREE TRIAL
                </button>
                <button className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-lg backdrop-blur-sm transition text-lg">
                  VIEW PLANS
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="bg-gradient-to-r from-green-900/50 to-emerald-900/50 border-y border-green-500/30">
          <div className="max-w-7xl mx-auto px-8 py-12 grid grid-cols-4 gap-8">
            {[
              { num: '5000+', label: 'Members' },
              { num: '50+', label: 'Classes/Week' },
              { num: '24/7', label: 'Access' },
              { num: '15+', label: 'Trainers' },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-4xl font-black text-green-400 mb-2">{stat.num}</div>
                <div className="text-gray-400 font-semibold">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Features */}
        <div className="px-8 py-20 bg-black">
          <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-8">
            {[
              { title: 'Modern Equipment', desc: 'Latest cardio & strength machines' },
              { title: 'Group Classes', desc: 'Yoga, HIIT, Spinning & more' },
              { title: 'Personal Training', desc: 'One-on-one expert guidance' },
            ].map((feature, i) => (
              <div key={i} className="p-8 bg-gradient-to-br from-green-900/30 to-emerald-900/30 rounded-xl border border-green-500/20 hover:border-green-500/40 transition">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg mb-4" />
                <h3 className="text-2xl font-bold text-white mb-3">{feature.title}</h3>
                <p className="text-gray-400">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
