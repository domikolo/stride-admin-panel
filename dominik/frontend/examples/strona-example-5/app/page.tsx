'use client';

import FloatingChat from '@/components/FloatingChat';

export default function Home() {
  return (
    <>
      <FloatingChat />

      <div className="min-h-screen bg-gradient-to-br from-pink-950 via-purple-950 to-rose-950">
        {/* Navbar */}
        <nav className="px-8 py-8">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <h1 className="text-2xl font-light tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-pink-300 to-rose-300">
              PIXEL STUDIO
            </h1>
            <div className="flex gap-12 text-gray-300 text-sm tracking-wide">
              <a href="#" className="hover:text-pink-300 transition">Work</a>
              <a href="#" className="hover:text-pink-300 transition">Services</a>
              <a href="#" className="hover:text-pink-300 transition">Contact</a>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <div className="px-8 py-24">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8 inline-block">
              <span className="px-4 py-2 bg-pink-500/20 text-pink-300 rounded-full text-sm backdrop-blur-sm border border-pink-400/30">
                Award-winning design agency
              </span>
            </div>
            <h2 className="text-8xl font-light text-white mb-8 max-w-5xl leading-tight">
              We craft
              <br />
              <span className="italic font-extralight text-transparent bg-clip-text bg-gradient-to-r from-pink-300 via-rose-300 to-purple-300">
                beautiful
              </span>{' '}
              digital
              <br />
              experiences
            </h2>
            <p className="text-xl text-gray-400 mb-12 max-w-2xl font-light">
              Branding, UI/UX design, and development for forward-thinking companies.
            </p>
            <button className="px-8 py-4 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white rounded-full font-medium transition">
              View Our Work
            </button>
          </div>
        </div>

        {/* Services Grid */}
        <div className="px-8 py-20">
          <div className="max-w-7xl mx-auto">
            <h3 className="text-3xl font-light text-white mb-12">What we do</h3>
            <div className="grid md:grid-cols-2 gap-8">
              {[
                {
                  title: 'Brand Identity',
                  desc: 'Logo design, visual identity systems, and brand guidelines',
                  gradient: 'from-pink-500/10 to-rose-500/10',
                },
                {
                  title: 'UI/UX Design',
                  desc: 'User research, wireframing, prototyping, and interface design',
                  gradient: 'from-purple-500/10 to-pink-500/10',
                },
                {
                  title: 'Web Development',
                  desc: 'Responsive websites and web applications built with modern tech',
                  gradient: 'from-rose-500/10 to-purple-500/10',
                },
                {
                  title: 'Motion Graphics',
                  desc: 'Animated logos, explainer videos, and motion design',
                  gradient: 'from-fuchsia-500/10 to-pink-500/10',
                },
              ].map((service, i) => (
                <div
                  key={i}
                  className={`p-10 bg-gradient-to-br ${service.gradient} backdrop-blur-sm rounded-2xl border border-pink-400/10 hover:border-pink-400/30 transition group`}
                >
                  <h4 className="text-2xl font-medium text-white mb-4 group-hover:text-pink-300 transition">
                    {service.title}
                  </h4>
                  <p className="text-gray-400 font-light leading-relaxed">{service.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="px-8 py-32">
          <div className="max-w-7xl mx-auto text-center">
            <h3 className="text-5xl font-light text-white mb-6">
              Ready to start a project?
            </h3>
            <p className="text-gray-400 text-xl mb-8 font-light">
              Let's create something amazing together
            </p>
            <button className="px-10 py-5 bg-white/10 hover:bg-white/20 text-white rounded-full font-medium backdrop-blur-sm border border-pink-400/30 hover:border-pink-400/50 transition">
              Get in Touch
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
