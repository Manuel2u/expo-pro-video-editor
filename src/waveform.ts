/**
 * `extractWaveform` returns raw 0...1 peak-amplitude values. Real-world audio
 * (quiet dialogue, voice notes, low-bitrate recordings) rarely reaches
 * digital full-scale, so rendering those values directly produces a flat,
 * low-contrast strip. This applies the same auto-gain + contrast curve used
 * throughout this package's own waveform UI, so any consumer gets the same
 * spiky, high-contrast look without re-deriving the tuning by eye.
 */
export function normalizeWaveformPeaks(peaks: number[], contrastExponent = 1.6): number[] {
  const maxPeak = Math.max(...peaks, 0.0001);
  return peaks.map(peak => (peak / maxPeak) ** contrastExponent);
}
