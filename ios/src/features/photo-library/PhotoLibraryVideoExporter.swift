import Photos
import AVFoundation
import Foundation

/// Exports a photo-library video PHAsset to a real, playable local file.
///
/// A `ph://<localIdentifier>` URI cannot be opened directly by AVPlayer/expo-video, nor
/// copied via `expo-file-system`'s `PHAssetResourceManager.writeData` path on some
/// devices/OS versions — that call has been observed failing with an opaque
/// `PHPhotosErrorDomain error -1` even for locally-available, non-iCloud assets. This
/// uses `PHImageManager.requestExportSession`, the API Apple documents specifically for
/// producing an exportable/playable representation of a video asset (distinct from
/// `requestAVAsset`, which only yields a playback-only `AVAsset`, and from
/// `PHAssetResourceManager`, which operates on the asset's raw resource data).
enum PhotoLibraryVideoExporter {
  enum ExportError: Error, CustomStringConvertible {
    case assetNotFound(String)
    case notAVideoAsset(String)
    case exportSessionUnavailable(String)
    case exportFailed(String)

    var description: String {
      switch self {
      case .assetNotFound(let id): return "No photo library asset found for id \(id)"
      case .notAVideoAsset(let id): return "Asset \(id) is not a video"
      case .exportSessionUnavailable(let id): return "Could not create an export session for asset \(id)"
      case .exportFailed(let message): return message
      }
    }
  }

  /// - Parameters:
  ///   - localIdentifier: A `PHAsset.localIdentifier` (the part of a `ph://` URI before
  ///     the `/L0/001` suffix this app's JS side already strips before calling in).
  ///   - destinationURL: Where to write the exported `.mov`/`.mp4` file — the caller owns
  ///     picking a path in its own sandboxed cache directory.
  static func export(localIdentifier: String, to destinationURL: URL) async throws {
    guard let asset = PHAsset.fetchAssets(withLocalIdentifiers: [localIdentifier], options: nil).firstObject else {
      throw ExportError.assetNotFound(localIdentifier)
    }
    guard asset.mediaType == .video else {
      throw ExportError.notAVideoAsset(localIdentifier)
    }

    if FileManager.default.fileExists(atPath: destinationURL.path) {
      try FileManager.default.removeItem(at: destinationURL)
    }

    let options = PHVideoRequestOptions()
    options.isNetworkAccessAllowed = true
    options.deliveryMode = .highQualityFormat
    // .original (not .current/.unadjusted): requestExportSession can otherwise resolve an
    // adjusted/proxy render for an edited or iCloud-optimized asset, which has been observed
    // to silently drop the source track's portrait preferredTransform — see the defensive
    // re-application below for why that must not be trusted either way.
    options.version = .original

    let exportSession: AVAssetExportSession? = await withCheckedContinuation { continuation in
      PHImageManager.default().requestExportSession(
        forVideo: asset,
        options: options,
        exportPreset: AVAssetExportPresetHighestQuality
      ) { session, _ in
        continuation.resume(returning: session)
      }
    }

    guard let exportSession else {
      throw ExportError.exportSessionUnavailable(localIdentifier)
    }

    // requestExportSession's returned session doesn't reliably preserve the source video
    // track's preferredTransform (the rotation matrix that makes an iOS-recorded portrait
    // video, which is actually stored as landscape pixel data, display upright) — observed
    // as an exported file reporting landscape pixel dimensions for a portrait source,
    // rendering zoomed/cropped under a `cover`-fit vertical player. Re-apply it explicitly
    // via a video composition rather than trusting the export session's default behavior.
    let sourceAsset = exportSession.asset
    if let videoTrack = sourceAsset.tracks(withMediaType: .video).first {
      let transform = videoTrack.preferredTransform
      // An exact `abs(transform.b) == 1` equality check is too brittle for this: a
      // photo-library asset's preferredTransform routinely carries a rotation that
      // is only approximately ±90°/±270° (stabilization/lens-correction adjustments,
      // mirrored front-camera captures, Photos-applied edits even under `.original`),
      // so `transform.b`/`transform.c` land at e.g. 0.9998 rather than exactly 1.0.
      // That made `isPortrait` false for real portrait footage while the layer
      // instruction below still applied the (near-90°) rotation unconditionally —
      // the rotated frame then landed almost entirely outside the declared
      // (unrotated, landscape) renderSize, and AVAssetExportSession "succeeds" with
      // a video track that composites to black. Audio isn't touched by this video
      // composition, so it played fine while the picture stayed dark — exactly the
      // "audio plays, video is black" symptom this exists to fix. Use the same
      // atan2-based angle tolerance already used elsewhere in this package (see
      // VideoTranscoder.calculateOutputSize / VideoSequenceBuilder) instead.
      let rotationAngle = abs(atan2(transform.b, transform.a))
      let isPortrait = rotationAngle > .pi / 4 && rotationAngle < 3 * .pi / 4
      let naturalSize = videoTrack.naturalSize
      let renderSize = isPortrait
        ? CGSize(width: naturalSize.height, height: naturalSize.width)
        : naturalSize

      let composition = AVMutableVideoComposition()
      composition.renderSize = renderSize
      composition.frameDuration = CMTime(value: 1, timescale: 30)

      let instruction = AVMutableVideoCompositionInstruction()
      instruction.timeRange = CMTimeRange(start: .zero, duration: sourceAsset.duration)

      let layerInstruction = AVMutableVideoCompositionLayerInstruction(assetTrack: videoTrack)
      layerInstruction.setTransform(transform, at: .zero)
      instruction.layerInstructions = [layerInstruction]
      composition.instructions = [instruction]

      exportSession.videoComposition = composition
    }

    exportSession.outputURL = destinationURL
    exportSession.outputFileType = .mov

    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
      exportSession.exportAsynchronously {
        switch exportSession.status {
        case .completed:
          continuation.resume(returning: ())
        case .failed:
          continuation.resume(
            throwing: ExportError.exportFailed(
              exportSession.error?.localizedDescription ?? "Export failed for asset \(localIdentifier)"))
        case .cancelled:
          continuation.resume(throwing: CancellationError())
        default:
          continuation.resume(
            throwing: ExportError.exportFailed("Unexpected export status \(exportSession.status.rawValue) for asset \(localIdentifier)"))
        }
      }
    }
  }
}
