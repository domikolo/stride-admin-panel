'use client';

import FloatingChat from '@/components/FloatingChat';

export default function Home() {
  return (
    <>
      <FloatingChat />

      <div className="min-h-screen bg-gradient-to-b from-amber-950 via-yellow-950 to-stone-950">
        {/* Navbar */}
        <nav className="px-8 py-8 bg-black/30 backdrop-blur-sm border-b border-yellow-900/30">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-serif text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-400 tracking-wider">
                LUXESTATE
              </h1>
              <p className="text-xs text-gray-400 tracking-widest">LUXURY REAL ESTATE</p>
            </div>
            <div className="flex gap-10 text-gray-300 text-sm uppercase tracking-wider">
              <a href="#" className="hover:text-yellow-400 transition">Properties</a>
              <a href="#" className="hover:text-yellow-400 transition">Locations</a>
              <a href="#" className="hover:text-yellow-400 transition">Contact</a>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <div className="px-8 py-28">
          <div className="max-w-7xl mx-auto">
            <div className="mb-6">
              <span className="text-yellow-400 text-sm tracking-widest uppercase font-light">
                Est. 1985
              </span>
            </div>
            <h2 className="text-7xl font-serif text-white mb-8 max-w-4xl leading-tight">
              Discover Your
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500">
                Dream Estate
              </span>
            </h2>
            <p className="text-xl text-gray-300 mb-12 max-w-2xl font-light">
              Exclusive properties in prime locations worldwide.
              Experience luxury living at its finest.
            </p>
            <div className="flex gap-4">
              <button className="px-8 py-4 bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-700 hover:to-amber-700 text-white rounded font-medium transition uppercase text-sm tracking-wider">
                View Properties
              </button>
              <button className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white rounded font-medium backdrop-blur-sm border border-yellow-600/30 transition uppercase text-sm tracking-wider">
                Schedule Tour
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="px-8 py-20 bg-gradient-to-b from-black/40 to-transparent">
          <div className="max-w-7xl mx-auto grid grid-cols-4 gap-8">
            {[
              { num: '$2.5B+', label: 'Portfolio Value' },
              { num: '450+', label: 'Properties Sold' },
              { num: '25+', label: 'Global Locations' },
              { num: '40+', label: 'Years Experience' },
            ].map((stat, i) => (
              <div key={i} className="text-center p-8 bg-gradient-to-b from-yellow-900/20 to-transparent rounded-lg border border-yellow-700/20">
                <div className="text-4xl font-serif text-yellow-400 mb-3">{stat.num}</div>
                <div className="text-gray-400 text-sm uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Featured Properties */}
        <div className="px-8 py-20">
          <div className="max-w-7xl mx-auto">
            <h3 className="text-4xl font-serif text-white mb-12">Featured Properties</h3>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { location: 'Beverly Hills, CA', price: '$8.5M', type: 'Modern Villa' },
                { location: 'Manhattan, NY', price: '$12.2M', type: 'Penthouse' },
                { location: 'Miami Beach, FL', price: '$6.8M', type: 'Oceanfront Estate' },
              ].map((property, i) => (
                <div key={i} className="group cursor-pointer">
                  <div className="aspect-[4/3] bg-gradient-to-br from-yellow-900/30 to-amber-900/30 rounded-lg mb-4 border border-yellow-700/20 group-hover:border-yellow-600/40 transition" />
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="text-lg font-medium text-white group-hover:text-yellow-400 transition">
                        {property.type}
                      </h4>
                      <p className="text-gray-400 text-sm">{property.location}</p>
                    </div>
                    <div className="text-yellow-400 font-serif text-lg">{property.price}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
