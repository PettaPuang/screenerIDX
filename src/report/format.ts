import type { Signal } from "../engine/types.js";

const rupiah = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
});

function rp(n: number): string {
  return rupiah.format(n);
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
    .map((signal, index) =>
      [
        `*${index + 1}. ${signal.ticker}* ${
          signal.divergence ? "divergence " : ""
        }(${signal.biasHTF})`,
        `Entry ${rp(signal.entry)} | Stop ${rp(signal.stop)} (-${signal.riskPct.toFixed(
          1,
        )}%) | TP ${rp(signal.target)} (+${signal.targetPct.toFixed(1)}%)`,
        `RR ${signal.rr.toFixed(2)} | RSI ${signal.rsi.toFixed(
          0,
        )} | ~${signal.lots} lot`,
      ].join("\n"),
    )
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
    .map(
      (signal, index) => `<tr>
  <td>${index + 1}</td>
  <td><b>${signal.ticker}</b>${signal.divergence ? " divergence" : ""}</td>
  <td>${rp(signal.entry)}</td>
  <td>${rp(signal.stop)}</td>
  <td>${rp(signal.target)}</td>
  <td>${signal.rr.toFixed(2)}</td>
  <td>${signal.rsi.toFixed(0)}</td>
  <td>${signal.lots}</td>
</tr>`,
    )
    .join("");

  return `${head}
<table border="1" cellpadding="6" style="border-collapse:collapse">
  <tr><th>#</th><th>Saham</th><th>Entry</th><th>Stop</th><th>TP</th><th>RR</th><th>RSI</th><th>Lot</th></tr>
  ${rows}
</table>
<p style="color:#888">Bukan nasihat keuangan.</p>`;
}
