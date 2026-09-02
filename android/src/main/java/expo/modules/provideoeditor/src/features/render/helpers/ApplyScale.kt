package expo.modules.provideoeditor.src.features.render.helpers

import androidx.media3.common.Effect
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.ScaleAndRotateTransformation
import expo.modules.provideoeditor.src.core.constants.RENDER_TAG
import expo.modules.provideoeditor.src.shared.logging.PluginLog as Log

/**
 * Applies scale transformation to video dimensions.
 *
 * Scales video width and/or height by the specified factors.
 * Default scale is 1.0 (no scaling) if parameter is null.
 *
 * @param videoEffects List to add scale effect to
 * @param scaleX Horizontal scale factor (null = 1.0)
 * @param scaleY Vertical scale factor (null = 1.0)
 */
@UnstableApi
fun applyScale(
    videoEffects: MutableList<Effect>, scaleX: Float?, scaleY: Float?,
) {
    if (scaleX == null && scaleY == null) return

    Log.d(RENDER_TAG, "Applying scale: x=${scaleX ?: 1.0f}, y=${scaleY ?: 1.0f}")
    videoEffects += ScaleAndRotateTransformation.Builder()
        .setScale(scaleX ?: 1f, scaleY ?: 1f)
        .build()
}
