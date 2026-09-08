import AVFoundation
import Foundation

/// Extracts a downsampled peak-amplitude waveform from an audio (or video's
/// embedded audio) track, for UI display — e.g. the trim scrubber's audio
/// row in the example app.
///
/// Streams PCM samples via `AVAssetReader` and folds them directly into
/// per-bucket peaks rather than buffering the whole decoded file (unlike
/// `AudioPreRenderer`, which needs the full PCM in memory to loop/pad it).
internal enum WaveformExtractor {

  /// Extracts `bucketCount` peak-amplitude values (each in `0...1`) spanning
  /// the full duration of `inputPath`'s first audio track.
  ///
  /// - Parameters:
  ///   - inputPath: Absolute path to a video or audio file.
  ///   - bucketCount: Number of peaks to produce. Must be > 0.
  /// - Returns: An array of exactly `bucketCount` values, or throws if the
  ///   file has no audio track or cannot be read.
  static func extract(inputPath: String, bucketCount: Int) async throws -> [Double] {
    let url = URL(fileURLWithPath: inputPath)
    guard FileManager.default.fileExists(atPath: url.path) else {
      throw NSError(
        domain: "WaveformExtractor",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "File does not exist: \(inputPath)"]
      )
    }

    let asset = AVURLAsset(url: url)

    guard let audioTrack = try await MediaInfoExtractor.loadAudioTrack(from: asset) else {
      throw NSError(
        domain: "WaveformExtractor",
        code: 2,
        userInfo: [NSLocalizedDescriptionKey: "No audio track found in \(inputPath)"]
      )
    }

    // Read the source's real channel count and sample rate from its stream
    // basic description — forcing AVNumberOfChannelsKey down to 1 for a
    // stereo/multichannel source silently produces all-zero PCM on some
    // inputs (no explicit AVChannelLayoutKey to guide the downmix), so
    // channels are requested as-is and folded into one peak-per-bucket in
    // the read loop below instead.
    let formatDescriptions = (try? await audioTrack.load(.formatDescriptions)) ?? []
    let basicDescription = formatDescriptions.first.flatMap {
      CMAudioFormatDescriptionGetStreamBasicDescription($0)?.pointee
    }
    let sourceChannelCount = basicDescription.map { Int($0.mChannelsPerFrame) } ?? 2
    let sourceSampleRate = basicDescription.map { $0.mSampleRate } ?? 44100

    let outputSettings: [String: Any] = [
      AVFormatIDKey: kAudioFormatLinearPCM,
      AVNumberOfChannelsKey: sourceChannelCount,
      AVLinearPCMBitDepthKey: 16,
      AVLinearPCMIsFloatKey: false,
      AVLinearPCMIsBigEndianKey: false,
      AVLinearPCMIsNonInterleaved: false,
    ]

    let reader = try AVAssetReader(asset: asset)

    let trackOutput = AVAssetReaderTrackOutput(track: audioTrack, outputSettings: outputSettings)
    trackOutput.alwaysCopiesSampleData = false
    guard reader.canAdd(trackOutput) else {
      throw NSError(
        domain: "WaveformExtractor",
        code: 3,
        userInfo: [NSLocalizedDescriptionKey: "Cannot add track output to reader"]
      )
    }
    reader.add(trackOutput)

    guard reader.startReading() else {
      throw reader.error
        ?? NSError(
          domain: "WaveformExtractor",
          code: 4,
          userInfo: [NSLocalizedDescriptionKey: "AVAssetReader.startReading failed"]
        )
    }

    // Total sample count up front so we know how many (interleaved) samples
    // fall in each bucket, and can flush a running peak as soon as a bucket
    // fills up instead of holding every sample in memory.
    let duration: CMTime
    if #available(iOS 15.0, macOS 13.0, *) {
      duration = (try? await asset.load(.duration)) ?? .zero
    } else {
      duration = asset.duration
    }
    let totalSamples = max(1, Int(duration.seconds * sourceSampleRate) * sourceChannelCount)
    let samplesPerBucket = max(1, totalSamples / max(1, bucketCount))

    var peaks: [Double] = []
    peaks.reserveCapacity(bucketCount)

    var currentBucketPeak: Int16 = 0
    var samplesInCurrentBucket = 0

    while reader.status == .reading, let sampleBuffer = trackOutput.copyNextSampleBuffer() {
      guard let blockBuffer = CMSampleBufferGetDataBuffer(sampleBuffer) else { continue }
      let length = CMBlockBufferGetDataLength(blockBuffer)
      guard length > 0 else { continue }

      var tempBytes = [UInt8](repeating: 0, count: length)
      let status = CMBlockBufferCopyDataBytes(
        blockBuffer, atOffset: 0, dataLength: length, destination: &tempBytes)
      guard status == kCMBlockBufferNoErr else { continue }

      // Reconstructs each little-endian Int16 sample by hand rather than
      // via `withUnsafeBytes { $0.bindMemory(to: Int16.self) } — both are
      // valid Swift, but this form makes the byte layout explicit and
      // avoids relying on the temporary buffer's alignment.
      var offset = 0
      while offset + 1 < tempBytes.count {
        let low = UInt16(tempBytes[offset])
        let high = UInt16(tempBytes[offset + 1])
        let raw = Int16(bitPattern: (high << 8) | low)
        let magnitude = raw == .min ? Int16.max : abs(raw)
        currentBucketPeak = max(currentBucketPeak, magnitude)
        samplesInCurrentBucket += 1
        if samplesInCurrentBucket >= samplesPerBucket && peaks.count < bucketCount - 1 {
          peaks.append(Double(currentBucketPeak) / Double(Int16.max))
          currentBucketPeak = 0
          samplesInCurrentBucket = 0
        }
        offset += 2
      }
    }

    if reader.status == .failed, let error = reader.error {
      throw error
    }

    // Flush whatever's left in the final (possibly partial) bucket, and pad
    // with zeros if the source was shorter than expected — always return
    // exactly `bucketCount` values so the UI can size bars without checking.
    peaks.append(Double(currentBucketPeak) / Double(Int16.max))
    while peaks.count < bucketCount {
      peaks.append(0)
    }

    return peaks
  }
}
