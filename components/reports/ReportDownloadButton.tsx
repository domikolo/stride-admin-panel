'use client';

import { PDFDownloadLink } from '@react-pdf/renderer';
import ReportPDF from './ReportPDF';
import { Download, RefreshCw } from 'lucide-react';
import { Report } from '@/lib/types';

interface Props {
  report: Report;
  clientId: string;
}

export default function ReportDownloadButton({ report, clientId }: Props) {
  const logoUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/FO51AA85ACF83a1-02.png`
      : 'https://panel.stride-services.pl/FO51AA85ACF83a1-02.png';
  const iconUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/icon-logo-czarne.png`
      : 'https://panel.stride-services.pl/icon-logo-czarne.png';

  return (
    <PDFDownloadLink
      document={
        <ReportPDF
          report={report}
          clientId={clientId}
          logoUrl={logoUrl}
          iconUrl={iconUrl}
        />
      }
      fileName={`raport-${report.reportType}-${report.periodStart}.pdf`}
    >
      {({ loading }) => (
        <span
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-white/[0.08] transition-colors cursor-pointer
            ${loading
              ? 'bg-white/[0.04] text-zinc-500 cursor-default pointer-events-none'
              : 'bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 hover:text-white'
            }`}
        >
          {loading ? (
            <><RefreshCw size={12} className="animate-spin" />Generowanie...</>
          ) : (
            <><Download size={12} />Pobierz PDF</>
          )}
        </span>
      )}
    </PDFDownloadLink>
  );
}
