'use client';

import Link from 'next/link';
import {
  Rocket, LayoutDashboard, MessageSquare, Radio, Calendar,
  Flame, BookOpen, Users, Settings, CheckCircle2, ArrowRight,
  Zap, Eye, PenLine, Filter, Download, Tag, Flag,
  Clock, CalendarCheck, BarChart2, AlertTriangle, Sparkles,
  GripVertical, CheckSquare, FileText, Bot,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useState } from 'react';

// ─── Quick Setup Steps ────────────────────────────────────────────────────────

const SETUP_STEPS = [
  {
    n: 1,
    title: 'Sprawdź Dashboard',
    desc: 'Zerknij na AI briefing — codzienne podsumowanie aktywności chatbota i kluczowe metryki.',
    href: '/dashboard',
  },
  {
    n: 2,
    title: 'Ustaw swoją dostępność',
    desc: 'W Spotkaniach → "Twoja dostępność" skonfiguruj dni i godziny, kiedy klienci mogą umawiać się przez chatbota.',
    href: '/appointments',
  },
  {
    n: 3,
    title: 'Przejrzyj Bazę Wiedzy',
    desc: 'Upewnij się, że chatbot zna Twoją ofertę. Dodaj lub popraw artykuły — AI podpowie co wymaga uzupełnienia.',
    href: '/knowledge-base',
  },
  {
    n: 4,
    title: 'Obejrzyj pierwsze rozmowy',
    desc: 'W Rozmowach zobaczysz jak użytkownicy wchodzą w interakcję z chatbotem i jakie mają pytania.',
    href: '/conversations',
  },
  {
    n: 5,
    title: 'Skonfiguruj pipeline w Kontaktach',
    desc: 'Dostosuj etapy sprzedaży do swojego procesu. Możesz dodać własne etapy z dowolnym kolorem.',
    href: '/contacts',
  },
];

// ─── Tab Sections ─────────────────────────────────────────────────────────────

interface TabSection {
  href: string;
  icon: React.ElementType;
  label: string;
  color: string;
  bgColor: string;
  description: string;
  features: { icon: React.ElementType; text: string }[];
}

