'use client';

import FloatingChat from '@/components/FloatingChat';

export default function Home() {
  return (
    <>
      <FloatingChat />

      {/* Hero Section */}
      <div className="min-h-screen relative bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        {/* Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.1)_1px,transparent_1px)] bg-[size:50px_50px]" />

        {/* Navbar */}
        <nav className="relative z-10 px-8 py-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">TechStore</h1>
          <div className="flex gap-8 text-gray-300">
            <a href="#" className="hover:text-white transition">Products</a>
            <a href="#" className="hover:text-white transition">Deals</a>
            <a href="#" className="hover:text-white transition">Support</a>
          </div>
        </nav>

        {/* Hero Content */}
        <div className="relative z-10 flex items-center justify-center min-h-[calc(100vh-100px)] px-8">
          <div className="text-center max-w-4xl">
            <h2 className="text-6xl font-bold text-white mb-6">
              Latest Tech
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                Best Prices
              </span>
            </h2>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              Discover premium electronics and gadgets. Free shipping on orders over $100.
            </p>
            <div className="flex gap-4 justify-center">
              <button className="px-8 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition">
                Shop Now
              </button>
              <button className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold backdrop-blur-sm transition">
                View Deals
              </button>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="relative z-10 grid grid-cols-3 gap-8 px-8 pb-16 max-w-6xl mx-auto">
          {[
            { title: 'Free Shipping', desc: 'On orders $100+' },
            { title: '2 Year Warranty', desc: 'On all products' },
            { title: '24/7 Support', desc: 'Always here for you' },
          ].map((feature, i) => (
            <div key={i} className="p-6 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-gray-400">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
