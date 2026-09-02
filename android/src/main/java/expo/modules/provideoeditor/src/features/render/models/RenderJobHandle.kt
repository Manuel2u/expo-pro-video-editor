package expo.modules.provideoeditor.src.features.render.models

import java.util.concurrent.atomic.AtomicBoolean

/**
 * Handle for managing a render job's lifecycle.
 *
 * This class provides thread-safe cancellation functionality for ongoing render operations.
 * It uses an atomic boolean to ensure that cancellation can only occur once, preventing
 * duplicate cleanup operations or race conditions.
 *
 * The handle is returned immediately when a render job starts, allowing the caller to
 * cancel the operation at any time before completion.
 *
 * Example usage:
 * ```kotlin
 * val handle = renderVideo.render(config, onProgress, onComplete, onError)
 *
 * // Later, if needed:
 * handle.cancel()
 * ```
 *
 * @property cancelAction The cleanup action to execute when cancel is called
 */
class RenderJobHandle(private val cancelAction: () -> Unit) {
    private val isCanceled = AtomicBoolean(false)

    /**
     * Cancels the render job if not already canceled.
     *
     * This is a thread-safe operation that can be called multiple times from different
     * threads without issue. Only the first call will execute the actual cancellation logic,
     * ensuring that cleanup operations (stopping transformers, deleting files) happen exactly once.
     *
     * The cancellation action typically includes:
     * - Stopping progress polling
     * - Canceling the Media3 Transformer
     * - Cleaning up temporary output files
     */
    fun cancel() {
        if (isCanceled.compareAndSet(false, true)) {
            cancelAction()
        }
    }
}
