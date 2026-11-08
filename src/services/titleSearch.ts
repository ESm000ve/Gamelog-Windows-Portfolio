export function searchTitle(value: string) {
  const roman: Record<string, string> = {
    i: "1",
    ii: "2",
    iii: "3",
    iv: "4",
    v: "5",
    vi: "6",
    vii: "7",
    viii: "8",
    ix: "9",
    x: "10",
    xi: "11",
    xii: "12",
    xiii: "13",
    xiv: "14",
    xv: "15",
    xvi: "16",
    xvii: "17",
    xviii: "18",
    xix: "19",
    xx: "20",
  };
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase()
    .replace(/(\p{L})(\d)/gu, "$1 $2")
    .replace(/(\d)(\p{L})/gu, "$1 $2")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .map((token) => roman[token] ?? token)
    .join(" ");
}
export function titleMatch(title: string, query: string): number | undefined {
  const candidate = searchTitle(title),
    wanted = searchTitle(query);
  if (!wanted) return 3;
  if (candidate === wanted) return 0;
  if (candidate.startsWith(wanted)) return 1;
  const tokens = wanted.split(" ");
  return tokens.every((token) =>
    /^\d+$/.test(token) ? candidate.split(" ").includes(token) : candidate.includes(token)
  )
    ? 2
    : undefined;
}
