'use client';

import FloatingChat from '@/components/FloatingChat';

export default function Home() {
  return (
    <>
      <FloatingChat />

      <div className="min-h-screen bg-gradient-to-b from-cyan-950 via-teal-950 to-slate-950">
        <nav className="px-8 py-8 bg-white/5 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-teal-400 rounded-full" />
              <div>
                <h1 className="text-xl font-semibold text-white">HealthCare Plus</h1>
                <p className="text-xs text-cyan-300">Medical Center</p>
              </div>
            </div>
            <div className="flex gap-10 text-gray-300 text-sm">
              <a href="#" className="hover:text-cyan-300 transition">Services</a>
              <a href="#" className="hover:text-cyan-300 transition">Doctors</a>
              <a href="#" className="hover:text-cyan-300 transition">Appointments</a>
            </div>
          </div>
        </nav>

        <div className="px-8 py-24">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <div className="inline-block px-4 py-2 bg-cyan-500/20 border border-cyan-500/30 rounded-full text-cyan-300 text-xs mb-8">
                  24/7 Emergency Care Available
                </div>
                <h2 className="text-6xl font-bold text-white mb-8 leading-tight">
                  Your Health,
                  <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-teal-300">
                    Our Priority
                  </span>
                </h2>
                <p className="text-xl text-gray-300 mb-10">
                  Comprehensive healthcare services with state-of-the-art facilities
                  and experienced medical professionals.
                </p>
                <div className="flex gap-4">
                  <button className="px-8 py-4 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg font-semibold transition">
                    Book Appointment
                  </button>
                  <button className="px-8 py-4 border border-cyan-500/50 hover:bg-cyan-500/10 text-white rounded-lg font-semibold transition">
                    Our Services
                  </button>
                </div>
              </div>
              <div className="aspect-square bg-gradient-to-br from-cyan-900/30 to-teal-900/30 rounded-3xl border border-cyan-800/30" />
            </div>
          </div>
        </div>

        <div className="px-8 py-20">
          <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-8 text-center">
            {[
              { num: '15K+', label: 'Patients' },
              { num: '50+', label: 'Specialists' },
              { num: '98%', label: 'Satisfaction' },
              { num: '25+', label: 'Years' },
            ].map((stat, i) => (
              <div key={i} className="p-6 bg-cyan-900/20 border border-cyan-800/30 rounded-xl">
                <div className="text-4xl font-bold text-cyan-400 mb-2">{stat.num}</div>
                <div className="text-gray-400 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
