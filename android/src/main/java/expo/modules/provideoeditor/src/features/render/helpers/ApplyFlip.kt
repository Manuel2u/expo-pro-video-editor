package expo.modules.provideoeditor.src.features.render.helpers

import androidx.media3.common.Effect
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.ScaleAndRotateTransformation
import expo.modules.provideoeditor.src.core.constants.RENDER_TAG
import expo.modules.provideoeditor.src.shared.logging.PluginLog as Log

/**
 * Applies horizontal and/or vertical flip transformation.
 *
 * Flips the video by applying negative scale factors.
 * No effect if both flip parameters are false.
 *
 * @param videoEffects List to add flip effect to
 * @param flipX True to flip horizontally (mirror)
 * @param flipY True to flip vertically
 */
@UnstableApi
fun applyFlip(videoEffects: MutableList<Effect>, flipX: Boolean, flipY: Boolean) {
    if (!flipX && !flipY) return

    Log.d(RENDER_TAG, "Applying flip: horizontal=$flipX, vertical=$flipY")
    videoEffects += ScaleAndRotateTransformation.Builder()
        .setScale(if (flipX) -1f else 1f, if (flipY) -1f else 1f)
        .build()
}
