'use client';

import Link from "next/link";
import { motion } from "framer-motion";
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
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center -ml-2">
            <img src="/logo.png" alt="Stride Logo" className="h-8 w-auto object-contain hover:scale-105 transition-transform" />
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link key={link.name} href={link.href} className="text-[14px] font-medium text-zinc-300 hover:text-white transition-colors">
                {link.name}
              </Link>
            ))}
            <Link href="#contact" className="bg-white/90 backdrop-blur text-black px-5 py-2 rounded-lg text-[14px] font-semibold hover:bg-white transition-all hover:scale-105 active:scale-95">
              Rozpocznij
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden text-white p-2" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            <Menu size={24} />
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-20 left-0 w-full bg-black/90 backdrop-blur-xl border-b border-white/5 p-6 flex flex-col gap-4 rounded-b-2xl shadow-2xl">
            {navLinks.map((link) => (
               <Link key={link.name} href={link.href} onClick={() => setIsMobileMenuOpen(false)} className="text-xl font-medium text-zinc-300 hover:text-white px-4 py-2">
                {link.name}
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section id="demo" className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-10">
            {/* WYBRANA OPCJA: Ghost Gradient (Dimmed) + Drop Shadow Glow */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              {/* Cinematic Spotlight - Cold */}
              <div className="absolute -top-28 -left-28 w-[900px] h-[450px] bg-gradient-to-br from-blue-100/[0.10] via-white/[0.01] to-transparent rotate-12 blur-[80px] -z-10 pointer-events-none" />
              
              <h1 className="text-6xl lg:text-8xl font-medium leading-[0.95] mb-8 tracking-[-0.04em] font-[family-name:var(--font-inter)] drop-shadow-[0_0_1px_rgba(255,255,255,0.5)]">
                <span className="bg-gradient-to-b from-white via-white/80 to-white/40 bg-clip-text text-transparent block pb-4 -mb-4">
                  Inteligentna
                </span>
                <span className="bg-gradient-to-b from-white/60 via-white/40 to-white/10 bg-clip-text text-transparent block pb-4">
                  Obsługa Klienta
                </span>
              </h1>
              <p className="text-xl text-zinc-400 max-w-xl leading-relaxed font-normal">
                Zastąp stare metody komunikacji zaawansowaną sztuczną inteligencją. Zwiększ efektywność o 300% w pierwszym miesiącu.
              </p>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="flex flex-wrap gap-4"
            >
              <Link href="#contact" className="px-7 py-3.5 bg-white text-black rounded-xl text-base font-bold hover:bg-zinc-200 transition-all flex items-center gap-2 hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.15)]">
                Darmowe Demo <ArrowRight size={18} />
              </Link>
              <Link href="#services" className="px-7 py-3.5 bg-white/5 backdrop-blur-sm border border-white/10 text-white rounded-xl text-base font-semibold hover:bg-white/10 transition-all flex items-center gap-2">
                Zobacz Case Studies
              </Link>
            </motion.div>
          </div>

          {/* Chat Demo Area */}
          <div className="relative h-[630px] hidden md:flex items-center justify-center ml-50">
            <TransformingChat />
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-20 flex flex-col md:flex-row justify-between items-end gap-8">
            <div className="max-w-2xl">
               <h2 className="text-4xl lg:text-5xl font-bold mb-6 tracking-tight">Architektura Rozwiązań</h2>
               <p className="text-zinc-400 text-lg">Systemy zaprojektowane z myślą o skalowalności i bezpieczeństwie.</p>
            </div>
            <Link href="#contact" className="text-white font-semibold flex items-center gap-2 hover:gap-4 transition-all">
               Pełna oferta <ArrowUpRight size={20} />
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: <Zap size={24} />, title: "Instant Sales", desc: "Konwertuj odwiedzających w klientów w czasie rzeczywistym." },
              { icon: <Shield size={24} />, title: "Secure Core", desc: "Szyfrowanie end-to-end i zgodność z RODO/GDPR." },
              { icon: <BarChart3 size={24} />, title: "Deep Analytics", desc: "Wgląd w nastroje klientów i skuteczność rozmów." },
              { icon: <Globe size={24} />, title: "Global Reach", desc: "Natywna obsługa 90+ języków bez tłumacza." },
              { icon: <Cpu size={24} />, title: "LLM Neural Net", desc: "Własne modele językowe douczone na Twoich danych." },
              { icon: <CheckCircle2 size={24} />, title: "Smart Flow", desc: "Automatyzacja powtarzalnych procesów biznesowych." },
            ].map((service, i) => (
              <div key={i} className="glass-card p-8 rounded-2xl hover:bg-white/5 transition-all duration-300 group border border-white/5 hover:border-white/10 hover:-translate-y-1">
                <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mb-8 text-white group-hover:scale-105 group-hover:bg-white group-hover:text-black transition-all shadow-lg backdrop-blur-md">
                  {service.icon}
                </div>
                <h3 className="text-xl font-bold mb-3 text-white tracking-tight">{service.title}</h3>
                <p className="text-zinc-400 text-base leading-relaxed">{service.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-32 px-6 border-y border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-white/[0.02]" />
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-20 items-center relative z-10">
          <div>
            <h2 className="text-4xl lg:text-5xl font-bold mb-8 tracking-tight">Technologia, która<br/>nie przeszkadza</h2>
            <p className="text-zinc-400 mb-10 leading-relaxed text-xl font-light">
              W Stride wierzymy w "Invisible Tech". Najlepsza technologia to taka, której nie widać, a której efekty czuć natychmiast. Nasze boty są tak naturalne, że 85% klientów dziękuje im na koniec rozmowy, myśląc, że rozmawiali z człowiekiem.
            </p>
            <div className="grid grid-cols-2 gap-10">
               <div className="border-l border-white/10 pl-6">
                 <div className="text-5xl font-bold text-white mb-2 tracking-tighter">99.9%</div>
                 <div className="text-sm text-zinc-500 font-bold uppercase tracking-widest">Uptime</div>
               </div>
               <div className="border-l border-white/10 pl-6">
                 <div className="text-5xl font-bold text-white mb-2 tracking-tighter">45ms</div>
                 <div className="text-sm text-zinc-500 font-bold uppercase tracking-widest">Latency</div>
               </div>
            </div>
          </div>
          <div className="relative h-[500px] w-full glass-card rounded-3xl flex items-center justify-center overflow-hidden shadow-2xl border border-white/5">
            {/* Abstract visual */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/5 to-transparent" />
            <div className="relative z-10 text-center p-10">
               <div className="w-20 h-20 bg-white/10 backdrop-blur-xl rounded-2xl mx-auto mb-8 flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.05)] border border-white/10">
                  <Cpu size={36} className="text-white" />
               </div>
               <div className="text-6xl font-bold text-white/20 tracking-tighter">CORE</div>
               <div className="text-base text-zinc-500 mt-4 font-mono tracking-widest">SYSTEM ARCHITECTURE v2.0</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl lg:text-5xl font-bold mb-6 tracking-tight">Proste zasady</h2>
            <p className="text-zinc-500 text-lg">Wybierz plan, który rośnie razem z Tobą.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {[
              { name: 'Startup', price: '999', features: ['1 Agent AI', 'Podstawowa baza wiedzy', 'Email Support', 'Do 1000 rozmów/mc'] },
              { name: 'Pro', price: '2499', featured: true, features: ['3 Agenty AI', 'Zaawansowana baza wiedzy', 'Integracja API + Webhooki', 'Priority Support', 'Analityka Dashboard'] },
              { name: 'Enterprise', price: 'Custom', features: ['Nielimitowane Agenty', 'On-premise Deployment', 'SLA 99.9%', 'Dedykowany Opiekun', 'Custom Training'] },
            ].map((plan, i) => (
              <div key={i} className={`p-10 rounded-2xl flex flex-col transition-all duration-300 ${plan.featured ? 'bg-white/5 border border-white/10 shadow-2xl scale-105 z-10 backdrop-blur-xl' : 'glass-card hover:bg-white/5'}`}>
                <h3 className="text-xl font-bold mb-2 text-zinc-200">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-8">
                    <span className="text-5xl font-bold text-white tracking-tighter">{plan.price}</span>
                    {plan.price !== 'Custom' && <span className="text-lg text-zinc-500 font-medium">zł /mc</span>}
                </div>
                <ul className="space-y-5 mb-10 flex-1">
                  {plan.features.map((feature, f) => (
                    <li key={f} className="flex items-center gap-3 text-[15px] text-zinc-400 font-medium">
                      <CheckCircle2 size={18} className="text-white shrink-0" /> {feature}
                    </li>
                  ))}
                </ul>
                <button className={`w-full py-4 rounded-xl text-base font-bold transition-all ${plan.featured ? 'bg-white text-black hover:bg-gray-200 hover:scale-[1.02]' : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'}`}>
                  Wybierz pakiet
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-32 px-6 border-t border-white/5">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 tracking-tight">Porozmawiajmy</h2>
            <p className="text-zinc-500 text-lg">Umów się na 15-minutowe demo i zobacz różnicę.</p>
      </div>

          <form className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <input type="text" placeholder="Imię" className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-white placeholder:text-zinc-600 focus:border-white/30 focus:bg-white/10 focus:outline-none transition-all backdrop-blur-sm" />
              <input type="email" placeholder="Email firmowy" className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-white placeholder:text-zinc-600 focus:border-white/30 focus:bg-white/10 focus:outline-none transition-all backdrop-blur-sm" />
            </div>
            <textarea rows={4} placeholder="Opowiedz nam o swoim biznesie..." className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-white placeholder:text-zinc-600 focus:border-white/30 focus:bg-white/10 focus:outline-none transition-all backdrop-blur-sm"></textarea>
            <button className="w-full py-5 bg-white text-black rounded-xl text-lg font-bold hover:bg-gray-200 transition-all hover:scale-[1.01] shadow-xl">
              Wyślij zgłoszenie
            </button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 px-6 bg-black border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-black text-xs font-bold">S</div>
            <span className="font-bold text-white text-lg tracking-tight">Stride</span>
          </div>
          <div className="text-zinc-500 text-sm">
            © 2025 Stride Services. All rights reserved.
          </div>
          <div className="flex gap-8 text-zinc-500 text-sm font-medium">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
          </div>
      </div>
      </footer>
    </main>
  );
}
