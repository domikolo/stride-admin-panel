'use client';

import FloatingChat from '@/components/FloatingChat';

export default function Home() {
  return (
    <>
      <FloatingChat />

      <div className="min-h-screen bg-gradient-to-br from-orange-950 via-red-950 to-amber-950">
        {/* Header */}
        <header className="px-8 py-6 bg-black/20 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400">
              TastyBites
            </h1>
            <button className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-full font-semibold transition">
              Order Now
            </button>
          </div>
        </header>

        {/* Hero */}
        <div className="px-8 py-32">
          <div className="max-w-7xl mx-auto text-center">
            <h2 className="text-7xl font-bold text-white mb-6">
              Delicious Food
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-red-400 to-pink-400">
                Delivered Fast
              </span>
            </h2>
            <p className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto">
              Order from the best restaurants in your area. Fresh, hot, and delivered in 30 minutes or less.
            </p>

            {/* Category Pills */}
            <div className="flex gap-4 justify-center flex-wrap mb-16">
              {['Pizza', 'Burgers', 'Sushi', 'Asian', 'Desserts'].map((cat) => (
                <button
                  key={cat}
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white rounded-full border border-orange-400/30 transition"
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Features */}
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {[
                { icon: '🚀', title: '30 Min Delivery', desc: 'Fast & fresh' },
                { icon: '⭐', title: 'Top Rated', desc: '4.8/5 average' },
                { icon: '💳', title: 'Easy Payment', desc: 'Multiple options' },
              ].map((feature, i) => (
                <div key={i} className="p-8 bg-gradient-to-br from-orange-900/40 to-red-900/40 rounded-2xl backdrop-blur-sm border border-orange-400/20">
                  <div className="text-5xl mb-4">{feature.icon}</div>
                  <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-gray-300">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
