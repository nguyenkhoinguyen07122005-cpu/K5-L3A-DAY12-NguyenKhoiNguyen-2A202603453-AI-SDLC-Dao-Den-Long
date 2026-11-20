// Bang xep hang cuc bo (Ticket-04, muc 3). Ham thuan, dung chung cho may chu (luu dia) va ban choi web.
// Khong thuoc loi mo phong: khong anh huong dau ra headless.
export const MAX_ENTRIES = 10;
// Ten 3-12 ky tu [A-Za-z0-9_]; ho tro chu cai co dau (tieng Viet) la diem cong -> cho phep chu cai Unicode.
const NAME_RE = /^[\p{L}\p{N}_]{3,12}$/u;

export const validName = (name) => typeof name === "string" && NAME_RE.test(name);

const isoOk = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(s) && !Number.isNaN(Date.parse(s));

/** Mot muc hop le: {name, score, nights_won, achieved_at (ISO 8601 co mui gio), seed}. */
export function validEntry(e) {
  return !!e && typeof e === "object" && validName(e.name) && Number.isInteger(e.score) && e.score >= 0 && Number.isInteger(e.nights_won) && e.nights_won >= 0 && e.nights_won <= 3 && isoOk(e.achieved_at) && Number.isInteger(e.seed);
}

const clean = (e) => ({ name: e.name, score: e.score, nights_won: e.nights_won, achieved_at: e.achieved_at, seed: e.seed });

/** Sap xep: diem giam dan; bang diem thi nguoi dat truoc dung tren; bang ca hai thi giu thu tu cu. */
export function sortEntries(list) {
  return list
    .map((e, i) => [e, i])
    .sort((a, b) => b[0].score - a[0].score || Date.parse(a[0].achieved_at) - Date.parse(b[0].achieved_at) || a[1] - b[1])
    .map(([e]) => e);
}

/** Doc du lieu tho (co the hong): bo muc sai, sap xep, giu top 10. */
export function normalize(raw) {
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.entries) ? raw.entries : [];
  return sortEntries(list.filter(validEntry).map(clean)).slice(0, MAX_ENTRIES);
}

/** Them mot muc. Tra ve {entries, rank} (rank 1-based, null neu khong vao top 10). Nem loi neu muc khong hop le. */
export function addEntry(list, entry) {
  if (!validEntry(entry)) throw new Error("muc xep hang khong hop le");
  const e = clean(entry);
  const entries = sortEntries([...normalize(list), e]).slice(0, MAX_ENTRIES);
  const rank = entries.indexOf(entries.find((x) => x.name === e.name && x.score === e.score && x.achieved_at === e.achieved_at && x.seed === e.seed));
  return { entries, rank: rank < 0 ? null : rank + 1 };
}
