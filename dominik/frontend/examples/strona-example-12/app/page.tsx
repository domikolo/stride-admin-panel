'use client';

import FloatingChat from '@/components/FloatingChat';

export default function Home() {
  return (
    <>
      <FloatingChat />

      <div className="min-h-screen bg-gradient-to-br from-lime-950 via-green-950 to-slate-950">
        <nav className="px-8 py-6 bg-black/20 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <h1 className="text-3xl font-bold text-white">
              Learn<span className="text-lime-400">Hub</span>
            </h1>
            <div className="flex gap-10 text-gray-300 text-sm">
              <a href="#" className="hover:text-lime-300 transition">Courses</a>
              <a href="#" className="hover:text-lime-300 transition">Teachers</a>
              <a href="#" className="hover:text-lime-300 transition">Pricing</a>
            </div>
          </div>
        </nav>

        <div className="px-8 py-28">
          <div className="max-w-7xl mx-auto text-center">
            <div className="mb-8">
              <span className="px-6 py-3 bg-lime-500/20 border border-lime-500/30 rounded-full text-lime-300 text-sm font-medium">
                Join 50,000+ Students Worldwide
              </span>
            </div>
            <h2 className="text-8xl font-bold text-white mb-8 leading-tight max-w-5xl mx-auto">
              Learn New Skills
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-lime-400 via-amber-400 to-lime-400">
                Anytime, Anywhere
              </span>
            </h2>
            <p className="text-2xl text-gray-300 mb-12 max-w-3xl mx-auto">
              Access thousands of courses taught by industry experts.
              Start your learning journey today.
            </p>
            <div className="flex gap-6 justify-center">
              <button className="px-10 py-5 bg-gradient-to-r from-lime-500 to-green-500 hover:from-lime-600 hover:to-green-600 text-white rounded-xl font-bold text-lg transition">
                Browse Courses
              </button>
              <button className="px-10 py-5 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white rounded-xl font-bold text-lg transition">
                Free Trial
              </button>
            </div>
          </div>
        </div>

        <div className="px-8 py-20">
          <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-10">
            {[
              { title: 'Expert Instructors', desc: 'Learn from industry professionals', icon: '👨‍🏫' },
              { title: 'Flexible Learning', desc: 'Study at your own pace', icon: '⏰' },
              { title: 'Certificates', desc: 'Earn recognized credentials', icon: '🎓' },
            ].map((feature, i) => (
              <div key={i} className="p-8 bg-gradient-to-br from-lime-900/30 to-green-900/30 rounded-2xl border border-lime-700/30 text-center">
                <div className="text-6xl mb-4">{feature.icon}</div>
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
