'use client';

import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import { Report } from '@/lib/types';

interface Props {
  report: Report;
  clientId: string;
  logoUrl: string;
  iconUrl: string;
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#ffffff', padding: 40, fontFamily: 'Helvetica' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  logoLarge: { width: 120 },
  headerRight: { alignItems: 'flex-end', gap: 4 },
  logoIcon: { width: 28, height: 28 },
  headerRightText: { fontSize: 9, color: '#6b7280', marginTop: 4 },
  reportTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#111827', marginBottom: 20 },
  metaRow: { flexDirection: 'row', gap: 16, marginBottom: 28 },
  metaItem: { flex: 1, backgroundColor: '#f9fafb', padding: 10, borderRadius: 4 },
  metaLabel: { fontSize: 8, color: '#6b7280', marginBottom: 3, textTransform: 'uppercase' },
  metaValue: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#111827' },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#374151',
    marginBottom: 8,
    marginTop: 20,
    textTransform: 'uppercase',
  },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginBottom: 8 },
  table: { width: '100%' },
  tableRowHeader: {
    flexDirection: 'row',
    paddingVertical: 7,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  tableHeaderCell: {
    flex: 1,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#6b7280',
    textTransform: 'uppercase',
    paddingHorizontal: 8,
  },
  tableHeaderCellRight: {
    flex: 1,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#6b7280',
    textTransform: 'uppercase',
    paddingHorizontal: 8,
    textAlign: 'right',
  },
  tableCell: { flex: 1, fontSize: 10, color: '#374151', paddingHorizontal: 8 },
  tableCellRight: { flex: 1, fontSize: 10, color: '#374151', paddingHorizontal: 8, textAlign: 'right' },
  tableCellBold: { flex: 1, fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#111827', paddingHorizontal: 8 },
  tableCellRightBold: {
    flex: 1,
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    paddingHorizontal: 8,
    textAlign: 'right',
  },
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: { fontSize: 8, color: '#9ca3af' },
  footerIcon: { width: 18, height: 18 },
});

function SectionTitle({ children }: { children: string }) {
  return (
    <>
      <Text style={styles.sectionTitle}>{children}</Text>
      <View style={styles.divider} />
    </>
  );
}

function TableHeader({ left, right }: { left: string; right: string }) {
  return (
    <View style={styles.tableRowHeader}>
      <Text style={styles.tableHeaderCell}>{left}</Text>
      <Text style={styles.tableHeaderCellRight}>{right}</Text>
    </View>
  );
}

function TableRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.tableRow}>
      <Text style={bold ? styles.tableCellBold : styles.tableCell}>{label}</Text>
      <Text style={bold ? styles.tableCellRightBold : styles.tableCellRight}>{value}</Text>
    </View>
  );
}

function formatGeneratedAt(iso: string): string {
  try {
    const d = new Date(iso);
    const months = [
      '', 'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
      'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia',
    ];
    const day = d.getDate();
    const month = months[d.getMonth() + 1];
    const year = d.getFullYear();
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${year}, ${h}:${m}`;
  } catch {
    return iso;
  }
}

function typeLabel(reportType: string): string {
  if (reportType === 'weekly') return 'Tygodniowy';
  if (reportType === 'monthly') return 'Miesięczny';
  return 'Niestandardowy';
}

function clientName(clientId: string): string {
  if (clientId === 'stride-services') return 'Stride Services';
  return clientId;
}

export default function ReportPDF({ report, clientId, logoUrl, iconUrl }: Props) {
  const { stats } = report;
  const hasRatings = stats.ratingsPositive + stats.ratingsNegative > 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            {logoUrl ? (
              <Image src={logoUrl} style={styles.logoLarge} />
            ) : (
              <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#111827' }}>Stride Services</Text>
            )}
          </View>
          <View style={styles.headerRight}>
            {iconUrl ? <Image src={iconUrl} style={styles.logoIcon} /> : null}
            <Text style={styles.headerRightText}>Raport chatbota</Text>
          </View>
        </View>

        {/* Report title */}
        <Text style={styles.reportTitle}>{report.title}</Text>

        {/* Meta row */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Klient</Text>
            <Text style={styles.metaValue}>{clientName(clientId)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Okres</Text>
            <Text style={styles.metaValue}>{report.periodLabel}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Typ</Text>
            <Text style={styles.metaValue}>{typeLabel(report.reportType)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Wygenerowano</Text>
            <Text style={styles.metaValue}>{formatGeneratedAt(report.generatedAt)}</Text>
          </View>
        </View>

        {/* Section: Rozmowy i wiadomości */}
        <SectionTitle>Rozmowy i wiadomosci</SectionTitle>
        <View style={styles.table}>
          <TableHeader left="Wskaznik" right="Wartosc" />
          <TableRow label="Laczna liczba rozmow" value={String(stats.conversationsTotal)} />
          <TableRow label="Laczna liczba wiadomosci" value={String(stats.messagesTotal)} />
          <TableRow label="Srednia wiadomosci / rozmowe" value={String(stats.avgMessagesPerConv)} />
        </View>

        {/* Section: Leady */}
        <SectionTitle>Leady (kontakty zebrane)</SectionTitle>
        <View style={styles.table}>
          <TableHeader left="Typ" right="Liczba" />
          <TableRow label="Leady email" value={String(stats.leadsEmail)} />
          <TableRow label="Leady telefon" value={String(stats.leadsPhone)} />
          <TableRow label="Leady lacznie" value={String(stats.leadsTotal)} bold />
        </View>

        {/* Section: Spotkania */}
        <SectionTitle>Spotkania</SectionTitle>
        <View style={styles.table}>
          <TableHeader left="Status" right="Liczba" />
          <TableRow label="Umowione lacznie" value={String(stats.apptsTotal)} bold />
          <TableRow label="Potwierdzone" value={String(stats.apptsConfirmed)} />
          <TableRow label="Oczekujace" value={String(stats.apptsPending)} />
          <TableRow label="Odwolane" value={String(stats.apptsCancelled)} />
        </View>

        {/* Section: Koszty AI */}
        <SectionTitle>Koszty AI</SectionTitle>
        <View style={styles.table}>
          <TableHeader left="Wskaznik" right="Wartosc" />
          <TableRow label="Koszt calkowity" value={`$${stats.costTotalUsd.toFixed(4)}`} bold />
          <TableRow label="Koszt na rozmowe" value={`$${stats.costPerConvUsd.toFixed(4)}`} />
        </View>

        {/* Section: Oceny rozmów (only if ratings exist) */}
        {hasRatings && (
          <>
            <SectionTitle>Oceny rozmow</SectionTitle>
            <View style={styles.table}>
              <TableHeader left="Wskaznik" right="Wartosc" />
              <TableRow label="Oceny pozytywne" value={String(stats.ratingsPositive)} />
              <TableRow label="Oceny negatywne" value={String(stats.ratingsNegative)} />
              <TableRow
                label="Satysfakcja"
                value={stats.satisfactionPct === -1 ? 'Brak ocen' : `${stats.satisfactionPct}%`}
                bold
              />
            </View>
          </>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Wygenerowano przez Stride Services · stride-services.pl</Text>
          {iconUrl ? <Image src={iconUrl} style={styles.footerIcon} /> : null}
        </View>
      </Page>
    </Document>
  );
}
