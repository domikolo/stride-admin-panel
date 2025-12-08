'use client';

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, CheckCircle2, Zap, Globe, Shield, BarChart3, Menu, Cpu, ArrowUpRight } from 'lucide-react';
import AbstractWavesBackground from "@/components/AbstractWavesBackground";
import TransformingChat from "@/components/TransformingChat";
import { useState } from 'react';

export default function Home() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = [
    { name: 'O nas', href: '#about' },
    { name: 'Usługi', href: '#services' },
    { name: 'Demo', href: '#demo' },
    { name: 'Cennik', href: '#pricing' },
    { name: 'Kontakt', href: '#contact' },
  ];

  return (
    <main className="relative min-h-screen flex flex-col selection:bg-white selection:text-black">
      <AbstractWavesBackground />
      
      {/* Navigation - More Transparent */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/20 bg-black/20 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center -ml-1 sm:-ml-2">
            <img src="/logo.png" alt="Stride Logo" className="h-6 sm:h-8 w-auto object-contain hover:scale-105 transition-transform" />
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-6 lg:gap-8">
            {navLinks.map((link) => (
              <Link key={link.name} href={link.href} className="text-[13px] lg:text-[14px] font-medium text-zinc-300 hover:text-white transition-colors">
                {link.name}
              </Link>
            ))}
            <Link href="#contact" className="bg-white/90 backdrop-blur text-black px-4 lg:px-5 py-2 rounded-lg text-[13px] lg:text-[14px] font-semibold hover:bg-white transition-all hover:scale-105 active:scale-95">
              Rozpocznij
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden text-white p-2 hover:bg-white/10 rounded-lg transition-colors" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            <Menu size={24} />
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="md:hidden absolute top-20 left-0 w-full bg-black/90 backdrop-blur-xl border-b border-white/5 overflow-hidden rounded-b-2xl shadow-2xl"
            >
              <div className="p-6 flex flex-col gap-4">
                {navLinks.map((link, index) => (
                  <motion.div
                    key={link.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Link
                      href={link.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="text-lg font-medium text-zinc-300 hover:text-white px-4 py-2 block"
                    >
                      {link.name}
                    </Link>
                  </motion.div>
                ))}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: navLinks.length * 0.1 }}
                >
                  <Link
                    href="#contact"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="bg-white/90 backdrop-blur text-black px-5 py-3 rounded-lg text-base font-semibold hover:bg-white transition-all text-center block mt-2"
                  >
                    Rozpocznij
                  </Link>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero Section - Modern 2025 Best Practices */}
      <section id="demo" className="relative min-h-screen flex items-center px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          {/* Subtle gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5" />
          <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-blue-500/10 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2" />
        </div>

        <div className="max-w-[1400px] w-full mx-auto grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-20 items-center py-20">
          {/* Left side - Text content with ample spacing */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="space-y-12"
          >
            {/* Dominant heading - light weight typography */}
            <div className="space-y-6">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-normal leading-[1.15] tracking-tight">
                <span className="block bg-gradient-to-br from-white via-white to-white/60 bg-clip-text text-transparent pb-2">
                  Inteligentna
                </span>
                <span className="block bg-gradient-to-br from-white/80 via-white/60 to-white/30 bg-clip-text text-transparent pb-2">
                  Obsługa
                </span>
                <span className="block bg-gradient-to-br from-white/60 via-white/40 to-white/20 bg-clip-text text-transparent pb-2">
                  Klienta
                </span>
              </h1>

              {/* Supporting text with generous spacing */}
              <p className="text-base sm:text-lg text-zinc-400 max-w-xl leading-relaxed font-normal">
                Zastąp stare metody komunikacji zaawansowaną sztuczną inteligencją.
                Zwiększ efektywność o 300% w pierwszym miesiącu.
              </p>
            </div>

            {/* Single dominant CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="flex items-center gap-4"
            >
              <Link
                href="#contact"
                className="group px-8 py-4 bg-white text-black rounded-xl text-base font-semibold hover:bg-zinc-100 transition-all duration-300 flex items-center gap-3 shadow-[0_0_40px_rgba(255,255,255,0.15)] hover:shadow-[0_0_60px_rgba(255,255,255,0.25)] hover:scale-105 active:scale-100"
              >
                Darmowe Demo
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="#services"
                className="px-6 py-4 text-zinc-300 hover:text-white text-base font-medium transition-colors duration-300 flex items-center gap-2"
              >
                Zobacz więcej
              </Link>
            </motion.div>
          </motion.div>

          {/* Right side - Chat Demo with subtle entrance */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
            className="relative flex items-center justify-center lg:justify-end"
          >
            <div className="w-full max-w-[580px]">
              <TransformingChat />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-16 sm:py-24 lg:py-32 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12 sm:mb-16 lg:mb-20 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 sm:gap-8">
            <div className="max-w-2xl">
               <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 tracking-tight">Architektura Rozwiązań</h2>
               <p className="text-zinc-400 text-base sm:text-lg">Systemy zaprojektowane z myślą o skalowalności i bezpieczeństwie.</p>
            </div>
            <Link href="#contact" className="text-white font-semibold flex items-center gap-2 hover:gap-4 transition-all text-sm sm:text-base">
               Pełna oferta <ArrowUpRight size={20} />
            </Link>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[
              { icon: <Zap size={24} />, title: "Instant Sales", desc: "Konwertuj odwiedzających w klientów w czasie rzeczywistym." },
              { icon: <Shield size={24} />, title: "Secure Core", desc: "Szyfrowanie end-to-end i zgodność z RODO/GDPR." },
              { icon: <BarChart3 size={24} />, title: "Deep Analytics", desc: "Wgląd w nastroje klientów i skuteczność rozmów." },
              { icon: <Globe size={24} />, title: "Global Reach", desc: "Natywna obsługa 90+ języków bez tłumacza." },
              { icon: <Cpu size={24} />, title: "LLM Neural Net", desc: "Własne modele językowe douczone na Twoich danych." },
              { icon: <CheckCircle2 size={24} />, title: "Smart Flow", desc: "Automatyzacja powtarzalnych procesów biznesowych." },
            ].map((service, i) => (
              <div key={i} className="glass-card p-6 sm:p-8 rounded-2xl hover:bg-white/5 transition-all duration-300 group border border-white/5 hover:border-white/10 hover:-translate-y-1">
                <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mb-6 sm:mb-8 text-white group-hover:scale-105 group-hover:bg-white group-hover:text-black transition-all shadow-lg backdrop-blur-md">
                  {service.icon}
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 text-white tracking-tight">{service.title}</h3>
                <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">{service.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-16 sm:py-24 lg:py-32 px-4 sm:px-6 border-y border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-white/[0.02]" />
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 sm:gap-16 lg:gap-20 items-center relative z-10">
          <div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 sm:mb-8 tracking-tight">Technologia, która<br/>nie przeszkadza</h2>
            <p className="text-zinc-400 mb-8 sm:mb-10 leading-relaxed text-base sm:text-lg lg:text-xl font-light">
              W Stride wierzymy w "Invisible Tech". Najlepsza technologia to taka, której nie widać, a której efekty czuć natychmiast. Nasze boty są tak naturalne, że 85% klientów dziękuje im na koniec rozmowy, myśląc, że rozmawiali z człowiekiem.
            </p>
            <div className="grid grid-cols-2 gap-6 sm:gap-10">
               <div className="border-l border-white/10 pl-4 sm:pl-6">
                 <div className="text-4xl sm:text-5xl font-bold text-white mb-2 tracking-tighter">99.9%</div>
                 <div className="text-xs sm:text-sm text-zinc-500 font-bold uppercase tracking-widest">Uptime</div>
               </div>
               <div className="border-l border-white/10 pl-4 sm:pl-6">
                 <div className="text-4xl sm:text-5xl font-bold text-white mb-2 tracking-tighter">45ms</div>
                 <div className="text-xs sm:text-sm text-zinc-500 font-bold uppercase tracking-widest">Latency</div>
               </div>
            </div>
          </div>
          <div className="relative h-[300px] sm:h-[400px] lg:h-[500px] w-full glass-card rounded-3xl flex items-center justify-center overflow-hidden shadow-2xl border border-white/5">
            {/* Abstract visual */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/5 to-transparent" />
            <div className="relative z-10 text-center p-6 sm:p-10">
               <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/10 backdrop-blur-xl rounded-2xl mx-auto mb-6 sm:mb-8 flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.05)] border border-white/10">
                  <Cpu size={32} className="text-white sm:w-9 sm:h-9" />
               </div>
               <div className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white/20 tracking-tighter">CORE</div>
               <div className="text-sm sm:text-base text-zinc-500 mt-3 sm:mt-4 font-mono tracking-widest">SYSTEM ARCHITECTURE v2.0</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-16 sm:py-24 lg:py-32 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 sm:mb-16 lg:mb-20">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 tracking-tight">Proste zasady</h2>
            <p className="text-zinc-500 text-base sm:text-lg">Wybierz plan, który rośnie razem z Tobą.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 sm:gap-6 max-w-6xl mx-auto">
            {[
              { name: 'Startup', price: '999', features: ['1 Agent AI', 'Podstawowa baza wiedzy', 'Email Support', 'Do 1000 rozmów/mc'] },
              { name: 'Pro', price: '2499', featured: true, features: ['3 Agenty AI', 'Zaawansowana baza wiedzy', 'Integracja API + Webhooki', 'Priority Support', 'Analityka Dashboard'] },
              { name: 'Enterprise', price: 'Custom', features: ['Nielimitowane Agenty', 'On-premise Deployment', 'SLA 99.9%', 'Dedykowany Opiekun', 'Custom Training'] },
            ].map((plan, i) => (
              <div key={i} className={`p-6 sm:p-8 lg:p-10 rounded-2xl flex flex-col transition-all duration-300 ${plan.featured ? 'bg-white/5 border border-white/10 shadow-2xl md:scale-105 z-10 backdrop-blur-xl' : 'glass-card hover:bg-white/5'}`}>
                <h3 className="text-lg sm:text-xl font-bold mb-2 text-zinc-200">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-6 sm:mb-8">
                    <span className="text-4xl sm:text-5xl font-bold text-white tracking-tighter">{plan.price}</span>
                    {plan.price !== 'Custom' && <span className="text-base sm:text-lg text-zinc-500 font-medium">zł /mc</span>}
                </div>
                <ul className="space-y-4 sm:space-y-5 mb-8 sm:mb-10 flex-1">
                  {plan.features.map((feature, f) => (
                    <li key={f} className="flex items-center gap-3 text-sm sm:text-[15px] text-zinc-400 font-medium">
                      <CheckCircle2 size={18} className="text-white shrink-0" /> {feature}
                    </li>
                  ))}
                </ul>
                <button className={`w-full py-3 sm:py-4 rounded-xl text-sm sm:text-base font-bold transition-all ${plan.featured ? 'bg-white text-black hover:bg-gray-200 hover:scale-[1.02]' : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'}`}>
                  Wybierz pakiet
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-16 sm:py-24 lg:py-32 px-4 sm:px-6 border-t border-white/5">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3 sm:mb-4 tracking-tight">Porozmawiajmy</h2>
            <p className="text-zinc-500 text-base sm:text-lg">Umów się na 15-minutowe demo i zobacz różnicę.</p>
      </div>

          <form className="space-y-3 sm:space-y-4">
            <div className="grid md:grid-cols-2 gap-3 sm:gap-4">
              <input type="text" placeholder="Imię" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 sm:px-6 py-3 sm:py-4 text-white placeholder:text-zinc-600 focus:border-white/30 focus:bg-white/10 focus:outline-none transition-all backdrop-blur-sm text-sm sm:text-base" />
              <input type="email" placeholder="Email firmowy" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 sm:px-6 py-3 sm:py-4 text-white placeholder:text-zinc-600 focus:border-white/30 focus:bg-white/10 focus:outline-none transition-all backdrop-blur-sm text-sm sm:text-base" />
            </div>
            <textarea rows={4} placeholder="Opowiedz nam o swoim biznesie..." className="w-full bg-white/5 border border-white/10 rounded-xl px-4 sm:px-6 py-3 sm:py-4 text-white placeholder:text-zinc-600 focus:border-white/30 focus:bg-white/10 focus:outline-none transition-all backdrop-blur-sm text-sm sm:text-base"></textarea>
            <button className="w-full py-4 sm:py-5 bg-white text-black rounded-xl text-base sm:text-lg font-bold hover:bg-gray-200 transition-all hover:scale-[1.01] shadow-xl">
              Wyślij zgłoszenie
            </button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 sm:py-16 px-4 sm:px-6 bg-black border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 sm:gap-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-black text-xs font-bold">S</div>
            <span className="font-bold text-white text-base sm:text-lg tracking-tight">Stride</span>
          </div>
          <div className="text-zinc-500 text-xs sm:text-sm text-center">
            © 2025 Stride Services. All rights reserved.
          </div>
          <div className="flex gap-6 sm:gap-8 text-zinc-500 text-xs sm:text-sm font-medium">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
          </div>
      </div>
      </footer>
    </main>
  );
}
