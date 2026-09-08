package expo.modules.provideoeditor

import androidx.media3.common.util.UnstableApi
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import expo.modules.provideoeditor.src.features.render.RenderVideo
import expo.modules.provideoeditor.src.features.render.helpers.WaveformExtractor
import expo.modules.provideoeditor.src.features.render.models.RenderConfig
import expo.modules.provideoeditor.src.features.render.models.RenderJobHandle
import expo.modules.provideoeditor.src.shared.logging.PluginLog

@UnstableApi
class ExpoProVideoEditorModule : Module() {
  /**
   * Active render jobs, keyed by the caller-supplied task id.
   *
   * Mirrors `ProVideoEditorPlugin.activeRenderTasks`: tracked so a second
   * `render` call reusing the same `id` is rejected instead of silently
   * racing another job, and so `cancelRender` can find the job to stop.
   */
  private val activeRenderHandles = mutableMapOf<String, RenderJobHandle>()

  /**
   * Whether the task for `id` was cancelled by an explicit `cancelRender`
   * call, as opposed to a pipeline cancelling itself (a stalled-export
   * watchdog, a refused start). Both surface the same way, but only the
   * former is a genuine user-requested cancel.
   */
  private val explicitlyCancelled = mutableSetOf<String>()

  override fun definition() = ModuleDefinition {
    Name("ExpoProVideoEditor")

    Events("onRenderProgress")

    // Expo Modules API dispatches an AsyncFunction on a background queue by
    // default. Media3's Transformer binds to whichever thread creates it and
    // then requires every later call (including addListener from the
    // RenderVideo pipeline's own main-Looper post) on that same thread — a
    // Transformer built on the default background queue crashes the first
    // time a main-thread callback touches it ("Transformer is accessed on the
    // wrong thread"). Forcing this function onto the main queue keeps the
    // whole render() call on the same thread Media3 expects throughout.
    AsyncFunction("render") { args: Map<String, Any?>, id: String, promise: Promise ->
      if (id.isEmpty()) {
        promise.reject(ExpoProVideoEditorException.invalidArguments("Missing task id"))
        return@AsyncFunction
      }

      if (activeRenderHandles.containsKey(id)) {
        promise.reject(ExpoProVideoEditorException.taskAlreadyRunning(id))
        return@AsyncFunction
      }

      val config: RenderConfig
      try {
        config = RenderConfig.fromArguments(args)
      } catch (e: Exception) {
        promise.reject(
          ExpoProVideoEditorException.invalidArguments(
            "Invalid render configuration: ${e.message}"
          )
        )
        return@AsyncFunction
      }

      val context = appContext.reactContext
      if (context == null) {
        promise.reject(
          ExpoProVideoEditorException.invalidArguments("Application context is not available")
        )
        return@AsyncFunction
      }

      sendEvent("onRenderProgress", mapOf("id" to id, "progress" to 0.0))

      val renderVideo = RenderVideo(context)
      val handle = renderVideo.render(
        config = config,
        onProgress = { progress ->
          sendEvent("onRenderProgress", mapOf("id" to id, "progress" to progress))
        },
        onComplete = { outputData ->
          sendEvent("onRenderProgress", mapOf("id" to id, "progress" to 1.0))
          activeRenderHandles.remove(id)
          explicitlyCancelled.remove(id)
          promise.resolve(outputData)
        },
        onError = { error ->
          PluginLog.e("ExpoProVideoEditor", "Render failed: ${error.message}", error)
          activeRenderHandles.remove(id)
          val wasCancelled = explicitlyCancelled.remove(id)
          promise.reject(
            ExpoProVideoEditorException.renderFailed(canceled = wasCancelled, error = error)
          )
        }
      )

      activeRenderHandles[id] = handle
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("cancelRender") { id: String, promise: Promise ->
      if (id.isEmpty()) {
        promise.reject(ExpoProVideoEditorException.invalidArguments("Missing task id"))
        return@AsyncFunction
      }

      val handle = activeRenderHandles[id]
      if (handle == null) {
        promise.reject(ExpoProVideoEditorException.taskNotFound(id))
        return@AsyncFunction
      }

      explicitlyCancelled.add(id)
      handle.cancel()
      promise.resolve(null)
    }.runOnQueue(Queues.MAIN)

    // No .runOnQueue(Queues.MAIN) here — unlike render()/cancelRender(),
    // this does plain MediaExtractor/MediaCodec decoding (like
    // AudioPreRenderer), which has no Media3 Transformer thread affinity to
    // respect. The default background queue is exactly what a blocking
    // decode loop wants.
    AsyncFunction("extractWaveform") { inputPath: String, bucketCount: Int, promise: Promise ->
      if (inputPath.isEmpty()) {
        promise.reject(ExpoProVideoEditorException.invalidArguments("Missing input path"))
        return@AsyncFunction
      }
      if (bucketCount <= 0) {
        promise.reject(ExpoProVideoEditorException.invalidArguments("bucketCount must be > 0"))
        return@AsyncFunction
      }

      try {
        val peaks = WaveformExtractor.extract(inputPath, bucketCount)
        promise.resolve(peaks)
      } catch (e: Exception) {
        promise.reject(ExpoProVideoEditorException.waveformFailed(e))
      }
    }
  }
}

/**
 * Errors thrown across the JS boundary. Expo Modules API converts a thrown
 * [CodedException] into a JS `Error` carrying `.code` and `.message` — the
 * same shape iOS's `Exception` gives, and the same shape `FlutterError`'s
 * `code`/`message` gave the Flutter side. Unlike iOS's `Exception` (whose
 * JS-visible message reads a separate `reason` property, not the
 * `description` an easy-to-reach initializer sets — see the iOS module's
 * `fix(ios)` commit), `CodedException`'s `message` constructor argument is
 * exactly what reaches JS, so no equivalent subclass trick is needed here.
 */
private class ExpoProVideoEditorException(
  code: String,
  message: String,
  cause: Throwable? = null,
) : CodedException(code, message, cause) {
  companion object {
    fun invalidArguments(message: String) =
      ExpoProVideoEditorException("INVALID_ARGUMENTS", message)

    fun taskAlreadyRunning(id: String) =
      ExpoProVideoEditorException(
        "TASK_ALREADY_RUNNING", "Task with id $id is already running"
      )

    fun taskNotFound(id: String) =
      ExpoProVideoEditorException("TASK_NOT_FOUND", "No task found for id $id")

    /**
     * A pipeline can also cancel itself (a stalled-export watchdog, a refused
     * start), so a bare cancellation-shaped failure is a cancellation even
     * when `canceled` (an explicit `cancelRender` call) is false.
     */
    fun renderFailed(canceled: Boolean, error: Throwable): ExpoProVideoEditorException {
      val isCancellation = error is java.util.concurrent.CancellationException
      val code = if (canceled || isCancellation) "CANCELED" else "RENDER_ERROR"
      return ExpoProVideoEditorException(
        code, error.message ?: "Unknown render error", error
      )
    }

    fun waveformFailed(error: Throwable) =
      ExpoProVideoEditorException(
        "WAVEFORM_ERROR", error.message ?: "Unknown waveform extraction error", error
      )
  }
}
