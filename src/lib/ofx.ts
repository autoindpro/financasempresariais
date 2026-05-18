export type OfxTransaction = {
  fitId: string | null;
  postedAt: string; // YYYY-MM-DD
  amount: number;
  name: string | null;
  memo: string | null;
  checkNum: string | null;
  raw: Record<string, string | null>;
};

function textBetween(haystack: string, startTag: string, endTag: string): string | null {
  const start = haystack.indexOf(startTag);
  if (start === -1) return null;
  const from = start + startTag.length;
  const end = haystack.indexOf(endTag, from);
  if (end === -1) return null;
  return haystack.slice(from, end);
}

function pickTag(block: string, tag: string): string | null {
  // Supports both <TAG>value and <TAG>value</TAG>
  const re = new RegExp(`<${tag}>([^<\\r\\n]*)`, "i");
  const m = block.match(re);
  if (!m) return null;
  const v = (m[1] ?? "").trim();
  return v.length ? v : null;
}

function parseOfxDate(v: string | null): string | null {
  if (!v) return null;
  // Common: YYYYMMDD, sometimes with time: YYYYMMDDHHMMSS[.sss][tz]
  const m = v.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function parseAmount(v: string | null): number | null {
  if (!v) return null;
  const normalized = v.replace(/\./g, "").replace(",", "."); // best-effort for locales
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function deriveFitId(tx: Pick<OfxTransaction, "fitId" | "postedAt" | "amount" | "name" | "memo">): string {
  if (tx.fitId) return tx.fitId;
  // Deterministic fallback to reduce duplicates when FITID is missing.
  const base = `${tx.postedAt}|${tx.amount}|${tx.name ?? ""}|${tx.memo ?? ""}`.trim();
  let h = 2166136261;
  for (let i = 0; i < base.length; i++) {
    h ^= base.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `NOFITID_${(h >>> 0).toString(16)}`;
}

export function parseOfx(content: string): { transactions: OfxTransaction[] } {
  // Handle SGML-style OFX (common): no closing tags, header before <OFX>
  const ofxBody = textBetween(content, "<OFX>", "</OFX>") ?? content.slice(content.indexOf("<OFX>"));
  const txns: OfxTransaction[] = [];

  const stmtTrnRe = /<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/BANKTRANLIST>|<\/OFX>)/gi;
  let m: RegExpExecArray | null;
  while ((m = stmtTrnRe.exec(ofxBody))) {
    const block = m[1] ?? "";
    const dt = parseOfxDate(pickTag(block, "DTPOSTED"));
    const amt = parseAmount(pickTag(block, "TRNAMT"));
    if (!dt || amt === null) continue;
    const name = pickTag(block, "NAME");
    const memo = pickTag(block, "MEMO");
    const fitId = pickTag(block, "FITID");
    const checkNum = pickTag(block, "CHECKNUM");

    const raw: Record<string, string | null> = {
      DTPOSTED: pickTag(block, "DTPOSTED"),
      TRNAMT: pickTag(block, "TRNAMT"),
      NAME: name,
      MEMO: memo,
      FITID: fitId,
      CHECKNUM: checkNum,
      TRNTYPE: pickTag(block, "TRNTYPE"),
    };

    const tx: OfxTransaction = {
      fitId,
      postedAt: dt,
      amount: amt,
      name,
      memo,
      checkNum,
      raw,
    };
    tx.fitId = deriveFitId(tx);
    txns.push(tx);
  }

  return { transactions: txns };
}