const SECTIONS: TabSection[] = [
  {
    href: '/dashboard',
    icon: LayoutDashboard,
    label: 'Dashboard',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    description: 'Centrum dowodzenia — przegląd wszystkiego w jednym miejscu.',
    features: [
      { icon: Bot, text: 'AI Briefing — codzienne podsumowanie pisane przez AI: co się działo, co wymaga uwagi' },
      { icon: BarChart2, text: 'Live stats: liczba rozmów, spotkań, leadów i wskaźnik konwersji za ostatnie 30 dni' },
      { icon: Zap, text: 'Hot topics i luki w KB wykryte przez chatbota (skrót z Insights)' },
      { icon: Eye, text: 'Ostatnie aktywności — najnowsze rozmowy i spotkania w jednym miejscu' },
    ],
  },
  {
    href: '/conversations',
    icon: MessageSquare,
    label: 'Rozmowy',
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/10',
    description: 'Wszystkie sesje użytkowników z chatbotem — pogrupowane, filtrowane, z możliwością adnotacji.',
    features: [
      { icon: Filter, text: 'Filtrowanie po dacie (dziś / tydzień / miesiąc) i ocenie użytkownika (pozytywna / negatywna)' },
      { icon: PenLine, text: 'Notatki i tagi per sesja — kliknij ikonę długopisu przy rozmowie' },
      { icon: Flag, text: 'Flagowanie rozmów wymagających uwagi' },
      { icon: Download, text: 'Eksport do CSV — wszystkie sesje z datami, ocenami i podglądem' },
    ],
  },
  {
    href: '/live',
    icon: Radio,
    label: 'Live',
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    description: 'Monitoring rozmów w czasie rzeczywistym — reaguj gdy chatbot nie daje rady.',
    features: [
      { icon: Eye, text: 'Podgląd aktywnych rozmów na żywo w czasie rzeczywistym' },
      { icon: Zap, text: 'Takeover — przejmij rozmowę i odpowiadaj samemu zamiast chatbota' },
      { icon: AlertTriangle, text: 'Alerty o eskalacjach — rozmowach które wymagają interwencji' },
    ],
  },
  {
    href: '/appointments',
    icon: Calendar,
    label: 'Spotkania',
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
    description: 'Spotkania umówione przez chatbota — lista, kalendarz i konfiguracja dostępności.',
    features: [
      { icon: CalendarCheck, text: 'Widok tabeli i kalendarza — przełączaj między nimi w prawym górnym rogu' },
      { icon: Clock, text: '"Twoja dostępność" — ustaw dni tygodnia, godziny i czas trwania slotów' },
      { icon: PenLine, text: 'Edycja spotkania — zmień datę, godzinę lub dodaj notatkę (ikona ołówka w tabeli)' },
      { icon: BarChart2, text: 'Analityka: lejek konwersji, czas do umówienia, heatmapa aktywności' },
    ],
  },
  {
    href: '/insights',
    icon: Flame,
    label: 'Insights',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    description: 'Analiza pytań użytkowników — co pytają, o czym rozmawiają, czego chatbot nie umie odpowiedzieć.',
    features: [
      { icon: BarChart2, text: 'Trendy pytań — tematy pogrupowane przez AI, posortowane po popularności' },
      { icon: AlertTriangle, text: 'Luki w KB — tematy na które chatbot nie miał odpowiedzi (żółte karty)' },
      { icon: Sparkles, text: 'Smart Insight — AI sugeruje co warto uzupełnić w bazie wiedzy' },
      { icon: Filter, text: 'Trzy okresy: wczoraj / 7 dni / 30 dni — przełączaj zakładkami' },
    ],
  },
  {
    href: '/knowledge-base',
    icon: BookOpen,
    label: 'Baza Wiedzy',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    description: 'Artykuły które chatbot czyta żeby odpowiadać na pytania użytkowników.',
    features: [
      { icon: FileText, text: 'Dodawaj artykuły tekstowe, pliki PDF i inne załączniki' },
      { icon: Sparkles, text: 'AI Inline Edit — zaznacz fragment tekstu i popraw go za pomocą AI z podglądem diff' },
      { icon: Eye, text: 'Wersjonowanie — porównaj zmiany między wersjami artykułu' },
      { icon: AlertTriangle, text: 'Luki z Insights automatycznie podpowiadają co warto napisać' },
    ],
  },
  {
    href: '/contacts',
    icon: Users,
    label: 'Kontakty',
    color: 'text-fuchsia-400',
    bgColor: 'bg-fuchsia-500/10',
    description: 'CRM lite — leady zebrane przez chatbota z emailem lub telefonem.',
    features: [
      { icon: GripVertical, text: 'Kanban pipeline — przeciągaj kontakty między etapami sprzedaży' },
      { icon: Tag, text: 'Tagi i notatki per kontakt — kliknij kontakt żeby otworzyć panel szczegółów' },
      { icon: CheckSquare, text: 'Bulk actions — zaznacz wiele kontaktów i zmień status lub usuń jednocześnie' },
      { icon: Download, text: 'Eksport CSV — cała lista kontaktów z historią i statusem pipeline' },
    ],
  },
  {
    href: '/settings',
    icon: Settings,
    label: 'Ustawienia',
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-500/10',
    description: 'Konfiguracja konta i preferencji panelu.',
    features: [
      { icon: Users, text: 'Dane konta i zarządzanie profilem' },
      { icon: Bot, text: 'Ustawienia chatbota — tone of voice, zachowanie, integracje' },
    ],
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GettingStartedPage() {
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());

  const toggleStep = (n: number) => {
    setCheckedSteps(prev => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n); else next.add(n);
      return next;
    });
  };

  const allDone = checkedSteps.size === SETUP_STEPS.length;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Rocket size={22} className="text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Pierwsze kroki</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Przewodnik po panelu — co robi każda zakładka i jak zacząć.
          </p>
        </div>
      </div>

      {/* Quick Setup */}
      <Card className="glass-card p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-white">Szybki setup</h2>
            <p className="text-xs text-zinc-500 mt-0.5">5 kroków żeby zacząć korzystać z panelu</p>
          </div>
          {allDone && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <CheckCircle2 size={14} />
              Wszystko gotowe!
            </span>
          )}
        </div>
        <div className="space-y-3">
          {SETUP_STEPS.map((step) => {
            const done = checkedSteps.has(step.n);
            return (
              <div
                key={step.n}
                className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${
                  done
                    ? 'border-emerald-500/20 bg-emerald-500/[0.04]'
                    : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
                }`}
              >
                <button
                  onClick={() => toggleStep(step.n)}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                    done
                      ? 'border-emerald-500 bg-emerald-500'
                      : 'border-zinc-600 hover:border-zinc-400'
                  }`}
                >
                  {done && <CheckCircle2 size={14} className="text-white" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-zinc-600 font-mono font-medium">0{step.n}</span>
                    <p className={`text-sm font-medium ${done ? 'text-zinc-500 line-through' : 'text-white'}`}>
                      {step.title}
                    </p>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{step.desc}</p>
                </div>
                <Link
                  href={step.href}
                  className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-300 transition-colors flex-shrink-0 mt-1"
                >
                  Otwórz
                  <ArrowRight size={12} />
                </Link>
              </div>
            );
          })}
        </div>
        {/* Progress bar */}
        <div className="mt-5 flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${(checkedSteps.size / SETUP_STEPS.length) * 100}%` }}
            />
          </div>
          <span className="text-xs text-zinc-500 tabular-nums">{checkedSteps.size}/{SETUP_STEPS.length}</span>
        </div>
      </Card>

      {/* Sections per tab */}
      <div>
        <h2 className="text-base font-semibold text-white mb-4">Opis zakładek</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <Card key={section.href} className="glass-card p-5 flex flex-col gap-4 group hover:border-white/[0.1] transition-colors">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl ${section.bgColor} flex items-center justify-center flex-shrink-0`}>
                      <Icon size={17} className={section.color} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{section.label}</p>
                      <p className="text-xs text-zinc-500 mt-0.5 leading-snug">{section.description}</p>
                    </div>
                  </div>
                  <Link
                    href={section.href}
                    className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-300 transition-colors flex-shrink-0 pt-1 opacity-0 group-hover:opacity-100"
                  >
                    Otwórz
                    <ArrowRight size={11} />
                  </Link>
                </div>

                {/* Features */}
                <ul className="space-y-2">
                  {section.features.map((f, i) => {
                    const FIcon = f.icon;
                    return (
                      <li key={i} className="flex items-start gap-2.5">
                        <FIcon size={13} className={`${section.color} flex-shrink-0 mt-0.5 opacity-70`} />
                        <span className="text-xs text-zinc-400 leading-snug">{f.text}</span>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
