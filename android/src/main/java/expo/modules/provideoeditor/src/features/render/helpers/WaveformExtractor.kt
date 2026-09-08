package expo.modules.provideoeditor.src.features.render.helpers

import android.media.MediaExtractor
import android.media.MediaFormat
import androidx.media3.common.util.UnstableApi
import expo.modules.provideoeditor.src.core.constants.RENDER_TAG
import expo.modules.provideoeditor.src.shared.logging.PluginLog as Log
import expo.modules.provideoeditor.src.shared.media.PcmRangeDecoder
import java.io.File

/**
 * Extracts a downsampled peak-amplitude waveform from an audio (or video's
 * embedded audio) track, for UI display — e.g. the trim scrubber's audio row
 * in the example app.
 *
 * Reuses [PcmRangeDecoder]'s streaming decode loop and folds each PCM chunk
 * directly into per-bucket peaks rather than spooling the whole file to disk
 * like [AudioPreRenderer] does — a waveform preview only needs one running
 * max per bucket, never the samples themselves once they've been folded in.
 */
@UnstableApi
object WaveformExtractor {

    /**
     * Extracts [bucketCount] peak-amplitude values (each in `0.0..1.0`)
     * spanning the full duration of [inputPath]'s first audio track.
     *
     * @param inputPath Absolute path to a video or audio file.
     * @param bucketCount Number of peaks to produce. Must be > 0.
     * @return A list of exactly [bucketCount] values.
     * @throws IllegalArgumentException if [bucketCount] is not positive.
     * @throws IllegalStateException if the file has no audio track.
     */
    fun extract(inputPath: String, bucketCount: Int): List<Double> {
        require(bucketCount > 0) { "bucketCount must be > 0" }

        val sourceFile = File(inputPath)
        check(sourceFile.exists()) { "File does not exist: $inputPath" }

        val extractor = MediaExtractor()
        try {
            extractor.setDataSource(inputPath)

            var audioTrackIndex = -1
            var inputFormat: MediaFormat? = null
            for (i in 0 until extractor.trackCount) {
                val format = extractor.getTrackFormat(i)
                val mime = format.getString(MediaFormat.KEY_MIME) ?: continue
                if (mime.startsWith("audio/")) {
                    audioTrackIndex = i
                    inputFormat = format
                    break
                }
            }

            checkNotNull(inputFormat) { "No audio track found in $inputPath" }
            check(audioTrackIndex >= 0)

            // Total (interleaved) sample count up front so we know how many
            // samples fall in each bucket, and can flush a running peak as
            // soon as a bucket fills up instead of holding every sample in
            // memory — mirrors the iOS WaveformExtractor's approach.
            val durationUs = if (inputFormat.containsKey(MediaFormat.KEY_DURATION)) {
                inputFormat.getLong(MediaFormat.KEY_DURATION)
            } else {
                0L
            }
            val fallbackSampleRate = inputFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE)
            val fallbackChannelCount = inputFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
            val estimatedTotalSamples = (
                (durationUs / 1_000_000.0) * fallbackSampleRate * fallbackChannelCount
            ).toLong().coerceAtLeast(1L)
            val samplesPerBucket = (estimatedTotalSamples / bucketCount).coerceAtLeast(1L)

            val peaks = ArrayList<Double>(bucketCount)
            var currentBucketPeak = 0
            var samplesInCurrentBucket = 0L

            fun flushSample(magnitude: Int) {
                if (magnitude > currentBucketPeak) currentBucketPeak = magnitude
                samplesInCurrentBucket++
                if (samplesInCurrentBucket >= samplesPerBucket && peaks.size < bucketCount - 1) {
                    peaks.add(currentBucketPeak / 32767.0)
                    currentBucketPeak = 0
                    samplesInCurrentBucket = 0L
                }
            }

            PcmRangeDecoder.decode(
                extractor = extractor,
                audioTrackIndex = audioTrackIndex,
                inputFormat = inputFormat,
                startUs = 0L,
                endUs = Long.MAX_VALUE,
                onFormat = {},
                onPcm = { pcm, _, _ ->
                    // Reconstructs each little-endian Int16 sample by hand,
                    // regardless of channel count — a peak/amplitude preview
                    // doesn't need per-channel separation, just the loudest
                    // value seen in each time bucket.
                    var offset = 0
                    while (offset + 1 < pcm.size) {
                        val low = pcm[offset].toInt() and 0xFF
                        val high = pcm[offset + 1].toInt() and 0xFF
                        val raw = ((high shl 8) or low).toShort().toInt()
                        val magnitude = if (raw == Short.MIN_VALUE.toInt()) {
                            Short.MAX_VALUE.toInt()
                        } else {
                            kotlin.math.abs(raw)
                        }
                        flushSample(magnitude)
                        offset += 2
                    }
                },
            )

            // Flush whatever's left in the final (possibly partial) bucket,
            // and pad with zeros if the source was shorter than expected —
            // always return exactly `bucketCount` values so the UI can size
            // bars without checking.
            peaks.add(currentBucketPeak / 32767.0)
            while (peaks.size < bucketCount) {
                peaks.add(0.0)
            }

            return peaks
        } catch (e: Exception) {
            Log.e(RENDER_TAG, "WaveformExtractor: failed for $inputPath: ${e.message}")
            throw e
        } finally {
            try {
                extractor.release()
            } catch (_: Exception) {
            }
        }
    }
}
