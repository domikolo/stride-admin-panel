'use client';

import { Document, Page, Text, View, Image, StyleSheet, Font } from '@react-pdf/renderer';
import { Report } from '@/lib/types';

// Font is registered externally (ReportDownloadButton) with absolute URLs

interface Props {
  report: Report;
  clientId: string;
  logoUrl: string;
  iconUrl: string;
}

// A4: 595 x 842 pt, padding 36 → usable width 523 pt
const COL_GAP = 14;
const COL_W = (523 - COL_GAP) / 2; // ~254 pt each

const s = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 36,
    paddingTop: 32,
    paddingBottom: 48, // room for footer
    fontFamily: 'Roboto',
    fontSize: 10,
  },

  // ── Header ────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  logoImg: { width: 110 }, // height omitted → auto aspect ratio
  headerRight: { alignItems: 'flex-end', gap: 2 },
  headerRightLabel: { fontSize: 8, color: '#9ca3af', letterSpacing: 0.3 },
  headerRightSite: { fontSize: 8, color: '#6b7280' },

  // ── Title block ───────────────────────────────────────────────
  titleBlock: { marginBottom: 18 },
  reportTitle: {
    fontSize: 16,
    fontFamily: 'Roboto', fontWeight: 700,
    color: '#111827',
    marginBottom: 5,
  },
  metaLine: {
    fontSize: 8.5,
    color: '#6b7280',
    flexDirection: 'row',
    gap: 12,
  },
  metaDot: { color: '#d1d5db' },

  // ── Two-column body ───────────────────────────────────────────
  body: {
    flexDirection: 'row',
    gap: COL_GAP,
  },
  col: { width: COL_W },

  // ── Stat box ──────────────────────────────────────────────────
  box: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 5,
  },
  boxHead: {
    backgroundColor: '#f9fafb',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  boxHeadText: {
    fontSize: 7.5,
    fontFamily: 'Roboto', fontWeight: 700,
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  boxBody: {
    paddingHorizontal: 10,
    paddingTop: 2,
    paddingBottom: 2,
  },

  // ── Key-value row ─────────────────────────────────────────────
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  rowLast: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  rowLabel: { fontSize: 9, color: '#6b7280' },
  rowValue: { fontSize: 9, fontFamily: 'Roboto', fontWeight: 700, color: '#111827' },
  rowValueBlue: { fontSize: 9, fontFamily: 'Roboto', fontWeight: 700, color: '#2563eb' },

  // ── Footer ────────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 8,
  },
  footerText: { fontSize: 7.5, color: '#9ca3af' },
  footerIcon: { width: 16 }, // height omitted → auto aspect ratio
});

// ── Helpers ──────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    const months = [
      '', 'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
      'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia',
    ];
    return `${d.getDate()} ${months[d.getMonth() + 1]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch { return iso; }
}

function clientName(id: string) {
  return id === 'stride-services' ? 'Stride Services' : id;
}

function typeLabel(t: string) {
  if (t === 'weekly') return 'Tygodniowy';
  if (t === 'monthly') return 'Miesięczny';
  return 'Niestandardowy';
}

// ── Sub-components ───────────────────────────────────────────────

interface BoxProps { title: string; children: React.ReactNode }
function Box({ title, children }: BoxProps) {
  return (
    <View style={s.box}>
      <View style={s.boxHead}>
        <Text style={s.boxHeadText}>{title}</Text>
      </View>
      <View style={s.boxBody}>{children}</View>
    </View>
  );
}

interface RowProps { label: string; value: string; last?: boolean; accent?: boolean }
function Row({ label, value, last, accent }: RowProps) {
  return (
    <View style={last ? s.rowLast : s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={accent ? s.rowValueBlue : s.rowValue}>{value}</Text>
    </View>
  );
}

// ── Main component ───────────────────────────────────────────────

export default function ReportPDF({ report, clientId, logoUrl, iconUrl }: Props) {
  const { stats } = report;
  const hasRatings = stats.ratingsPositive + stats.ratingsNegative > 0;

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          {logoUrl
            ? <Image src={logoUrl} style={s.logoImg} />
            : <Text style={{ fontSize: 15, fontFamily: 'Roboto', fontWeight: 700, color: '#111827' }}>Stride Services</Text>
          }
          <View style={s.headerRight}>
            <Text style={s.headerRightLabel}>Raport chatbota</Text>
            <Text style={s.headerRightSite}>panel.stride-services.pl</Text>
          </View>
        </View>

        {/* Title */}
        <View style={s.titleBlock}>
          <Text style={s.reportTitle}>{report.title}</Text>
          <View style={s.metaLine}>
            <Text>Klient: {clientName(clientId)}</Text>
            <Text style={s.metaDot}>·</Text>
            <Text>Typ: {typeLabel(report.reportType)}</Text>
            <Text style={s.metaDot}>·</Text>
            <Text>Wygenerowano: {fmtDate(report.generatedAt)}</Text>
          </View>
        </View>

        {/* Two-column body */}
        <View style={s.body}>

          {/* Left column */}
          <View style={s.col}>
            <Box title="Rozmowy i wiadomości">
              <Row label="Rozmowy łącznie" value={String(stats.conversationsTotal)} />
              <Row label="Wiadomości łącznie" value={String(stats.messagesTotal)} />
              <Row label="Śred. wiad. / rozmowę" value={String(stats.avgMessagesPerConv)} last />
            </Box>

            <Box title="Spotkania">
              <Row label="Umówione łącznie" value={String(stats.apptsTotal)} accent />
              <Row label="Potwierdzone" value={String(stats.apptsConfirmed)} />
              <Row label="Oczekujące" value={String(stats.apptsPending)} />
              <Row label="Odwołane" value={String(stats.apptsCancelled)} last />
            </Box>
          </View>

          {/* Right column */}
          <View style={s.col}>
            <Box title="Leady (kontakty zebrane)">
              <Row label="Email" value={String(stats.leadsEmail)} />
              <Row label="Telefon" value={String(stats.leadsPhone)} />
              <Row label="Łącznie" value={String(stats.leadsTotal)} accent last />
            </Box>

            <Box title="Koszty AI">
              <Row label="Koszt łączny" value={`$${stats.costTotalUsd.toFixed(4)}`} accent />
              <Row label="Koszt / rozmowę" value={`$${stats.costPerConvUsd.toFixed(4)}`} last />
            </Box>

            {hasRatings && (
              <Box title="Oceny rozmów">
                <Row label="Pozytywne" value={String(stats.ratingsPositive)} />
                <Row label="Negatywne" value={String(stats.ratingsNegative)} />
                <Row
                  label="Satysfakcja"
                  value={stats.satisfactionPct === -1 ? 'Brak ocen' : `${stats.satisfactionPct}%`}
                  accent
                  last
                />
              </Box>
            )}
          </View>

        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Wygenerowano przez Stride Services · panel.stride-services.pl</Text>
          {iconUrl ? <Image src={iconUrl} style={s.footerIcon} /> : null}
        </View>

      </Page>
    </Document>
  );
}
