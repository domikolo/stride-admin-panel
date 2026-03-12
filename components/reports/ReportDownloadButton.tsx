'use client';

import { useState } from 'react';
import { pdf, Font } from '@react-pdf/renderer';
import ReportPDF from './ReportPDF';
import { Download, RefreshCw } from 'lucide-react';
import { Report } from '@/lib/types';

interface Props {
  report: Report;
  clientId: string;
}

export default function ReportDownloadButton({ report, clientId }: Props) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const origin = window.location.origin;
      const logoUrl = `${origin}/FO51AA85ACF83a1-02.png`;
      const iconUrl = `${origin}/icon-logo-czarne.png`;

      Font.register({
        family: 'Roboto',
        fonts: [
          { src: `${origin}/fonts/Roboto-Regular.ttf`, fontWeight: 400 },
          { src: `${origin}/fonts/Roboto-Bold.ttf`, fontWeight: 700 },
        ],
      });

      const blob = await pdf(
        <ReportPDF
          report={report}
          clientId={clientId}
          logoUrl={logoUrl}
          iconUrl={iconUrl}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `raport-${report.reportType}-${report.periodStart}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('PDF generation failed:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 hover:text-white transition-colors border border-white/[0.08] disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <><RefreshCw size={12} className="animate-spin" />Generowanie...</>
      ) : (
        <><Download size={12} />Pobierz PDF</>
      )}
    </button>
  );
}
