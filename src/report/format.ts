import type { Signal, WeeklyCandidate } from "../engine/types.js";

const rupiah = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
});

function rp(n: number): string {
  return rupiah.format(n);
}

export function buildWeeklyText(candidates: WeeklyCandidate[]): string {
  if (!candidates.length) {
    return "*Watchlist Minggu Ini*\n(tidak ada saham yang lolos filter mingguan)";
  }

  const rows = candidates
    .map((candidate, index) => {
      const head = `${index + 1}. *${candidate.ticker}* ${rp(candidate.price)} (${candidate.distanceToSupportPct.toFixed(
        1,
      )}% dr support | ATR ${candidate.atrPct.toFixed(1)}%)`;
      const parts: string[] = [];

      if (candidate.swingResistances?.length) {
        parts.push(`R ${candidate.swingResistances.map(rp).join(" / ")}`);
      }

      if (candidate.swingSupports?.length) {
        parts.push(`S ${candidate.swingSupports.map(rp).join(" / ")}`);
      }

      return parts.length ? `${head}\n   ${parts.join(" | ")}` : head;
    })
    .join("\n");

  return [`*Watchlist Minggu Ini* (${candidates.length} saham)`, rows].join("\n");
}

export function buildWeeklyHtml(candidates: WeeklyCandidate[]): string {
  if (!candidates.length) {
    return "<h3>Watchlist Minggu Ini</h3><p>Tidak ada saham yang lolos filter mingguan.</p>";
  }

  const items = candidates
    .map((candidate) => {
      const parts: string[] = [];

      if (candidate.swingResistances?.length) {
        parts.push(`R ${candidate.swingResistances.map(rp).join(" / ")}`);
      }

      if (candidate.swingSupports?.length) {
        parts.push(`S ${candidate.swingSupports.map(rp).join(" / ")}`);
      }

      const sr = parts.length ? `<br><small>${parts.join(" | ")}</small>` : "";

      return `<li><b>${candidate.ticker}</b> ${rp(candidate.price)} (${candidate.distanceToSupportPct.toFixed(
        1,
      )}% dr support, ATR ${candidate.atrPct.toFixed(1)}%)${sr}</li>`;
    })
    .join("");

  return `<h3>Watchlist Minggu Ini (${candidates.length} saham)</h3><ol>${items}</ol>`;
}

export function buildText(signals: Signal[], regimeWarn: string): string {
  const date = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  if (!signals.length) {
    return [
      `Screener IDX - ${date}`,
      regimeWarn,
      "Tidak ada setup yang lolos kriteria hari ini.",
    ].join("\n");
  }

  const rows = signals
    .map((signal, index) => {
      const lines = [
        `*${index + 1}. ${signal.ticker}* ${
          signal.divergence ? "divergence " : ""
        }(${signal.biasHTF})${
          signal.triggers.length ? ` [${signal.triggers.join("/")}]` : ""
        }`,
        `Entry ${rp(signal.entry)} | Stop ${rp(signal.stop)} (-${signal.riskPct.toFixed(
          1,
        )}%) | TP ${rp(signal.target)} (+${signal.targetPct.toFixed(1)}%)`,
        `RR ${signal.rr.toFixed(2)} | RSI ${signal.rsi.toFixed(
          0,
        )} | CMF ${signal.cmf.toFixed(2)} | ~${signal.lots} lot`,
      ];

      if (signal.pivots) {
        const p = signal.pivots;
        lines.push(
          `R1 ${rp(p.R1)}  R2 ${rp(p.R2)}  R3 ${rp(p.R3)}`,
          `S1 ${rp(p.S1)}  S2 ${rp(p.S2)}  S3 ${rp(p.S3)}`,
        );
      }

      return lines.join("\n");
    })
    .join("\n\n");

  return [
    `Screener IDX - ${date}`,
    regimeWarn,
    "",
    rows,
    "",
    "_Bukan nasihat keuangan. Verifikasi harga live dan konfirmasi entry._",
  ].join("\n");
}

export function buildHtml(signals: Signal[], regimeWarn: string): string {
  const head = `<h2>Screener IDX</h2><p>${regimeWarn}</p>`;

  if (!signals.length) {
    return `${head}<p>Tidak ada setup yang lolos hari ini.</p>`;
  }

  const rows = signals
    .map((signal, index) => {
      const pivotCell = signal.pivots
        ? `R ${rp(signal.pivots.R1)} / ${rp(signal.pivots.R2)} / ${rp(
            signal.pivots.R3,
          )}<br>S ${rp(signal.pivots.S1)} / ${rp(signal.pivots.S2)} / ${rp(
            signal.pivots.S3,
          )}`
        : "-";

      return `<tr>
  <td>${index + 1}</td>
  <td><b>${signal.ticker}</b>${signal.divergence ? " divergence" : ""}</td>
  <td>${rp(signal.entry)}</td>
  <td>${rp(signal.stop)}</td>
  <td>${rp(signal.target)}</td>
  <td>${signal.rr.toFixed(2)}</td>
  <td>${signal.rsi.toFixed(0)}</td>
  <td>${signal.lots}</td>
  <td>${pivotCell}</td>
</tr>`;
    })
    .join("");

  return `${head}
<table border="1" cellpadding="6" style="border-collapse:collapse">
  <tr><th>#</th><th>Saham</th><th>Entry</th><th>Stop</th><th>TP</th><th>RR</th><th>RSI</th><th>Lot</th><th>Pivot (D)</th></tr>
  ${rows}
</table>
<p style="color:#888">Bukan nasihat keuangan.</p>`;
}
