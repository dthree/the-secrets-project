export type DemoInput = { input: string; report?: never } | { report: string; input?: never };
export type DemoRequest = DemoInput & { scope: string; sequence: number };
export type DemoView = {
  count: number;
  total: number;
  money: number;
  sequence: number;
  html: string;
  css: string;
  hint: string;
  feedback: string;
  notices: Array<{ name: string; explanation: string }>;
};
