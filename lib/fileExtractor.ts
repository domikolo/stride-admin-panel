const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_PDF_PAGES = 15;
export const AI_CHAR_LIMIT = 40_000;

const CONTACT_MSG =
  'Plik jest zbyt duży dla AI. Skontaktuj się z Jakubem lub Dominikiem — pomożemy przygotować tę treść.';

export interface ExtractResult {
  text: string;
  /** total chars extracted (may exceed AI_CHAR_LIMIT) */
  totalChars: number;
  /** PDF only */
  pages?: number;
}

export async function extractTextFromFile(file: File): Promise<ExtractResult> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(CONTACT_MSG);
  }

  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'txt' || ext === 'md' || ext === 'csv') {
    const text = await readAsText(file);
    return { text, totalChars: text.length };
  }

  if (ext === 'docx') {
    const mammoth = (await import('mammoth')).default;
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    const text = result.value;
    return { text, totalChars: text.length };
  }

  if (ext === 'pdf') {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    if (pdf.numPages > MAX_PDF_PAGES) {
      throw new Error(CONTACT_MSG);
    }

    const pages = await Promise.all(
      Array.from({ length: pdf.numPages }, (_, i) =>
        pdf.getPage(i + 1)
          .then(p => p.getTextContent())
          .then(tc => tc.items.map((it: any) => it.str).join(' '))
      )
    );
    const text = pages.join('\n\n');

    if (text.trim().length < 50) {
      throw new Error(
        'PDF nie zawiera tekstu — prawdopodobnie jest zeskanowany (obraz). Skontaktuj się z Jakubem lub Dominikiem, pomożemy.'
      );
    }

    return { text, totalChars: text.length, pages: pdf.numPages };
  }

  throw new Error(`Nieobsługiwany format pliku: .${ext}`);
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file, 'UTF-8');
  });
}
