export interface PdfSplitterPlugin {
  splitPdf(inputPath: string, pageRanges: Array<{ start: number; end: number }>): Promise<string[]>;
}

export interface NanoPdfAuthoringPlugin {
  authorDocument(input: {
    title: string;
    instructions: string;
    context?: string;
  }): Promise<{ markdown: string }>;
}

export interface LangExtractPlugin {
  extractStructured(text: string): Promise<Record<string, unknown>>;
}
