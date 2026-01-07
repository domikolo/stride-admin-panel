'use client';

import FloatingChat from '@/components/FloatingChat';

export default function Home() {
  return (
    <>
      <FloatingChat />

      <div className="min-h-screen bg-zinc-950">
        <nav className="px-8 py-10 border-b border-zinc-800">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <h1 className="text-xl font-extralight tracking-[0.5em] text-white">ARCHMIND</h1>
            <div className="flex gap-16 text-zinc-500 text-xs uppercase tracking-[0.2em]">
              <a href="#" className="hover:text-white transition">Projects</a>
              <a href="#" className="hover:text-white transition">Studio</a>
              <a href="#" className="hover:text-white transition">Contact</a>
            </div>
          </div>
        </nav>

        <div className="px-8 py-32">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-5 gap-16">
              <div className="lg:col-span-2">
                <div className="sticky top-32">
                  <div className="text-zinc-600 text-xs uppercase tracking-[0.3em] mb-12">Architecture & Design</div>
                  <h2 className="text-7xl font-extralight text-white mb-12 leading-[0.9]">
                    Spaces<br />That<br />
                    <span className="text-zinc-500">Inspire</span>
                  </h2>
                  <p className="text-zinc-400 mb-12 text-sm leading-relaxed">
                    Contemporary architecture firm specializing in residential, commercial,
                    and public space design with focus on sustainability and innovation.
                  </p>
                  <button className="border border-zinc-700 hover:bg-white hover:text-black text-white px-8 py-4 text-xs uppercase tracking-widest transition-all duration-300">
                    View Projects
                  </button>
                </div>
              </div>
              <div className="lg:col-span-3 space-y-8">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="aspect-video bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-800" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
