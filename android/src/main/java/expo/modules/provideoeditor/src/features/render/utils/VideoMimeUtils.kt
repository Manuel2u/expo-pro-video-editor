package expo.modules.provideoeditor.src.features.render.utils

import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi

/**
 * Maps video format identifiers to AndroidX Media3 MIME type constants.
 *
 * This utility function converts user-friendly format strings (like "mp4", "h265")
 * into the corresponding MIME type constants required by Media3's Transformer API.
 * The mapping focuses on video codecs rather than container formats.
 *
 * Supported formats:
 * - "mp4" -> H.264 codec (most common for MP4 containers)
 * - "h264" -> H.264 codec (explicit codec selection)
 * - "h265", "hevc" -> H.265/HEVC codec (higher compression)
 * - "av1" -> AV1 codec (modern, royalty-free codec)
 *
 * Note: WebM with VP9 codec is currently commented out due to potential
 * compatibility issues or incomplete implementation.
 *
 * @param format The format identifier string (case-insensitive)
 * @return The corresponding Media3 MIME type constant
 * @see MimeTypes for all available MIME type constants
 */
@UnstableApi
fun mapFormatToMimeType(format: String): String {
    return when (format.lowercase()) {
        "mp4" -> MimeTypes.VIDEO_H264 // Codec for MP4
        // "webm" -> MimeTypes.VIDEO_VP9 // Codec for WebM
        "h264" -> MimeTypes.VIDEO_H264
        "h265", "hevc" -> MimeTypes.VIDEO_H265
        "av1" -> MimeTypes.VIDEO_AV1
        else -> MimeTypes.VIDEO_H264 // Fallback default
    }
}
