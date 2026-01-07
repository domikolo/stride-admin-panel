'use client';

import FloatingChat from '@/components/FloatingChat';

export default function Home() {
  return (
    <>
      <FloatingChat />

      <div className="min-h-screen bg-black">
        {/* Navbar */}
        <nav className="fixed top-0 w-full z-50 bg-black/80 backdrop-blur-md border-b border-white/10">
          <div className="max-w-7xl mx-auto px-8 py-6 flex items-center justify-between">
            <h1 className="text-2xl font-light tracking-[0.3em] text-white">ÉLÉGANCE</h1>
            <div className="flex gap-12 text-gray-400 text-sm tracking-widest uppercase">
              <a href="#" className="hover:text-white transition">Collection</a>
              <a href="#" className="hover:text-white transition">About</a>
              <a href="#" className="hover:text-white transition">Contact</a>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <div className="pt-32 pb-20 px-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-2 gap-16 items-center min-h-[80vh]">
              {/* Left - Text */}
              <div>
                <div className="mb-8">
                  <span className="text-amber-500 text-xs tracking-[0.3em] uppercase font-light">
                    Spring Collection 2025
                  </span>
                </div>
                <h2 className="text-7xl font-light text-white mb-8 leading-tight tracking-tight">
                  Timeless
                  <br />
                  <span className="italic font-extralight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200">
                    Elegance
                  </span>
                </h2>
                <p className="text-gray-400 text-lg mb-12 max-w-md font-light leading-relaxed">
                  Discover our curated selection of luxury fashion pieces,
                  where minimalism meets sophistication.
                </p>
                <button className="px-10 py-4 bg-white text-black rounded-none font-light tracking-widest text-sm uppercase hover:bg-amber-500 hover:text-white transition-all duration-300">
                  Explore Collection
                </button>
              </div>

              {/* Right - Image Placeholder */}
              <div className="relative">
                <div className="aspect-[3/4] bg-gradient-to-br from-amber-900/20 to-gray-900/30 border border-white/10 rounded-sm">
                  {/* Image placeholder */}
                </div>
                <div className="absolute -bottom-8 -left-8 w-64 h-64 bg-gradient-to-br from-amber-500/10 to-transparent blur-3xl" />
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="px-8 py-20 border-t border-white/10">
          <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-12">
            {[
              { title: 'Premium Quality', desc: 'Handpicked fabrics from around the world' },
              { title: 'Exclusive Designs', desc: 'Limited edition pieces for discerning tastes' },
              { title: 'Personal Styling', desc: 'Complimentary consultation service' },
            ].map((feature, i) => (
              <div key={i} className="text-center">
                <div className="w-16 h-16 mx-auto mb-6 border border-amber-500/30 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-amber-500 rounded-full" />
                </div>
                <h3 className="text-white text-lg font-light tracking-wider mb-3">{feature.title}</h3>
                <p className="text-gray-500 text-sm font-light">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
